# Materialized View Refresh Worker

Background worker that keeps `portfolio_summary` and `user_pnl_summary`
(see `migrations/030_matviews.sql`) fresh so read endpoints can serve
pre-aggregated data without re-running heavy queries.

## Refresh cadence

- First refresh runs immediately on `Start`.
- Then one refresh every interval: constructor `interval` if > 0, otherwise
  `MV_REFRESH_INTERVAL` (seconds), otherwise **5 minutes** default.
- Views refresh sequentially in a single goroutine: `portfolio_summary`
  first, then `user_pnl_summary`. A failed refresh is logged and does not
  block the remaining views or crash the app.

## Why CONCURRENTLY

Plain `REFRESH MATERIALIZED VIEW` takes an `ACCESS EXCLUSIVE` lock on the
view, blocking concurrent reads (our API requests). `... CONCURRENTLY`
takes only a share lock, so API reads are never blocked — but it requires a
UNIQUE index on the view, which is why agent 4 created unique indexes on
`vault_id` (`portfolio_summary`) and `user_id` (`user_pnl_summary`). If
those indexes are missing the refresh errors loudly instead of silently
falling back to a blocking refresh — the log line
`materialized view refresh failed` will say so.

## Staleness SLA

Views are at most ~5 minutes stale (`MV_REFRESH_INTERVAL` seconds). This
matches the read-path assumption of agents 4 + 7: trades land in the base
tables immediately, and the aggregate views converge within one interval.

## Telemetry

Every refresh emits:

- `INFO materialized view refreshed` with fields `view` and `duration_ms`.
- `ERROR materialized view refresh failed` with `view` and the wrapped error
  (e.g. lock timeouts, missing unique index).

## Integration (main.go)

```go
worker := jobs.NewMVRefreshWorker(db, logger, 0) // 0 => env/default interval
worker.Start(ctx)                                // non-blocking
defer worker.Stop()                              // during graceful shutdown
```

No new dependencies beyond stdlib, `gorm.io/gorm`, and `sirupsen/logrus`.
