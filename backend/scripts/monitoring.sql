-- ============================================================================
-- monitoring.sql — RUNTIME performance metrics (acceptance gate for opt.md)
-- ============================================================================
-- Complements scripts/explain_analyze.sql (agent 3, EXPLAIN plans): this file
-- measures what actually HAPPENS under load, not what the planner intends.
--
-- Run against the app database on Postgres 16:
--   psql "$DATABASE_URL" -f scripts/monitoring.sql
--
-- Important: pg_stat_* counters are CUMULATIVE since the last stats reset.
-- For a clean before/after comparison:
--   1. Run:    SELECT pg_stat_reset();          (as superuser, pre-test window)
--   2. Warm up the cache, then run the load test (tests/load/*.k6.js).
--   3. Immediately after the test, run this file. Snapshot the output.
-- Then repeat for the "after" run and diff the two snapshots.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Overall database health
-- ---------------------------------------------------------------------------
SELECT
  datname,
  numbackends                          AS connections_in_use,
  blks_hit + blks_read                 AS total_blocks,
  round((blks_hit::numeric / NULLIF(blks_hit + blks_read, 0)) * 100, 2)
                                       AS cache_hit_pct,
  xact_commit,
  xact_rollback,
  deadlocks,
  conflicts
FROM pg_stat_database
WHERE datname = current_database();
-- GOOD: cache_hit_pct >= 99%. 90-99% = working set larger than shared_buffers.
-- < 90% means the cache layer is doing nothing useful. deadlocks should be 0.

-- ---------------------------------------------------------------------------
-- 1. Sequential scans vs index scans per user table
-- ---------------------------------------------------------------------------
SELECT
  relname,
  seq_scan,
  seq_tup_read,
  idx_scan,
  round(seq_tup_read::numeric / NULLIF(seq_tup_read + idx_scan, 0) * 100, 1)
                                       AS seq_read_pct,
  n_tup_ins,
  n_tup_upd,
  n_tup_del
FROM pg_stat_user_tables
ORDER BY seq_scan DESC;
-- GOOD: on hot tables (vaults, portfolios, trade_histories, users) idx_scan
-- should dwarf seq_scan and seq_read_pct should be near 0 after indexes (agent
-- 3) land. A high seq_scan on a small table (e.g. config) is fine — sequential
-- scan is correct there. Judge tables by rows scanned (seq_tup_read), not just
-- count.

-- ---------------------------------------------------------------------------
-- 2. Table cache hit ratio (shared_buffers effectiveness per table)
-- ---------------------------------------------------------------------------
SELECT
  relname,
  heap_blks_read,
  heap_blks_hit,
  round((heap_blks_hit::numeric / NULLIF(heap_blks_hit + heap_blks_read, 0)) * 100, 2)
                                       AS heap_cache_hit_pct,
  idx_blks_read,
  idx_blks_hit,
  round((idx_blks_hit::numeric / NULLIF(idx_blks_hit + idx_blks_read, 0)) * 100, 2)
                                       AS index_cache_hit_pct
FROM pg_statio_user_tables
WHERE heap_blks_hit + heap_blks_read > 0
ORDER BY heap_blks_read DESC;

-- Overall (database-wide) cache hit ratio:
SELECT
  round((sum(heap_blks_hit)::numeric / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0)) * 100, 2)
                                       AS table_cache_hit_pct
FROM pg_statio_user_tables;
-- GOOD: > 99% per hot table and overall. < 90% on trade_histories/portfolios
-- after the MV work (agent 4) suggests the materialized views aren't being
-- used by the query planner or shared_buffers is undersized.

-- ---------------------------------------------------------------------------
-- 3. Index usage: dead / hot indexes
-- ---------------------------------------------------------------------------
SELECT
  schemaname,
  relname,
  indexrelname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;
-- GOOD: the new B-tree indexes (agent 3) and the unique indexes on the
-- materialized views (agent 4) should show rising idx_scan after load tests.
-- An index with idx_scan = 0 after a full load-test window is a candidate for
-- dropping (dead weight on writes) — but only judge indexes added AFTER the
-- baseline snapshot; brand-new indexes have no counts yet.

-- ---------------------------------------------------------------------------
-- 4. Connection usage (PgBouncer pool effectiveness)
-- ---------------------------------------------------------------------------
SELECT
  state,
  count(*)                              AS connections,
  count(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting_on_lock
FROM pg_stat_activity
WHERE datname = current_database()
GROUP BY state
ORDER BY connections DESC;

SELECT count(*)                          AS total_connections_to_this_db
FROM pg_stat_activity
WHERE datname = current_database();
-- GOOD with PgBouncer (agent 1): the backend's pooled connections stay small
-- and stable (a handful of servers, not one per API request). idle_in_transaction
-- should be ~0 — rows there mean the app holds transactions open across work
-- (violates transaction-pooling assumptions). waiting_on_lock > 0 under load
-- means query contention: check for missing indexes or MV refresh locks.
-- If total connections here == your pgbouncer pool size AND cl_waiting > 0 in
-- `SHOW POOLS`, the pool is too small — see PgBouncer section below.

-- ---------------------------------------------------------------------------
-- 5. Top slow queries (requires pg_stat_statements extension)
-- ---------------------------------------------------------------------------
SELECT
  calls,
  round(mean_exec_time::numeric, 2)      AS mean_ms,
  round(max_exec_time::numeric, 2)       AS max_ms,
  round((total_exec_time / 1000)::numeric, 2) AS total_s,
  rows,
  left(query, 120)                       AS query_preview
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
-- GOOD: after optimization, the hot portfolio/PNL queries should either
-- disappear from the top of this list (served from Redis cache, agents 6-8)
-- or drop sharply in mean_ms (served from materialized views, agent 4).
-- No rows at all = extension not enabled (CREATE EXTENSION pg_stat_statements).

-- ===========================================================================
-- PgBouncer — NOT SQL. These are pgbouncer console commands.
-- ===========================================================================
-- Connect to the pgbouncer admin console (not the Postgres server):
--
--   psql -h <pgbouncer-host> -p 6432 -U pgbouncer pgbouncer
--   (or: pgbouncer -R / admin_console via telnet/socat on the admin port)
--
--   SHOW STATS;
--   SHOW POOLS;
--   SHOW SERVERS;
--
-- Metrics to record from `SHOW STATS`:
--   total_client_connections   — clients currently attached
--   total_query_count          — queries processed (use diffs between snapshots)
--   total_wait_time, avg_wait_time — how long clients queued for a server conn
--   avg_recv/avg_sent          — average response bytes (payload size sanity)
--
-- Metrics from `SHOW POOLS`:
--   cl_active, cl_waiting      — cl_waiting MUST stay near 0 under load;
--                                if it climbs while sv_active == pool size,
--                                the pool is too small (raise pool_size /
--                                max_client_conn in pgbouncer.ini).
--   sv_active, sv_idle         — idle servers are fine (cheap); active == size
--                                while clients wait = pool exhaustion.
--   maxwait                   — longest client wait (seconds); > 1s = starvation.
--
-- GOOD: avg_wait_time near 0, cl_waiting = 0, maxwait < 100ms under the
-- 200-VU load tests. In pool_mode = transaction the number of Postgres
-- backends (section 4) should stay far below the VU count.

-- ===========================================================================
-- Redis — NOT SQL. Cache hit ratio for the cache-aside layer (agents 6-8):
-- ===========================================================================
--   redis-cli INFO stats
--
-- Record keyspace_hits and keyspace_misses at the START and END of the load
-- test window (they are cumulative counters). Hit ratio:
--
--   hit_rate = (hits_end - hits_start) / ((hits_end - hits_start) + (misses_end - misses_start))
--
-- GOOD: hit_rate >= 0.9 after warm-up (first load pass populates the 30-60s
-- TTL keys, so measure steady state on a second pass). Below ~0.7 means the
-- TTLs are too short or the read path isn't actually consulting the cache —
-- report to agents 6-8. ~1.0 might mean TTLs are too long for data freshness.
-- ===========================================================================
