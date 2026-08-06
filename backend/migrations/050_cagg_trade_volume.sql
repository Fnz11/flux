-- ============================================================================
-- 050_cagg_trade_volume.sql
-- Continuous aggregate: vault-level hourly trade volume.
-- Owner: Subagent 5 (SQL layer, adjustment-3.md item 1.5.4).
--
-- Purpose
--   Pre-aggregate trade_histories into 1-hour per-vault volume buckets so the
--   leaderboard, analytics, and volume-reporting endpoints stop scanning raw
--   trade rows. Mirror of 010's cagg_price_ohlcv_1h, but over trades.
--
--   Feeds:
--     * leaderboard endpoints   (ranking vaults by recent volume)
--     * analytics / metrics     (hourly/daily per-vault volume rollups)
--     * audit-style volume readouts per (bucket, vault_id, trade_type)
--
-- Continuous aggregates are incrementally maintained by the TimescaleDB
-- scheduler, so querying them is materially faster than the raw scan, and
-- real-time aggregation (end_offset = 1 hour) keeps the most recent hour
-- fresh at read time.
--
-- Ordering (see README.md): runs AFTER 030 (trade_histories is a hypertable
-- from 010). Direct 5432 connection only, never through PgBouncer. All
-- statements guarded / idempotent, re-runnable.
-- ============================================================================

-- Fail fast instead of blocking production traffic (README conventions).
SET lock_timeout = '10s';

-- ===========================================================================
-- 1) Create the continuous aggregate
--
-- Grain: one row per (bucket, vault_id, trade_type). amount_in / amount_out
-- are money/quantity columns cast to numeric(36,18) to mirror the Go models;
-- COUNT(*) is the number of trades in the hour. COALESCE keeps a bucket row
-- even when a given type has zero volume in the hour.
--
-- WITH NO DATA: the view is created empty and populated by the refresh policy
-- below (plus an optional one-time backfill, see the commented CALL at the
-- bottom).
-- ===========================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS cagg_trade_volume_1h
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', executed_at) AS bucket,
       vault_id,
       trade_type,
       COUNT(*)                                 AS trade_count,
       COALESCE(SUM(amount_in), 0)::numeric(36,18) AS volume_in,
       COALESCE(SUM(amount_out), 0)::numeric(36,18) AS volume_out
FROM trade_histories
GROUP BY 1, 2, 3
WITH NO DATA;

-- ============================================================================
-- 2) Lookup index
--
-- TimescaleDB does NOT support UNIQUE indexes on continuous aggregates in any
-- version (docs: "You can't create unique indexes on a continuous aggregate").
-- The audit's "required for realtime agg" unique index therefore cannot be
-- created; real-time aggregation does NOT need unique indexes (unlike
-- REFRESH MATERIALIZED VIEW CONCURRENTLY for plain MVs). We instead add a
-- NON-unique index on (bucket, vault_id, trade_type): it gives the leaderboard
-- / volume-lookup query its exact access path. TimescaleDB already creates
-- composite group indexes for the GROUP BY columns combined with the bucket;
-- this explicit index adds the (bucket, vault_id, trade_type) leading-column
-- variant used by per-(vault, hour, type) point reads.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_cagg_trade_volume_1h_key
    ON cagg_trade_volume_1h (bucket, vault_id, trade_type);

-- ============================================================================
-- 3) Refresh policy (guarded by a job-existence check, mirroring 010)
--
-- Materialize from 2 days back (covers policy restarts / late or out-of-order
-- trades) up to 1 hour before now --- the realtime window computes the most
-- recent hour live at query time. Runs hourly.
--
-- The job-existence guard matches on proc_name = 'policy_refresh_continuous_aggregate'
-- (the name in TimescaleDB 2.x when the scheduler gained dedicated refresh
-- policies); 'policy_continuous_aggregate' is kept for older versions that
-- used the earlier name. Matching on the wrong name lets the NOT EXISTS be
-- always-true, and add_continuous_aggregate_policy then errors with
-- "continuous aggregate refresh policy already exists" on a re-run.
-- ============================================================================

SELECT add_continuous_aggregate_policy(
           'cagg_trade_volume_1h',
           start_offset      => INTERVAL '2 days',
           end_offset        => INTERVAL '1 hour',
           schedule_interval => INTERVAL '1 hour'
       )
WHERE to_regclass('public.cagg_trade_volume_1h') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM timescaledb_information.jobs
      WHERE hypertable_name = 'cagg_trade_volume_1h'
        AND proc_name IN ('policy_refresh_continuous_aggregate', 'policy_continuous_aggregate')
  );

-- One-time backfill after the first load of historical trades:
-- CALL refresh_continuous_aggregate('cagg_trade_volume_1h', '2026-01-01'::timestamptz, now());