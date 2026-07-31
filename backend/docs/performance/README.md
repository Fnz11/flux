# Performance Validation Suite (Acceptance Gate)

Proves whether the opt.md optimizations worked. The load tests in
`tests/load/`, the runtime metrics in `scripts/monitoring.sql`, and agent 3's
`scripts/explain_analyze.sql` are three views of the same question: **did reads
get faster and did the DB stop doing dumb work?**

Everyone's changes (indexes, materialized views, PgBouncer, Redis, MV refresh
workers) are judged here. If a metric is red, the owning agent's section below
says who to report it to.

## Prerequisites

- k6 (`tests/load/README.md` has setup + run details)
- `psql` (Postgres 16)
- `redis-cli`
- PgBouncer console access (`psql -p 6432 -U pgbouncer pgbouncer`)

## The Validation Runbook

Run in this order, twice (baseline then post-optimization). Use the same
machine, same DB seed, and same load params for both passes.

### Phase 0 — Baseline snapshot (before any changes)

```bash
psql "$DATABASE_URL" -c "SELECT pg_stat_reset();"
redis-cli INFO stats | grep -E "keyspace_(hits|misses)"   # record start counters
psql "$DATABASE_URL" -f scripts/monitoring.sql > snapshots/monitoring_before.sql
```

`pg_stat_reset()` clears cumulative counters so the snapshot only reflects the
test window. Note: this requires superuser; if you can't reset, run the load
test, snapshot, then run it again after and diff the deltas.

### Phase 1 — Load tests (before)

```bash
mkdir -p results
k6 run --out json=results/before_portfolio.json tests/load/portfolio_reads.k6.js
k6 run --out json=results/before_pnl.json        tests/load/pnl_reads.k6.js

# immediately after, capture the "during" state:
psql "$DATABASE_URL" -f scripts/monitoring.sql > snapshots/monitoring_during_before.sql
redis-cli INFO stats | grep -E "keyspace_(hits|misses)"   # record end counters
```

The Redis counters are cumulative — hit ratio is computed from the
start/end delta (formula below).

### Phase 2 — Apply optimizations

Deploy agents 1-8 (PgBouncer, indexes, MVs, cache, refresh workers) per opt.md.

### Phase 3 — Re-validate (after)

Repeat Phase 0's reset, then Phase 1 with `after_*` labels:

```bash
psql "$DATABASE_URL" -c "SELECT pg_stat_reset();"
k6 run --out json=results/after_portfolio.json tests/load/portfolio_reads.k6.js
k6 run --out json=results/after_pnl.json        tests/load/pnl_reads.k6.js
psql "$DATABASE_URL" -f scripts/monitoring.sql > snapshots/monitoring_after.sql
```

### Phase 4 — EXPLAIN compare

For the hot queries (portfolio aggregation, vault list, trades paging, PNL),
run agent 3's `scripts/explain_analyze.sql` before and after and diff:
before should show `Seq Scan` on `portfolios` / `trade_histories` / `users`;
after should show `Index Scan` (agent 3) or `Materialized Scan` (agent 4) with
drastically fewer buffers.

## Metrics Table — fill in per validation pass

| Metric | Where to get it | Before | After | Verdict (good = ...) |
|---|---|---|---|---|
| p95 latency — portfolio | `http_req_duration{name:portfolio}` in results JSON | | | < 500ms (aspirational) |
| p95 latency — PNL | `http_req_duration{name:pnl}` | | | < 500ms (aspirational) |
| p99 latency — overall | `http_req_duration` p(99) | | | < 1000ms |
| Error rate | `http_req_failed` rate | | | < 1% |
| Throughput (req/s) | `http_reqs` rate | | | no regression |
| Seq scans on portfolios/trade_histories/users | monitoring.sql §1 | | | near 0 / idx_scan dominates |
| Table cache hit ratio | monitoring.sql §2 | | | > 99% |
| PgBouncer `cl_waiting` / `avg_wait_time` / `maxwait` | `SHOW STATS; SHOW POOLS;` | | | 0 / ~0ms / < 100ms |
| Backend connections to Postgres | monitoring.sql §4 | | | stable, small (pool), not 1/request |
| Top slow query mean_ms | monitoring.sql §5 | | | portfolio/PNL queries drop or vanish |
| Redis hit ratio | `redis-cli INFO stats` delta | | | > 0.9 steady-state (30-60s TTLs) |
| MV refresh duration | agent 5's telemetry | | | refresh < interval |

## Cache-Hit Measurement (Redis)

Counters are cumulative since server start — always take the delta across a
test window:

```bash
redis-cli INFO stats          # keyspace_hits, keyspace_misses
```

```
hit_rate = (hits_end - hits_start) / ((hits_end - hits_start) + (misses_end - misses_start))
```

- **First load pass is a warm-up** (populates the 30-60s TTL keys). Measure the
  second pass for steady state.
- `hit_rate < 0.7`: TTLs too short or read path bypassing the cache → report to
  agents 6/7/8 (raise TTL, verify cache-aside wiring).
- `hit_rate ~1.0`: possibly stale data; if freshness matters, report to agents
  6/8 (shorten TTL, or invalidate on write more aggressively).
- To see which keys are hot: `redis-cli --scan --pattern "app:*"` then
  `redis-cli --bigkeys` for size anomalies.

## Verdict Ownership

| Symptom | Likely cause | Report to |
|---|---|---|
| seq scans persist, p95 still slow | index not used / missing | agent 3 |
| portfolio/PNL slow but DB is idle | query not reading MV | agent 4 (SQL) + agent 7 (read path) |
| `cl_waiting` climbs at 200 VUs | PgBouncer pool too small | agent 1 |
| `idle_in_transaction` > 0 | app holds txns across calls | agent 8 |
| Redis hit ratio low | TTLs / cache-aside wiring | agents 6/7/8 |
| MV data stale after load | refresh interval too long | agent 5 |
| Everything green except p95 marginal | fine — record and ship | — |

## Passing Criteria

The optimization work ships when, comparing the after row to the before row:

1. Error rate stays < 1% at 200 VUs.
2. Throughput is not lower than baseline.
3. Seq scans on hot tables drop materially (target: idx_scan dominates).
4. Cache hit ratio (Postgres) > 99% and Redis hit ratio > 0.9.
5. p95 improves (toward the 500ms goal) with no regression on freshness
   (MV lag + cache staleness acceptable per product tolerances).
