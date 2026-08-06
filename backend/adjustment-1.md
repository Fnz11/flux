# Backend Audit — FBYT POC

Lead backend review of `./backend`. Scope: architecture, correctness, security, performance, scalability, readability, ops, tests. Evidence from source + `go test ./...` (83 pass, 16 packages) + `go vet`/`go build` clean.

**Verdict:** Strong POC bones (layered packages, cache keys, matviews, PgBouncer, WS hub, Solana parse path). **Not production-ready.** Critical auth/sync holes and half-wired architecture mean demo can look advanced while core invariants are wrong.

---

## Scorecard

| Area | Grade | Note |
|------|-------|------|
| Architecture / structure | C+ | Package layout good; wiring incomplete; dual paths |
| Clean / readable | B- | Clear names; globals + duplicated logic hurt |
| Scalable | C | Infra sketched (pool/cache/MV); app not fully using it |
| Optimized | C+ | Indexes/MV/Redis planned; hot paths still raw + OFFSET |
| Secure | D | Auth middleware unused; sync open; money math float |
| Correct / works E2E | C- | Unit tests green; chain sync + portfolio path fragile |
| Ops / deploy | D+ | Compose solid; no Dockerfile/CI; dangerous AutoMigrate |
| Tests | C | Good unit islands; almost no HTTP/e2e/handler coverage |

---

## Strengths (keep)

1. **Layout** — `cmd/server`, `internal/{handlers,services,repository,domain,middleware,ws,jobs,cache}`, `pkg/solana`, `migrations/`, `deploy/` is the right Go shape for a portfolio POC.
2. **HTTP basics** — `gin.New()` + Recovery/Logger, `ReadHeaderTimeout: 10s`, graceful shutdown hook, CORS allowlist, security headers, consistent `APIResponse` envelope.
3. **Infra awareness** — Timescale + PgBouncer transaction pool + Redis AOF/LRU, composite indexes SQL, concurrent matview refresh worker, k6 load scripts.
4. **Domain interfaces** — `domain.*Repository` + cache decorator pattern exists (even if not wired).
5. **Solana package** — Anchor discriminator parse, deposit/trade verify helpers, RPC timeout wrapper.
6. **Tests exist** — auth middleware, cache, jobs, PnL math, cache decorator, some repo/MV tests. Build/vet/test currently green.

---

## P0 — Fix before any public demo / recruiter digs

### 1. Auth middleware never mounted — write path is open

`AuthMiddleware` is implemented and unit-tested, but **router never uses it**.

```go
// internal/router/router.go — no AuthMiddleware on any group
vaults.PATCH("/:address", hs.Vault.UpdateVaultMetadata) // expects wallet in context
vaults.POST("/sync", handlers.SyncVault)                 // fully public
trades.POST("/sync", handlers.SyncTrade)                 // fully public
```

`UpdateVaultMetadata` reads `middleware.GetWalletAddress(c)` and 401s if empty — so **manager metadata update is effectively dead** in real traffic, not protected by JWT.

**Fix:**
- Mount `AuthMiddleware(cfg.JWTSecret)` on mutating routes.
- Require JWT on `/vaults/sync`, `/trades/sync`, `PATCH /vaults/:address`.
- Fail startup if `JWT_SECRET` empty or `< 32` bytes.

### 2. Sync endpoints are unauthenticated state machines

Anyone who can POST a valid on-chain signature can:
- create vault rows (`SyncVault`)
- create trade rows + mutate portfolios (`SyncTrade`)

No proof caller owns the wallet. No rate limit on sync (only auth nonce/verify limited).

**Impact:** Fake portfolio history, DoS via RPC fan-out, polluted leaderboards.

**Fix:**
- Require JWT; require `claims.WalletAddress == parsed.Signer` (and manager match on vault init).
- Rate-limit sync per IP + per wallet (Redis).
- Optionally require internal API key for indexer-style sync.

### 3. Solana verification incomplete — wrong program / wrong manager accepted

`SyncVault` / `classifyInstructions`:
- Match instruction **name** via discriminator only.
- **Never check `ix.ProgramID` against configured program id.**
- `SyncVault` takes `manager_address` from **request body**, not from tx accounts/signer.
- Vault address = `ix.Accounts[0]` without account-layout validation.

Any program that happens to share 8-byte disc layout, or any successful tx with similar data shape, can be mis-ingested. Manager can be spoofed on create.

**Fix:**
- Config: `SOLANA_PROGRAM_ID`.
- Reject if `ProgramID != expected`.
- Derive manager from signer / known account index; ignore client-supplied manager unless equal.
- Prefer existing `VerifyDeposit` / `VerifyTradeExecution` instead of ad-hoc classify.

### 4. Money + shares stored as `float64`

Models use `float64` mapped to `numeric(36,18)` for TVL, shares, amounts, prices.

**Impact:** Rounding drift on deposit/withdraw loops; bad for anything finance-shaped in a portfolio demo.

**Fix (POC-pragmatic):** store as string/`shopspring/decimal` or integer base units (lamports/raw token amount). Do math in decimal; only format floats at JSON edge if needed.

### 5. Startup AutoMigrate drops matviews every boot

```go
// internal/database/migrate.go
DROP MATERIALIZED VIEW IF EXISTS user_pnl_summary CASCADE
DROP MATERIALIZED VIEW IF EXISTS portfolio_summary CASCADE
// then GORM AutoMigrate, then recreate from SQL file
```

**Impact:**
- Boot races: reads during migrate see missing views.
- If SQL file path miss → views gone, silent (`readMatviewSQL` err → `return nil`).
- Production anti-pattern; GORM AutoMigrate + DDL through PgBouncer is fragile.

**Fix:**
- Versioned migrations only (`golang-migrate` / goose) against `DIRECT_DATABASE_URL`.
- App boot: connect + ping; **no DDL**.
- Never drop MVs on startup.

### 6. Portfolio / PnL query selects non-existent `vault_name`

```sql
-- portfolio_service.go / pnl_service.go
SELECT ... vault_name ... FROM user_pnl_summary
```

`030_matviews.sql` **does not define `vault_name`**. Query fails → code logs warning and falls back. Cache may store fallback; MV path never actually warms as designed.

Also empty positions: `err == nil && len(details) > 0` means **empty portfolio never uses MV success path cleanly** (always falls through) — OK-ish, but error path masks real SQL bugs.

**Fix:** add `vault_name` (from metadata JSON or address) to MV, or drop column from SELECT. Treat SQL error as hard failure in tests.

---

## P1 — Architecture / correctness

### 7. Dual implementation paths — half-wired clean architecture

| Layer | Exists | Used in `main`? |
|-------|--------|-----------------|
| `domain.*Repository` | yes | no |
| `repository.*` + cache decorator | yes | no |
| Handlers call `*gorm.DB` directly | yes | **yes** |
| `services.UpsertPosition` package funcs | yes | yes (sync) |
| `PortfolioService.Repo` | optional | never set |

**Result:** two portfolio upsert implementations (`pnl_service.UpsertPosition` vs `portfolio_repo.UpsertPosition`) with different edge behavior (e.g. reduce insufficient shares: error vs clamp to 0). Cache decorator keys ≠ service cache keys for some names (`pnl-summary` vs `pnl`).

**Fix for POC:** pick one path:
- **Minimal:** delete unused repo/decorator **or** wire repos in `main` and make handlers thin.
- Do not keep both “for later” in a portfolio repo — looks unfinished.

### 8. Package-level mutable globals

`syncDB`, `syncClient`, `syncEventService`, `syncCache`, `healthDB`, `appConfig` — hard to test, hides deps, races if ever reassigned.

**Fix:** `SyncHandler` struct like `VaultHandler`; inject in router `HandlerSet`.

### 9. JWT duplicated + weak validation

- `handlers.AuthClaims` and `middleware.Claims` duplicate.
- Signing method check uses `*jwt.SigningMethodHMAC` (accepts HS384/512), not strict HS256.
- No `Issuer`/`Audience`.
- 24h access token, no refresh, no revoke/blacklist.
- Empty secret → HMAC with empty key (tokens forgeable if secret known empty).

**Fix:** single token package; strict `jwt.SigningMethodHS256`; required secret; shorter access TTL.

### 10. Deposit/withdraw accounting bugs

In `classifyInstructions`:
- Deposit: `amountOut = amountIn`, `priceAtExecution = 1.0` (not real shares minted).
- Withdraw: only `shares`; **`amount_out` never set** → realized PnL in MV stays wrong (noted in SQL comments).
- Trade create + portfolio update **not in one DB transaction** → trade row can exist without portfolio update (or reverse on partial failure). Comment about PgBouncer is valid for RPC span, but **local DB writes must still be transactional**.

**Fix:** parse real share amounts from ix/logs; `db.Transaction` for trade+portfolio; re-check unique signature inside tx.

### 11. Rate limiter does not rate limit

```go
// middleware/ratelimit.go
l.Take()  // blocks until token — never 429
c.Next()
```

Also:
- in-memory map grows forever (no TTL GC) → memory leak under IP spoofing.
- `uber/ratelimit` is leaky bucket for pacing, not HTTP admission control.
- No `SetTrustedProxies` → `ClientIP()` spoofable behind reverse proxy.

**Fix:** token bucket / sliding window that **rejects** with 429 + headers; Redis for multi-instance; set trusted proxies; GC or LRU limiter map.

### 12. WebSocket: open subscribe any channel

- Origin allowlist OK-ish; empty Origin allowed (`return origin == ""`) → non-browser clients always OK.
- No auth on `/ws`.
- Client can `subscribe` to `portfolio:<any wallet>` or any string — no ACL.
- Hub `BroadcastToChannel` holds `RLock` while sending; slow clients + `go unregister` under lock is awkward; double-close risk on `send` if unregister races.

**Fix:** auth query/header token before upgrade; bind subscriptions to authenticated wallet; cap subs per conn; don’t hold hub lock across send.

### 13. Vault in-process cache not stopped / not in health

`VaultService` starts `cleanupLoop`; `main` never calls `Stop()`. Graceful shutdown closes hub/DB/worker only.

### 14. Health check incomplete

`/health` pings DB only. No Redis. No distinction live vs ready. Always 200 shape with `success` even when degraded paths matter for k8s later.

---

## P2 — Performance / scalability

### 15. What is actually optimized vs aspirational

| Feature | Status |
|---------|--------|
| PgBouncer | compose ready; app must use `:6432` |
| Redis cache-aside | wired for portfolio service if Redis up |
| Matviews + refresh worker | yes, but query column bug + drop-on-migrate |
| Composite indexes `020_*.sql` | **manual** — not applied by AutoMigrate |
| Timescale hypertables `010_*.sql` | **manual**; price history barely used in API |
| Repo cache decorator | **not in request path** |
| Handler list endpoints | direct GORM + `OFFSET` |

### 16. Hot path costs

- `ListVaults` / `GetTrades`: `COUNT(*)` + `OFFSET` — fine for POC, dies at large offsets.
- `GetVault`: 1 get + 2 counts — no single query / no cache (VaultService caches vault row only).
- `invalidateVaultPortfolioCaches`: pluck all holder user IDs + N DELs — OK small N; needs pipeline/UNLINK later.
- Cache stampede: no singleflight on portfolio miss.
- Solana RPC 30s timeout on public mainnet URL — sync latency + abuse vector.
- `BatchRecalculate` spawns **unbounded goroutines** per position.

### 17. float + MV refresh staleness

MV refresh default 5m. Cache TTL 30s. Product may show 3 different PnL numbers (live calc vs cache vs MV) depending on path. Document or unify.

### 18. JSON middleware sets Content-Type globally

Including errors and potentially WS upgrade path side effects — minor; prefer set only on JSON writers (already done in `writeJSON`).

---

## P3 — Security / ops / hygiene

### 19. Secrets & deploy surface

- `.env` gitignored (good). Example uses `postgres/postgres`, open ports `5432/6432/6379` on host.
- Redis: no `requirepass`, no bind lockdown in conf.
- PgBouncer `userlist.txt` plaintext `postgres/postgres` in repo.
- `ENABLE_PPROF` mounts `/debug/pprof` on **same public engine** with no auth.
- Default `SOLANA_RPC_URL` = public mainnet (rate limits, no auth).
- No request body size limit middleware.
- `Sanitize()` util unused on metadata strings (XSS less critical for JSON API, still good for stored display fields).

### 20. No app container / CI

- `docker-compose` = data plane only (DB/pool/redis).
- No backend `Dockerfile`, no `.github/workflows` for `go test`/`vet`.
- No migrate job in compose.

### 21. Observability thin

- logrus JSON in main — good start.
- gin default logger, not request-id / slog correlated.
- No metrics (Prometheus): RPC latency, cache hit ratio, MV refresh duration (logged only), 429s.
- No OpenTelemetry.

### 22. Config gaps

Missing first-class config for: `REDIS_URL`, `CORS_ORIGINS`, `SOLANA_PROGRAM_ID`, `MV_REFRESH_INTERVAL`, JWT TTL, trusted proxies, body limits. Several read `os.Getenv` ad hoc inside packages.

### 23. Minor code smells

- `uuid.MustParse` in repos → panic on bad input (should be 400).
- `errors.Is` vs `err == gorm.ErrRecordNotFound` inconsistent.
- Wallet address not validated on Nonce (any string creates user row) — spam table.
- Nonce has no expiry/TTL.
- Signature verify: base64 only; some wallets use base58 sigs.
- `middleware.VerifySignature` hex-based; auth handler base58/base64 — dead/confusing dual.
- `go 1.25.0` in go.mod — ensure local/CI toolchain matches (exotic for many machines).

---

## Test reality

| Covered | Missing |
|---------|---------|
| JWT middleware unit | Handler HTTP tests (auth, sync, vault, portfolio) |
| Cache get/set/del | SyncHandler with mocked Solana client |
| PnL upsert/reduce math (sqlite) | End-to-end auth nonce→verify→PATCH |
| MV repo tests (conditional) | Migration apply CI |
| Jobs interval | Race tests on hub / portfolio concurrent sync |
| k6 scripts (manual) | Contract tests vs frontend types |

`go test ./...` — **83 passed**. That proves islands work, not that the product path is correct.

---

## “Does everything work?”

| Path | Likely state |
|------|----------------|
| Health + config GET | Works |
| Auth nonce/verify | Works if DB up + JWT secret set |
| List/get vaults | Works if migrated |
| PATCH vault metadata | **Broken** without mounted auth |
| Portfolio GET | Works via fallback; MV path buggy (`vault_name`) |
| Trade list | Works |
| Sync vault/trade | “Works” technically; **unsafe / incomplete verify** |
| WS | Connects; events only if something dispatches + client subscribes |
| Redis optional | Degrades (good) |
| Indexes/hypertables | Only if someone ran SQL manually |

---

## Target architecture (POC-sized, not enterprise cosplay)

```
cmd/server/main.go          wire only
internal/config             all env, validate
internal/http/api           router + middleware
internal/http/handlers      bind → service → response
internal/app/...            use-cases (sync, portfolio, auth)
internal/domain             entities + ports
internal/adapters/postgres  repos
internal/adapters/redis     cache
internal/adapters/solana    rpc + parse
internal/adapters/ws        hub
migrations/                 only DDL path
```

**Rules:**
1. Handlers never see `*gorm.DB`.
2. One write path for positions.
3. Sync: verify chain → authz → single DB tx → invalidate → event.
4. Migrations never in request process.

---

## Prioritized fix backlog

### Week 0 (credibility)

1. Mount JWT auth on mutations; reject empty JWT secret at boot.
2. Authz on sync: signer == JWT wallet; program id check.
3. Stop AutoMigrate/drop-MV on boot; document `psql` migrate order.
4. Fix `user_pnl_summary` / SELECT column mismatch.
5. Transaction around trade + portfolio writes.
6. Strict HS256 + single claims type.
7. Rate limit that returns **429** on auth + sync.

### Week 1 (architecture honesty)

8. Wire **one** repository path; delete or quarantine dead decorator keys mismatch.
9. Struct-inject sync/health/config (no globals).
10. Decimal/raw amounts for shares + USDC-like values.
11. WS auth + subscription ACL.
12. Handler tests for auth + sync happy/abuse cases.
13. Dockerfile + CI `go test -race ./...`.

### Week 2 (polish / scale story)

14. Apply `020` indexes in migrate pipeline; cursor pagination.
15. Singleflight cache; Redis auth in compose.
16. Metrics + request ID.
17. pprof on localhost only or basic auth.
18. Nonce TTL + wallet address validation.
19. Stop vault cache worker on shutdown; ready probe = db+redis.

---

## Complexity budget note

For a **portfolio POC**, you already paid for: matviews, PgBouncer, Timescale, cache decorators, domain repos, k6, explain SQL.

That’s impressive **if wired and correct**. Right now half the sophistication is disconnected while P0 auth/sync holes remain. Recruiters who open `router.go` will see open sync + unused `AuthMiddleware` in one screen.

**Recommendation:** prefer **fewer moving parts, all connected**, over more infra diagrams. Nail verification + auth + one portfolio path; then keep MV/Redis as the performance chapter.

---

## Evidence index (key files)

| Topic | Where |
|-------|--------|
| Router / missing auth | `internal/router/router.go` |
| Auth MW unused | `internal/middleware/auth.go` |
| Sync open + weak verify | `internal/handlers/sync_handler.go` |
| JWT issue | `internal/handlers/auth_handler.go`, `internal/config/config.go` |
| Drop MV on boot | `internal/database/migrate.go` |
| Rate limit block not reject | `internal/middleware/ratelimit.go` |
| WS origin/auth | `internal/handlers/ws_handler.go`, `internal/ws/*` |
| float money | `internal/models/*.go` |
| MV definition | `migrations/030_matviews.sql` |
| Bad SELECT | `internal/services/portfolio_service.go`, `pnl_service.go` |
| Unwired repos | `internal/repository/*`, `cmd/server/main.go` |
| Cache key split | `internal/cache/keys.go` vs `repository/cache_decorator.go` |
| Shutdown | `internal/server/graceful.go`, `cmd/server/main.go` |

---

## Final grades summary

**Good POC skeleton. Weak product integrity.**

Ship story today: “Go API + Solana verify + Timescale/Redis.”  
Honest story: “Layers and infra started; auth not enforced; sync trust model incomplete; clean architecture not wired; tests don’t cover HTTP.”

Close P0 list → backend becomes a strong portfolio piece. Ignore P0 → optimization work is lipstick.
