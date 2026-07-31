# Load Tests (k6)

k6 scripts that exercise the read paths affected by the backend optimizations
(opt.md): portfolio reads, PNL computation, vault listing/detail, and vault
trades. They are the **acceptance gate** — before/after numbers prove whether
the B-tree indexes (agent 3), materialized views (agent 4), PgBouncer (agent 1),
and the Redis cache (agents 6-8) actually helped.

## Files

| File | Endpoint(s) | What it stresses |
|---|---|---|
| `portfolio_reads.k6.js` | `GET /api/v1/portfolio/:wallet` (70%), `GET /api/v1/vaults` (30%), optionally `GET /api/v1/vaults/:address` + `GET /api/v1/vaults/:address/trades` | Mixed marketplace browse: user lookup + preload, share aggregation, vault counts, trade paging |
| `pnl_reads.k6.js` | `GET /api/v1/portfolio/:wallet` (100%) | The PNL read path. PNL is computed per position (`pnl`, `pnl_percent`, `current_value`) inside `PortfolioHandler.GetPortfolio` — there is no dedicated `/pnl` route yet. If one lands, pass `-e PNL_PATH=/api/v1/pnl` |

## Prerequisites

- k6 >= 0.49 (`k6 version`)
- Access to the running API (default `http://localhost:8080`, override `-e BASE_URL=...`)
- Wallets that exist in the DB. Default is a synthetic pool of 100 addresses —
  they **404 unless seeded**. Either:

  - Seed them (recommended, reproducible):
    ```sql
    -- optional: synthetic users so default runs return 200
    INSERT INTO users (wallet_address, nonce)
    SELECT '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz' || i::text, ''  -- illustrative; use real 44-char addresses
    FROM generate_series(1, 100) i
    ON CONFLICT (wallet_address) DO NOTHING;
    ```
  - Or pass real addresses that exist in the DB:
    ```bash
    k6 run -e WALLETS=<addr1>,<addr2>,<addr3>,... tests/load/pnl_reads.k6.js
    ```

- For vault detail/trades traffic in `portfolio_reads.k6.js`, pass existing
  vault addresses: `-e VAULTS=<addr1>,<addr2>`. Without it, the script only
  hits portfolio + vault list (which never 404).

## Auth

`AuthMiddleware` (JWT, `Authorization: Bearer <token>`) exists in
`internal/middleware/auth.go` but is **not mounted on any route** in
`internal/router/router.go` — all read endpoints are currently public and the
scripts run without a token. If auth gets wired to read routes later, generate
a token with the server's `JWT_SECRET` and pass it:

```bash
k6 run -e AUTH_TOKEN=<jwt> tests/load/portfolio_reads.k6.js
```

## Run

```bash
# baseline (run against the current build BEFORE optimizations)
mkdir -p results
k6 run --out json=results/before_portfolio.json tests/load/portfolio_reads.k6.js
k6 run --out json=results/before_pnl.json        tests/load/pnl_reads.k6.js

# after optimizations are deployed (same commands, different labels)
k6 run --out json=results/after_portfolio.json  tests/load/portfolio_reads.k6.js
k6 run --out json=results/after_pnl.json        tests/load/pnl_reads.k6.js
```

Use the same machine/DB seed for before and after runs, or results are
meaningless. Also see `docs/performance/README.md` for the full validation
runbook (monitoring snapshot + load tests + EXPLAIN compare).

## Comparing results

Extract the numbers from the JSON output with `jq`:

```bash
# latency percentiles + error rate for the whole script
jq '.metrics.http_req_duration.values | {med, "p(90)", "p(95)", "p(99)"}' results/before_portfolio.json
jq '.metrics.http_reqs.values | {rate, passes, fails}'                       results/before_portfolio.json

# per-endpoint latency (tags: portfolio, vault_list, vault_detail, trades, pnl)
jq '.metrics["http_req_duration{name:portfolio}"] | {med, "p(95)"}'         results/before_portfolio.json

# per-endpoint request rate
jq '.metrics["http_reqs{name:portfolio}"].values.rate'                      results/before_portfolio.json
```

## Record these metrics per run (fill into docs/performance/README.md table)

| Metric | Where |
|---|---|
| p95, p99 latency (overall + per endpoint) | `http_req_duration` values |
| Error rate | `http_req_failed` (or `passes/fails`) |
| Requests/sec (overall + per endpoint) | `http_reqs` rate |
| Backend DB: seq scans, cache hit ratio | `scripts/monitoring.sql` |
| PgBouncer queue: `cl_waiting`, `avg_wait_time` | `SHOW STATS;` / `SHOW POOLS;` |
| Redis hit ratio | `redis-cli INFO stats` (see docs/performance/README.md) |

## Thresholds

Both scripts set:

```js
thresholds: {
  http_req_failed: ['rate<0.01'],
  'http_req_duration{...}': ['p(95)<500', 'p(99)<1000'],
}
```

`p(95) < 500ms` is an **aspirational post-optimization goal** — expect the
baseline run to fail it. Don't treat a red summary line as "broken"; the
before/after delta is the signal.
