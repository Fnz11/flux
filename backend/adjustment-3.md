# Backend Optimization Audit — Adjustment 3
**Author**: Senior Backend / DEX Infrastructure  
**Date**: 2026-08-06  
**Scope**: Full codebase scan of `internal/`, `migrations/`, `deploy/`, `docker-compose.yml`, `go.mod`

---

## 1. Current Implementation Status — Audit Results

### 1.1 Materialized Views ✅ Implemented, ⚠️ Issues Found

**What's there:**
- `030_matviews.sql`: `portfolio_summary` and `user_pnl_summary` are correct, well-formed SQL
- Unique indexes exist on both MVs (required for `CONCURRENTLY` refresh)
- `jobs/worker.go`: `MVRefreshWorker` refreshes every 5 min with `REFRESH MATERIALIZED VIEW CONCURRENTLY`

**Issues / Gaps:**
1. **Refresh is sequential, not parallel** — `worker.go:78` loops over both views one by one. On a busy DB each refresh can take >1s; combined you can miss windows. They should refresh concurrently (two goroutines with individual timeout contexts).
2. **No refresh jitter** — all replicas refresh at the same tick. Under horizontal scale, you get N simultaneous `REFRESH` calls fighting for the `ExclusiveLock`. Add ±15s random jitter.
3. **Refresh worker never signals cache invalidation** — after a MV refresh, the Redis keys (`app:user:*:pnl`, `app:global:leaderboard`, `app:vault:*:summary`) remain stale for up to another 30-60s TTL. Worker should publish a "refresh done" event (channel or Redis pub/sub) so the cache layer knows to evict.
4. **`pnl_service.go:calculateUserPnL`** (fallback path): does `Preload("Vault")` — this is an N+1 for vault TVL lookups. One JOIN query can replace the N vault fetches.
5. **`030_matviews.sql` uses `DROP MATERIALIZED VIEW ... CASCADE`** — idempotent re-run destroys all downstream views. In production this is dangerous. Use `CREATE MATERIALIZED VIEW IF NOT EXISTS` or wrap in a version check.

---

### 1.2 SQL Queries — Good Use of Raw SQL, ⚠️ Leakage Found

**What's there:**
- `pnl_service.go`: `userPnLSummaryQuery` — raw SQL against `user_pnl_summary`
- `tsdb_repo.go`: `ohlcvQuery` — proper raw SQL with `time_bucket` and window functions
- `metrics_repo.go`: dynamic query building via GORM `.Table()` + `.Select()`

**Issues / Gaps:**
1. **`trade_repo.go` — ALL paths use GORM ORM syntax** (`Where`, `Order`, `Offset`, `Limit`). `ListByVault` and `ListByVaultIDs` are called on every page load. These generate dynamic SQL with potential plan cache misses. Replace with `db.Raw(...)` and named SQL constants.
2. **`portfolio_repo.go:UpsertPosition`** — select-then-insert pattern (read-modify-write). Under concurrent `SyncTrade` calls for the same user+vault, two goroutines can both miss the `First()` and race to `Create()`. **Solution**: use `INSERT ... ON CONFLICT DO UPDATE` as a single atomic query.
3. **`vault_repo.go:List`** — N+1 loop at lines 178–183: for every vault returned, fires two extra `COUNT(*)` queries (`TradeCount`, `PortfolioCount`). For a 20-vault page = 40 extra queries. **Solution**: use a single JOIN with subquery counts, or read from `portfolio_summary` MV.
4. **`vault_repo.go:GetByID`** — `WHERE id = ? OR id = ?` with the same value (line 47) — redundant OR, wastes index scans.
5. **`metrics_repo.go:queryVaultMetrics`** — `db.Migrator().HasTable()` on every read request is a schema introspection call. Cache this boolean in memory at startup.

---

### 1.3 Redis Cache ✅ Implemented, ⚠️ Multiple Gaps

**What's there:**
- `cache/cache.go`: Clean `Cache` interface with `Get/Set/Delete/SetWithTTL/Ping`
- `cache/client.go`: Redis pool (20 conns, 5 idle, 3s timeouts)
- `cache/keys.go`: Namespaced key builders
- `repository/cache_decorator.go`: Decorator pattern for `PortfolioRepository` and `TradeRepository`
- `pnl_service.go`: Cache-aside pattern for PnL reads

**Issues / Gaps:**
1. **Key namespace mismatch**: `cache_decorator.go` builds keys locally (`"app:user:" + userID + ":portfolio"`) while `cache/keys.go` has `UserPortfolioKey(userID)`. Same strings today but not using the same builder — future rename silently diverges. **Fix**: use `cache.Keys.*` helpers everywhere.
2. **No Redis pipeline / batch get** — `invalidateKeys()` in `cache_decorator.go:52–56` deletes keys one by one. Each `.Del()` is a round-trip. 4 keys = 4 RTTs. Use `client.Del(ctx, keys...)` variadic or a `PIPELINE`.
3. **No `singleflight` / stampede protection** — when a popular key expires, N concurrent goroutines all miss and all hit DB simultaneously. A `golang.org/x/sync/singleflight` group in `cacheGet()` collapses concurrent misses for the same key into a single DB read.
4. **Rate limiter is in-process only** — `middleware/ratelimit.go` stores limiters in a `map[string]*limiterEntry`. Per-pod state. Under horizontal scale (2+ Go replicas), each pod tracks its own counters — effectively multiplying the rate limit by pod count. **Fix**: Redis token-bucket with `go-redis-rate`.
5. **No cache warming** — on pod restart, all keys are empty. For high-traffic endpoints (leaderboard, vault list) this causes a DB thundering herd for ~30–60s post-deploy. Add a startup warmer goroutine.
6. **`ListByVault` / `ListByVaultIDs` are NOT cached** (`cache_decorator.go:148–154` — passes straight through). These are the highest-traffic read endpoints. Cache with 15–30s TTL keyed by `vault_id + page + limit`.

---

### 1.4 B-Tree Indexes ✅ Implemented, ⚠️ Gaps

**What's there:**
- `020_btree_indexes.sql`: composite indexes on `trade_histories(vault_id, executed_at DESC)`, `(trade_type, executed_at DESC)`, unique `portfolios(user_id, vault_id)`, `vaults(status)`
- GORM tags add single-column indexes on FK columns

**Issues / Gaps:**
1. **`vaults` table missing index on `(manager_id, status)`** — `List()` with `ManagerAddress` filter does a correlated subquery on `users` then filters `manager_id IN (...)` + `status`. A composite index `(manager_id, status, created_at)` covers the common list + sort pattern.
2. **`price_history` partial index missing** — most queries filter by `vault_id` + recent `fetched_at`. A partial index `WHERE fetched_at > NOW() - INTERVAL '30 days'` on `(vault_id, fetched_at DESC)` would be far smaller and faster.
3. **No index on `vaults.deleted_at`** — `WHERE deleted_at IS NULL` appears in MV queries and GORM soft-delete. A partial index `ON vaults(id) WHERE deleted_at IS NULL` can dramatically cut scan sizes.
4. **No covering index for vault listing** — a covering index on `(status, created_at DESC, tvl)` would allow index-only scans for common sort-by-TVL queries.
5. **No BRIN index on hypertables** — queries that span multiple chunks (e.g. 30-day metrics) benefit from BRIN on `(vault_id)`. Declare BRIN on `trade_histories(vault_id)` and `price_history(vault_id)` for cross-chunk vault scans.

---

### 1.5 TimescaleDB ✅ Implemented, ⚠️ Not Fully Utilized

**What's there:**
- `010_timescale_hypertables.sql`: `trade_histories` (7-day chunks) and `price_history` (1-day chunks)
- Continuous aggregate `cagg_price_ohlcv_1h` with 1h bucket
- Retention: 1 year prices, 2 years trades

**Issues / Gaps:**
1. **`ohlcvQuery` in `tsdb_repo.go` scans raw `price_history` instead of `cagg_price_ohlcv_1h`** — the whole point of the CAGG is to avoid this. For buckets ≥1h, query the CAGG directly. Sub-hour buckets (1m, 5m, 15m) fall back to raw ticks.
2. **`metrics_repo.go:queryFallbackMetrics`** — "tvl" and "volume" fallbacks scan `price_history` raw with `DATE_TRUNC`. Since `cagg_price_ohlcv_1h` already materializes hourly OHLCV, daily rollup should read from the CAGG.
3. **No compression policy configured** — TimescaleDB native columnar compression on chunks older than 7 days can reduce disk 10–20x. No `add_compression_policy` exists.
4. **No continuous aggregate for trades** — `trade_histories` has no CAGG. Add `cagg_trade_volume_1h` for vault-level hourly trade volume (feeds leaderboard, analytics).
5. **Chunk interval tuning** — profile actual write rate. If < 1M rows/week, 30-day chunks reduce chunk management overhead.

---

### 1.6 Circuit Breaker ❌ MISSING — Not Implemented

**Finding:** Zero circuit breaker code exists anywhere in the codebase. `grep` for `gobreaker`, `hystrix`, `resilience`, `circuit` returns nothing.

**Why this matters for a DEX backend:**
- `SyncHandler.SyncVault` and `SyncTrade` call `h.client.GetTransaction()` (Solana RPC). If the RPC node is degraded or rate-limiting, every request blocks for the full timeout — cascading into DB connection exhaustion through PgBouncer.
- Redis failure: cache degrades gracefully but there is no backoff — every miss goes straight to DB at full request rate.

**What needs to be added:**
- Wrap `solana.Client.GetTransaction` with `sony/gobreaker` (threshold: 5 failures / 10s window, half-open probe after 30s)
- Add a separate breaker for the Redis client in `cache/client.go`
- Expose breaker state in the `/health` endpoint

---

### 1.7 PgBouncer ✅ Implemented, ⚠️ Tuning Issues

**What's there:**
- `docker-compose.yml`: PgBouncer in `transaction` pool mode, `max_client_conn=1000`, `default_pool_size=20`
- `deploy/pgbouncer/pgbouncer.ini`: `max_prepared_statements=100`, `DISCARD ALL` on reset
- App routes API traffic through 6432 (PgBouncer), DDL through 5432 (direct)

**Issues / Gaps:**
1. **`database.go:35` — `sqlDB.SetMaxOpenConns(25)`** — PgBouncer `default_pool_size=20`. You're requesting 25 Go-side connections but PgBouncer only maintains 20 real Postgres connections. Set `MaxOpenConns` to 20 to align.
2. **`database.go:36` — `SetMaxIdleConns(5)`** — idle connections are Go-to-PgBouncer TCP connections. With transaction pooling set to `>=MaxOpenConns/2` (10) to avoid TCP handshake overhead on bursts.
3. **`pgbouncer.ini:min_pool_size=0`** — pool warms cold on first request. Set to `5` to keep warm connections pre-established.
4. **`server_reset_query = DISCARD ALL`** — heavy. Switch to `DISCARD PLANS` which is lighter (unless you use `SET SESSION`, `LISTEN`, advisory locks — which you don't).
5. **No `statement_timeout`** — a runaway query can hold a server connection indefinitely. Add `server_connect_timeout=15` and enforce `statement_timeout=30000` at Postgres level.

---

### 1.8 Idempotency ✅ Partially Implemented, ⚠️ Gaps

**What's there:**
- `sync_handler.go:185`: pre-check `FindBySignature` before DB transaction
- `sync_handler.go:230`: re-check inside transaction to handle races
- Unique index on `(transaction_signature, executed_at)` prevents duplicate inserts at DB level

**Issues / Gaps:**
1. **Double-read without pessimistic lock** — pattern is `SELECT → BEGIN → SELECT → INSERT`. Two concurrent syncs of the same signature can both pass the inner check before either commits. Correct fix: `INSERT ... ON CONFLICT DO NOTHING` + check `affected rows = 0` to detect duplicates atomically.
2. **No `Idempotency-Key` header support for HTTP mutations** — non-sync write endpoints (`CreateVault`, `UpdateMetadata`) have no idempotency protection. Clients that retry on network timeout will double-create. Add an `Idempotency-Key` middleware storing `(key → response)` in Redis with 24h TTL.
3. **Error string comparison anti-pattern** — `sync_handler.go:269`: `err.Error() == "already_synced"` is fragile. Define a sentinel error and use `errors.Is()`.

---

## 2. Missing Enterprise-Grade Optimizations

These are patterns used by production DEX backends (dYdX, Jupiter, Drift) that are absent from this codebase:

### 2.1 ❌ Observability — Prometheus + OpenTelemetry Tracing

**Current state**: Only `logrus` structured logging. No metrics, no distributed traces.

**What's missing:**
- Prometheus metrics endpoint (`/metrics`): request latency histograms, DB query duration, cache hit/miss counters, MV refresh duration, PgBouncer queue depth
- OpenTelemetry traces: span per HTTP request → spans for DB queries, Redis ops, Solana RPC calls. Critical for diagnosing slow `SyncTrade` paths.
- pprof endpoint (`/debug/pprof`) — `middleware/pprof.go` exists but needs conditional mount on `ENABLE_PPROF=true`

**Implementation:**
```
go get go.opentelemetry.io/otel
go get github.com/prometheus/client_golang
```
- Prometheus middleware to Gin (request counter, duration histogram)
- Instrument `cache/cache.go` with hit/miss counters
- Instrument `jobs/worker.go` with MV refresh duration gauge
- OTEL spans in `SyncHandler.SyncTrade` around RPC call and DB tx

---

### 2.2 ❌ Read Replica / Read-Write Split

**Current state**: Single DB endpoint via PgBouncer. All reads and writes on same Postgres primary.

**Problem**: Read-heavy endpoints (ListVaults, GetPortfolio, GetPnL) compete with write-heavy endpoints (SyncTrade) for the same Postgres I/O and WAL bandwidth.

**Enterprise solution**: Add a streaming read replica. Route read-only queries to it.

**Implementation:**
- Add `READ_REPLICA_URL` environment variable
- In `database.go`, open a second `*gorm.DB` connection (read replica)
- Create a `ReadWriteDB` wrapper: `.Find()/.First()/.Scan()` → replica; `.Create()/.Update()/.Delete()` → primary
- Route `ListVaults`, `GetPortfolio`, `GetPnL`, `GetOHLCV` to replica

---

### 2.3 ❌ HTTP Response Compression

**Current state**: No response compression. JSON payloads sent raw.

`ListByVaultIDs` returning 100 trades = ~20KB JSON. Leaderboard responses can be 50KB+.

**Fix**:
```go
import "github.com/gin-contrib/gzip"
router.Use(gzip.Gzip(gzip.DefaultCompression))
```
60–80% payload size reduction for free.

---

### 2.4 ❌ Per-Request Statement Timeout

**Current state**: No per-query timeout enforced at DB level. A slow full-table scan can hold a connection for minutes.

**Fix**: Enforce timeouts at handler level via context, and set `statement_timeout` in Postgres:
```go
ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
defer cancel()
```
All repo methods already accept `context.Context` — just wire the timeout in handlers.

---

### 2.5 ❌ Batch Write / Write Coalescing for Trade Sync

**Current state**: Each `SyncTrade` = individual HTTP request → individual DB transaction. Under burst on-chain activity, 50+ concurrent requests each open a separate transaction.

**Enterprise pattern (Jupiter/Drift indexers)**: A `TradeIngestionQueue` — buffered Go channel + batch writer goroutine drains every 100ms with a single `INSERT INTO trade_histories VALUES (...), (...), (...)` bulk insert.

```go
// internal/ingestion/queue.go
type TradeIngestionQueue struct { ch chan *domain.TradeDetail }
func (q *TradeIngestionQueue) Run(ctx context.Context, repo domain.TradeRepository) {
    ticker := time.NewTicker(100 * time.Millisecond)
    var batch []*domain.TradeDetail
    for {
        select {
        case t := <-q.ch:
            batch = append(batch, t)
            if len(batch) >= 500 { q.flush(ctx, repo, batch); batch = batch[:0] }
        case <-ticker.C:
            if len(batch) > 0 { q.flush(ctx, repo, batch); batch = batch[:0] }
        case <-ctx.Done(): return
        }
    }
}
```

---

### 2.6 ❌ Stale-Cache Graceful Degradation

**Current state**: Cache miss → DB query. No further fallback.

**Missing**: When DB is also overloaded (e.g., during MV refresh exclusive lock), no stale-data serving.

**Enterprise pattern**: `GetStaleOrRefresh` — if DB query exceeds 500ms, return stale Redis value with `X-Cache: STALE` header. Only evict on successful refresh.

---

### 2.7 ❌ Structured Error Codes for Clients

**Current state**: `ErrorResponse()` → `{"success": false, "error": "message string"}`. No machine-readable codes.

**Fix**:
```go
type APIError struct {
    Code    string `json:"code"`    // "TRADE_ALREADY_SYNCED", "INSUFFICIENT_SHARES"
    Message string `json:"message"`
}
```

---

### 2.8 ❌ Durable Event Streaming (Kafka / NATS JetStream)

**Current state**: `EventService` dispatches trade events synchronously via in-process WebSocket hub. If the WS hub is slow, `DispatchTradeConfirmed` blocks the HTTP response goroutine.

**Enterprise pattern**: Publish to Kafka/NATS JetStream after DB commit. WS hub becomes a consumer. This decouples the sync path from notification delivery and enables downstream analytics, fee calculation, and audit pipelines.

---

### 2.9 ❌ pgx Native Prepared Statements for Hot Paths

**Current state**: GORM wraps pgx/v5 but disables its prepared statement cache by default.

**Optimization**: Bypass GORM for hot-path queries with pgx named prepared statements:
```go
conn.Prepare(ctx, "get_user_pnl", userPnLSummaryQuery)
conn.Exec(ctx, "get_user_pnl", userID)
```
Skips query parsing and planning on every call — ~15–30% latency reduction on repeated hot queries.

---

### 2.10 ❌ OHLCV CAGG Index Fix (Vault-First Access Pattern)

**Current state**: `cagg_price_ohlcv_1h` unique index is `(bucket, vault_id, token)` — `bucket` leads.

**Gap**: `GetOHLCV` queries by `vault_id` + time range. With `bucket` as the leading column, vault-first range queries do a full index scan.

**Fix**:
```sql
CREATE INDEX idx_cagg_ohlcv_vault_bucket
    ON cagg_price_ohlcv_1h (vault_id, bucket DESC);
```

---

## 3. Priority-Ranked Implementation Plan

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| **P0 — Critical** | Circuit breaker for Solana RPC | 1 day | Prevents cascading failure |
| **P0 — Critical** | Fix N+1 in `vault_repo.List` | 4h | ~40x fewer DB queries on vault listing |
| **P0 — Critical** | `UpsertPosition` → `INSERT ON CONFLICT` | 4h | Eliminates data corruption race |
| **P0 — Critical** | Distributed Redis rate limiter | 4h | Corrects per-pod rate limit bypass |
| **P1 — High** | Prometheus + pprof metrics | 2 days | Observability baseline |
| **P1 — High** | `singleflight` stampede protection in `cacheGet` | 2h | Eliminates DB burst on cache miss |
| **P1 — High** | OHLCV repo → use `cagg_price_ohlcv_1h` for ≥1h buckets | 4h | 10–100x faster chart queries |
| **P1 — High** | MV refresh: parallel + jitter + cache invalidation signal | 4h | Prevents stale data on busy scale |
| **P1 — High** | Redis pipeline batch invalidation (not 1-by-1) | 2h | Reduces Redis round-trips |
| **P2 — Medium** | TimescaleDB compression policy | 4h | 10–20x disk reduction |
| **P2 — Medium** | `Idempotency-Key` middleware for mutations | 1 day | Safe client retries on all mutations |
| **P2 — Medium** | Missing indexes: `deleted_at`, `manager_id+status`, BRIN | 4h | Better query planner decisions |
| **P2 — Medium** | `cagg_trade_volume_1h` continuous aggregate | 4h | Fast leaderboard/analytics queries |
| **P2 — Medium** | Gzip response middleware | 1h | 60–80% payload size reduction |
| **P2 — Medium** | Move `HasTable()` to startup (not per-request) | 1h | Removes introspection on every read |
| **P3 — Low** | Read replica routing (read-write split) | 3 days | Offloads reads from primary |
| **P3 — Low** | Trade ingestion queue / batch writer | 2 days | Higher write throughput under burst |
| **P3 — Low** | OpenTelemetry distributed tracing | 3 days | Deep request-level tracing |
| **P3 — Low** | pgx native prepared statements for hot paths | 2 days | 15–30% query latency |
| **P3 — Low** | Kafka/NATS for trade events | 1 week | Decouple sync path from notifications |

---

## 4. Files to Create / Modify

### New Files
```
internal/middleware/circuit_breaker.go      # sony/gobreaker wrapper for Solana RPC + Redis
internal/middleware/idempotency.go          # Idempotency-Key middleware (Redis-backed)
internal/middleware/prometheus.go           # Prometheus metrics Gin middleware
internal/middleware/timeout.go              # Per-request DB context timeout enforcement
internal/cache/singleflight.go             # Singleflight wrapper for cacheGet stampede protection
internal/ingestion/queue.go                # Trade ingestion queue (batch writer, 100ms window)
migrations/040_compression_policy.sql      # TimescaleDB compression + OHLCV CAGG index fix
migrations/050_cagg_trade_volume.sql       # cagg_trade_volume_1h continuous aggregate
migrations/060_missing_indexes.sql         # deleted_at partial, manager+status composite, BRIN
```

### Modified Files
```
internal/repository/trade_repo.go          # Replace GORM ORM with .Raw() SQL constants
internal/repository/portfolio_repo.go      # Replace UpsertPosition with ON CONFLICT upsert
internal/repository/vault_repo.go          # Fix N+1 in List(), fix redundant OR in GetByID
internal/repository/tsdb_repo.go           # Route ≥1h OHLCV to cagg_price_ohlcv_1h
internal/repository/metrics_repo.go        # Cache HasTable() at startup; CAGG for fallback
internal/repository/cache_decorator.go     # Use cache.Keys.* helpers; add ListByVault cache
internal/cache/cache.go                    # Add GetStale interface; batch delete method
internal/cache/client.go                   # Add circuit breaker; distributed rate limiter
internal/jobs/worker.go                    # Parallel refresh + jitter + cache-evict signal
internal/services/pnl_service.go           # Fix N+1 fallback path (JOIN instead of Preload)
internal/handlers/sync_handler.go          # Sentinel error (errors.Is) instead of string compare
internal/database/database.go              # MaxOpenConns=20, MaxIdleConns=10 (match PgBouncer)
internal/middleware/ratelimit.go            # Replace in-process limiter with Redis token bucket
deploy/pgbouncer/pgbouncer.ini             # min_pool_size=5, DISCARD PLANS, server_connect_timeout
```

---

## 5. Quick Wins — Do Today (< 1 Hour Each)

1. **`database.go`**: `SetMaxOpenConns(25)` → `SetMaxOpenConns(20)`, `SetMaxIdleConns(5)` → `SetMaxIdleConns(10)`
2. **`pgbouncer.ini`**: `min_pool_size = 5`, `server_reset_query = DISCARD PLANS`
3. **`sync_handler.go:269`**: `err.Error() == "already_synced"` → define `var ErrAlreadySynced = errors.New("already_synced")` and use `errors.Is(err, ErrAlreadySynced)`
4. **`cache_decorator.go:52–56`**: Replace loop of individual `Delete` calls with single `client.Del(ctx, key1, key2, key3, key4)`
5. **`vault_repo.go:47`**: Remove duplicate `WHERE id = ? OR id = ?` — use `WHERE id = ?`
6. **`metrics_repo.go`**: Move `HasTable()` check to struct constructor, store as a `bool` field, skip introspection on every request
7. **`030_matviews.sql`**: Replace `DROP MATERIALIZED VIEW IF EXISTS ... CASCADE` with `CREATE MATERIALIZED VIEW IF NOT EXISTS` guarded creation for safe re-runs in production

---

## 6. Reference Architecture (Target State)

```
Client Request
     │
     ├─[Rate Limit: Redis Token Bucket (distributed, per-IP)]
     ├─[Auth: JWT + Ed25519 signature verification]
     ├─[Timeout: 10s context deadline]
     ├─[Gzip: compress responses >1KB]
     ├─[Prometheus: instrument latency + status]
     │
     ▼
 Gin Router (OpenTelemetry spans per route)
     │
     ├─ GET /pnl  ──────────────────► Redis Cache (30s TTL, singleflight on miss)
     │                                      │ MISS
     │                                      ▼
     │                              PgBouncer (6432, tx pool)
     │                                      │
     │                              TimescaleDB primary / read replica
     │                              → user_pnl_summary MV
     │
     ├─ GET /ohlcv  ─────────────────► cagg_price_ohlcv_1h (bucket ≥ 1h)
     │                                 price_history raw (bucket < 1h)
     │
     ├─ POST /sync/trade  ──► Circuit Breaker ──► Solana RPC
     │                              │ OK
     │                        PgBouncer → BEGIN TX
     │                        INSERT trade ON CONFLICT DO NOTHING
     │                        INSERT/UPDATE portfolio ON CONFLICT DO UPDATE
     │                        COMMIT
     │                        Redis pipeline: UNLINK key1 key2 key3 key4
     │                        NATS/Kafka publish trade event (async)
     │
     └─ Background Jobs (per-pod, jittered):
          MVRefreshWorker (parallel goroutines per MV, ±15s jitter, 5min interval)
          └─ On complete: Redis PUBLISH "mv:refreshed" → cache proactive eviction
          TimescaleDB CAGG refresh (managed by TimescaleDB scheduler)
          Compression policy (managed by TimescaleDB scheduler)
```
