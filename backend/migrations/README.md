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
