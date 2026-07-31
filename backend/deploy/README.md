# Backend Infra — TimescaleDB + PgBouncer + Redis

Owned by Subagent 1 (infra). Provisioned via `docker compose up -d` from the
backend root.

## Topology

```
                        ┌──────────────────────────────────────────┐
                        │         docker compose (backend/)         │
                        │                                          │
 app (Go, GORM/pgx)     │   ┌─────────────────┐     ┌────────────┐ │
   │                    │   │    pgbouncer    │────▶│ timescaledb│ │
   │  DATABASE_URL ─────┼──▶│  :6432 (pool)   │     │  :5432     │ │
   │  (runtime traffic) │   │  transaction    │     │  pg16      │ │
   │                    │   └─────────────────┘     └────────────┘ │
   │                    │                                          │
   │  DIRECT_DATABASE_URL ────────────────────────▶ :5432          │
   │  (migrations/DDL only, bypasses pool)                         │
   │                    │                                          │
   │  REDIS_URL ────────┼──▶ redis :6379  (cache-aside layer)     │
   │                    │                                          │
                        └──────────────────────────────────────────┘
```

## Services

| Service     | Image                          | Port (host) | Purpose                          |
|-------------|--------------------------------|-------------|----------------------------------|
| timescaledb | timescale/timescaledb:latest-pg16 | 5432      | Primary DB + `timescaledb` ext    |
| pgbouncer   | edoburu/pgbouncer:latest       | 6432        | Transaction pool in front of DB  |
| redis       | redis:7-alpine                 | 6379        | Cache layer (agent 6+)           |

Volumes: `timescaledb_data`, `redis_data` (named, survive restarts;
`docker compose down -v` destroys them).

## Why transaction pooling

Gin serves many concurrent requests; GORM/pgx opens one DB connection per
concurrent query. Under a read burst, 1000 clients would demand 1000 Postgres
connections (each ~10 MB of memory) and blow past `max_connections`.

PgBouncer in `pool_mode = transaction` interposes a small pool (20 backend
connections by default, 1000 client slots). A backend connection is borrowed
only for the duration of one transaction, then returned — so read-path bursts
**queue** at the pool instead of exhausting the database. Write-path caveat
(agent 8): never hold a DB transaction open across external calls (Solana RPC)
— with transaction pooling you would hold a scarce pooled connection hostage.

## How agents 2-5 must apply SQL migrations

**Always run migrations against `timescaledb:5432` DIRECT, never through
PgBouncer.** Migrations are long-running DDL (`CREATE EXTENSION`,
`create_hypertable`, `CREATE INDEX`, `CREATE MATERIALIZED VIEW`); inside a
transaction pool they would monopolize pooled connections, violate the
transaction contract, and pgbouncer may close idle-in-transaction connections.

```bash
# direct connection (bypasses pgbouncer):
psql "$DIRECT_DATABASE_URL" -f migrations/002_hypertables.sql

# or inside the container:
docker compose exec timescaledb psql -U postgres -d fbyt -f /dev/stdin <<'SQL'
SELECT create_hypertable('trade_histories', 'executed_at');
SQL
```

Prerequisite: the `timescaledb` extension is enabled by
`deploy/timescaledb/init.sql` (runs on first container start) and the license
GUC is set (`timescaledb.license=timescale`). Verify:
`SELECT extversion FROM pg_extension WHERE extname='timescaledb';`

Do **not** point `DATABASE_URL` at 5432 for runtime code — agents 6-9 must use
the PgBouncer URL from `.env.example`.

## PgBouncer caveats (read before writing SQL/Go)

- **No session-level state.** Transaction pooling + `DISCARD ALL` reset means:
  temp tables, session variables (`SET ...`), advisory locks, `LISTEN/NOTIFY`,
  `SELECT pg_advisory_*` do **not** survive between statements. Agent 9 must
  keep all work inside single transactions.
- **Prepared statements** work since PgBouncer 1.17 (`max_prepared_statements
  = 100` in `pgbouncer.ini`). GORM/pgx prepare statements; if errors appear,
  append `?default_query_exec_mode=simple_protocol` to `DATABASE_URL`.
- **Auth** is SCRAM (`auth_type = scram-sha-256`, `userlist.txt` holds
  `"postgres" "postgres"`). PG16 stores SCRAM verifiers only, so md5 auth
  would fail.
- **No SSL inside the compose network** — `sslmode=disable` everywhere.

## Useful commands

```bash
docker compose up -d                    # start all three services
docker compose ps                       # health status
docker compose logs -f pgbouncer        # pool logs
docker compose exec pgbouncer psql -h 127.0.0.1 -p 6432 -U postgres -d fbyt -c 'SHOW POOLS;'
docker compose exec redis redis-cli info stats
```
