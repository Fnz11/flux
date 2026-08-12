# Migrations

Manual SQL migrations for the FBYT-Clone backend. Base tables (`users`, `vaults`,
`portfolios`, `trade_histories`) are created by GORM AutoMigrate at app startup
(`internal/database/migrate.go`); the numbered scripts below are additive
optimizations that must run **after** the first boot (or after AutoMigrate has
created the base tables).

## Ordering rules

Run strictly in numeric order. Each agent owns its own numbers — do not
renumber.

| # | File | Agent | Purpose |
|---|------|-------|---------|
| 010 | `010_timescale_hypertables.sql` | 2 (this) | TimescaleDB extension, hypertables, retention, OHLCV continuous aggregate |
| 020 | `020_*.sql` | 3 | B-tree indexes |
| 030 | `030_*.sql` | 4 | Materialized views |
| 040 | `040_compression_policy.sql` | 5 | Compression on hypertables + OHLCV CAGG index fix (2.10) |
| 050 | `050_cagg_trade_volume.sql` | 5 | `cagg_trade_volume_1h` continuous aggregate for trade volume |
| 060 | `060_missing_indexes.sql` | 5 | Missing B-tree/partial/covering/BRIN indexes (1.4) |
| 070 | `070_notifications.sql` | 6 (this) | `notifications` table for notification storage |
| 080 | `080_global_metrics_cagg.sql` | 10 | `cagg_global_volume_1h`/`cagg_global_tvl_1h`/`cagg_global_ath_price_1h` continuous aggregates (global metrics) |

### 070 note

`070_notifications.sql` creates the `notifications` table (per-user storage for
trade/vault events), plus the `idx_notifications_user_created` (newest-first)
and `idx_notifications_user_unread` (partial, unread count) indexes. It is
additive and idempotent — the table create and constraints are guarded by
`to_regclass` checks and indexes use `IF NOT EXISTS` — so re-running after a
failure is safe. It runs **after** AutoMigrate has created the base `users`
table (the FK to `users` is only added if `users` exists, guarded via
`to_regclass`), so it is ordered after 060. The base table can also be created
by GORM AutoMigrate at startup (see `internal/database/migrate.go`); the script
only fills any gaps and is safe to run either before or after boot.

Why 010 first:

1. **Extension first** — `CREATE EXTENSION timescaledb` must precede any
   `create_hypertable` call.
2. **Hypertables before indexes** — 010 re-declares primary/unique constraints
   to include the partitioning time column. Indexes (020) created after
   conversion propagate to all chunks; an index script that runs first would
   have to be re-run or would miss the constraint normalization.
3. **Hypertables before materialized views** — agent 4's matviews aggregate
   `trade_histories`/`portfolio` data; 030 may also reference the OHLCV cagg
   created here, and chunk pruning (what makes matview refreshes fast) only
   exists after 010.
4. **040/050/060 run AFTER 010/020/030** — agent 5's scripts depend on artifacts
   from earlier migrations:
   - `040_compression_policy.sql`: enables compression on the hypertables from
     010 and adds the vault-first index on `cagg_price_ohlcv_1h` (from 010). It
     must run after 010 (hypertables + OHLCV cagg must exist); 020/030 order
     only matters for index-maintenance cost, not correctness.
   - `050_cagg_trade_volume.sql`: builds `cagg_trade_volume_1h` on `trade_histories`
     (a hypertable from 010), so it must follow 010 and 030.
   - `060_missing_indexes.sql`: the BRIN indexes and partial price index need
     the hypertable / table structure from 010; the vaults indexes need the
     base tables from AutoMigrate (guaranteed by 010's timing).

## How to run

```bash
# Direct PostgreSQL connection ONLY — never through PgBouncer (port 6432).
# PgBouncer in transaction pooling mode does not support DDL: each statement
# can land on a different server connection, and session-level state
# (SET lock_timeout, extension session state) is not carried across.
psql "$DATABASE_URL" -f migrations/010_timescale_hypertables.sql
```

- Use the app's `DATABASE_URL` but point it at **5432**, not 6432.
- 010 is idempotent: all statements are guarded (`IF NOT EXISTS`,
  `to_regclass` checks, job-existence checks). Re-running after a failure is
  safe.
- Requires TimescaleDB >= 2.13 in the Postgres image (agent 1's compose).
  `CREATE EXTENSION IF NOT EXISTS timescaledb` fails on a vanilla postgres
  image — use `timescale/timescaledb:latest-pg16` (or newer).

## Conventions

- Always set `SET lock_timeout` at the top of migration files — never block
  production traffic.
- Guard every statement so partial/failed runs can be re-executed.
- `numeric(36,18)` for money/price columns, `timestamptz` for all timestamps.
- Never run migrations through PgBouncer, cron workers, or app startup —
  run them manually with `psql` on 5432 during a maintenance window.
