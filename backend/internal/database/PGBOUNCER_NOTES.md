# PgBouncer Safety Notes

Audit date: 2026-07-31. Target: `pool_mode = transaction` (transaction pooling).

## Verdict: pool-safe

`internal/database/*` and `internal/repository/*` contain no session-level
state. No advisory locks, no `SET`/`RESET` session commands, no LISTEN/NOTIFY,
no temp tables, no cursors. All repository statements are single-roundtrip
(no explicit BEGIN/COMMIT held open). GORM's default `PrepareStmt=false`
means no server-side prepared statements are kept across pooled connections.

Pool settings in `ConnectWithRetry` (MaxOpenConns 25, MaxIdleConns 5,
ConnMaxLifetime 5m) are appropriate for transaction pooling; the pool is
smaller than the PgBouncer connection budget, so no starvation.

## Rules

Allowed (safe under transaction pooling):

- Single-statement queries and writes.
- Transactions that COMMIT/ROLLBACK quickly within one request
  (`db.Transaction`); never wrap external API/RPC calls in them.
- Startup DDL (`AutoMigrate`) — commits immediately, does not pin sessions.

Forbidden (breaks or misbehaves under transaction pooling):

- `SET SESSION` / `SET ROLE` / `SET search_path` — the connection is reset
  when returned to the pool, the setting silently disappears.
- `LISTEN` / `NOTIFY` — notifications are delivered to the physical
  connection; a pooled connection is not a stable listener.
- `pg_advisory_lock()` outside an explicit transaction — the lock outlives
  the pooled session and is never released cleanly.
- Cursors or temp tables created outside an explicit transaction.
- Long-held transactions around external calls (Solana RPC, HTTP) — pins a
  pool connection for the duration (opt.md Task 8.4).

## If session features are ever needed

- Advisory locks: use `pg_advisory_xact_lock()` inside a short transaction
  (released on COMMIT/ROLLBACK).
- Anything session-scoped: move it to a dedicated `pool_mode = session`
  database or a direct (non-PgBouncer) connection. `server_reset_query`
  alone cannot save you from leaked session state.

## Configuration recommendations

- `pool_mode = transaction`
- `server_reset_query = DISCARD ALL` (clears session state on return)
- `server_idle_timeout = 300` (seconds)
- Keep the app pool smaller than PgBouncer's `default_pool_size`; oversized
  app pools cause queueing, not throughput.
