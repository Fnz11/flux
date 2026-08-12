-- ============================================================================
-- 080_global_metrics_cagg.sql
-- Continuous aggregates: platform-wide (global) market metrics.
-- Owner: S3 (Migrations: Global Metrics CAGGs).
--
-- Purpose
--   Pre-aggregate the three platform-wide rollups the /metrics/global
--   endpoint reads, so it stops scanning raw rows on every request:
--     * cagg_global_volume_1h    : 1h platform trade volume (24h global volume)
--     * cagg_global_tvl_1h       : 1h platform TVL (summed vault_metrics tvl)
--     * cagg_global_ath_price_1h : 1h max observed price (platform price ATH)
--
--   Unlike 050's per-vault caggs these are deliberately NOT keyed by vault_id /
--   token --- they roll the whole platform into one bucket per hour, which is
--   exactly the grain /metrics/global needs.
--
-- Self-sufficiency
--   TimescaleDB requires the FROM target of a continuous aggregate to be a
--   hypertable. In dev the source tables exist as plain GORM tables (010 was
--   never run and the live schema uses plural names: price_histories, not
--   price_history). This file therefore converts each source table to a
--   hypertable FIRST (guarded, idempotent), then creates the caggs against
--   whichever price table actually exists.
--
-- Ordering (see README.md): runs after 050. Safe to run whether or not 010
-- was applied. Direct 5432 connection only, never through PgBouncer. All
-- statements guarded / idempotent, re-runnable.
--
-- Extension safety
--   Every DDL statement (hypertable conversion, cagg creation, index, refresh
--   policy) is wrapped in a DO block guarded by the timescaledb extension, so
--   a vanilla Postgres no-ops on them. The final section's refresh_continuous
--   CALLs are TimescaleDB-specific by design: this file participates in the
--   TimescaleDB migration track (see README ordering).
-- ============================================================================

-- Fail fast instead of blocking production traffic (README conventions).
SET lock_timeout = '10s';

-- ===========================================================================
-- 0) Hypertable conversion (guarded, idempotent)
--
-- TimescaleDB rule: every PRIMARY KEY / UNIQUE index MUST include the
-- partitioning column. GORM created PK(id) and a UNIQUE
-- idx_*_transaction_signature on (transaction_signature) alone, so both are
-- re-declared to include the time column BEFORE conversion, mirroring 010.
-- ===========================================================================

-- trade_histories -> hypertable on executed_at
DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
       AND to_regclass('public.trade_histories') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM timescaledb_information.hypertables
                       WHERE hypertable_name = 'trade_histories') THEN
        BEGIN
            ALTER TABLE trade_histories DROP CONSTRAINT IF EXISTS trade_histories_pkey;
            ALTER TABLE trade_histories ADD CONSTRAINT trade_histories_pkey PRIMARY KEY (id, executed_at);
            DROP INDEX IF EXISTS idx_trade_histories_transaction_signature;
            CREATE UNIQUE INDEX idx_trade_histories_transaction_signature
                ON trade_histories (transaction_signature, executed_at);
            PERFORM create_hypertable('trade_histories', 'executed_at',
                                      chunk_time_interval => INTERVAL '7 days',
                                      migrate_data => TRUE,
                                      if_not_exists => TRUE);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'hypertable conversion skipped for trade_histories: %', sqlerrm;
        END;
    END IF;
END $do$;

-- price_histories (or price_history) -> hypertable on fetched_at
DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
       AND NOT EXISTS (
           SELECT 1 FROM timescaledb_information.hypertables
           WHERE hypertable_name IN ('price_histories', 'price_history')) THEN
        IF to_regclass('public.price_histories') IS NOT NULL THEN
            BEGIN
                ALTER TABLE price_histories DROP CONSTRAINT IF EXISTS price_histories_pkey;
                ALTER TABLE price_histories ADD CONSTRAINT price_histories_pkey PRIMARY KEY (id, fetched_at);
                PERFORM create_hypertable('price_histories', 'fetched_at',
                                          chunk_time_interval => INTERVAL '1 day',
                                          migrate_data => TRUE,
                                          if_not_exists => TRUE);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'hypertable conversion skipped for price_histories: %', sqlerrm;
            END;
        ELSIF to_regclass('public.price_history') IS NOT NULL THEN
            BEGIN
                ALTER TABLE price_history DROP CONSTRAINT IF EXISTS price_history_pkey;
                ALTER TABLE price_history ADD CONSTRAINT price_history_pkey PRIMARY KEY (id, fetched_at);
                PERFORM create_hypertable('price_history', 'fetched_at',
                                          chunk_time_interval => INTERVAL '1 day',
                                          migrate_data => TRUE,
                                          if_not_exists => TRUE);
            EXCEPTION WHEN OTHERS THEN
                RAISE NOTICE 'hypertable conversion skipped for price_history: %', sqlerrm;
            END;
        END IF;
    END IF;
END $do$;

-- vault_metrics -> hypertable on timestamp
DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
       AND to_regclass('public.vault_metrics') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM timescaledb_information.hypertables
                       WHERE hypertable_name = 'vault_metrics') THEN
        BEGIN
            ALTER TABLE vault_metrics DROP CONSTRAINT IF EXISTS vault_metrics_pkey;
            ALTER TABLE vault_metrics ADD CONSTRAINT vault_metrics_pkey PRIMARY KEY (id, "timestamp");
            PERFORM create_hypertable('vault_metrics', 'timestamp',
                                      chunk_time_interval => INTERVAL '7 days',
                                      migrate_data => TRUE,
                                      if_not_exists => TRUE);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'hypertable conversion skipped for vault_metrics: %', sqlerrm;
        END;
    END IF;
END $do$;

-- ===========================================================================
-- 1) cagg_global_volume_1h — platform-wide hourly trade volume
--
-- Grain: one row per hour (whole platform). COUNT(*) is the number of trades
-- in the hour; volume_in / volume_out are money/quantity columns cast to
-- numeric(36,18) to mirror the Go models (COALESCE keeps a row even for an
-- empty hour). WITH NO DATA: populated by the refresh policy below.
-- ===========================================================================

DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
       AND to_regclass('public.trade_histories') IS NOT NULL
       AND to_regclass('public.cagg_global_volume_1h') IS NULL THEN
        CREATE MATERIALIZED VIEW cagg_global_volume_1h
        WITH (timescaledb.continuous) AS
        SELECT time_bucket('1 hour', executed_at)                           AS bucket,
               COUNT(*)                                                     AS trade_count,
               COALESCE(SUM(amount_in), 0)::numeric(36,18)                  AS volume_in,
               COALESCE(SUM(amount_out), 0)::numeric(36,18)                 AS volume_out
        FROM trade_histories
        GROUP BY 1
        WITH NO DATA;
    END IF;
END $do$;

-- Lookup index: the 24h-global-volume query is a time-range scan over bucket.
-- TimescaleDB does not support UNIQUE indexes on continuous aggregates, so
-- this is deliberately non-unique (mirrors 050).
DO $do$
BEGIN
    IF to_regclass('public.cagg_global_volume_1h') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_cagg_global_volume_1h_bucket
            ON cagg_global_volume_1h (bucket);
    END IF;
END $do$;

-- ===========================================================================
-- 2) cagg_global_tvl_1h — platform TVL from vault_metrics (metric = 'tvl')
--
-- vault_metrics carries per-vault tvl snapshots; summing them across all
-- vaults in an hour yields the platform TVL for that hour. The latest bucket
-- (read with realtime aggregation) is the current platform TVL.
-- ===========================================================================

DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
       AND to_regclass('public.vault_metrics') IS NOT NULL
       AND to_regclass('public.cagg_global_tvl_1h') IS NULL THEN
        CREATE MATERIALIZED VIEW cagg_global_tvl_1h
        WITH (timescaledb.continuous) AS
        SELECT time_bucket('1h', "timestamp")   AS bucket,
               SUM(value)::numeric(36,18)       AS tvl
        FROM vault_metrics
        WHERE metric = 'tvl'
        GROUP BY 1
        WITH NO DATA;
    END IF;
END $do$;

DO $do$
BEGIN
    IF to_regclass('public.cagg_global_tvl_1h') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_cagg_global_tvl_1h_bucket
            ON cagg_global_tvl_1h (bucket);
    END IF;
END $do$;

-- ===========================================================================
-- 3) cagg_global_ath_price_1h — platform price all-time-high
--
-- Grain: one row per hour with the max price observed across every token /
-- vault that hour. The platform ATH query is MAX(ath_price) over the whole
-- cagg. The price table may be `price_histories` or `price_history`.
-- ===========================================================================

DO $do$
DECLARE
    price_tbl text;
BEGIN
    IF to_regclass('public.price_history') IS NOT NULL THEN
        price_tbl := 'price_history';
    ELSIF to_regclass('public.price_histories') IS NOT NULL THEN
        price_tbl := 'price_histories';
    END IF;

    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
       AND price_tbl IS NOT NULL
       AND to_regclass('public.cagg_global_ath_price_1h') IS NULL THEN
        EXECUTE format(
            'CREATE MATERIALIZED VIEW cagg_global_ath_price_1h
             WITH (timescaledb.continuous) AS
             SELECT time_bucket(''1h'', fetched_at) AS bucket,
                    MAX(price)::numeric(36,18)      AS ath_price
             FROM %I
             GROUP BY 1
             WITH NO DATA', price_tbl);
    END IF;
END $do$;

DO $do$
BEGIN
    IF to_regclass('public.cagg_global_ath_price_1h') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_cagg_global_ath_price_1h_bucket
            ON cagg_global_ath_price_1h (bucket);
    END IF;
END $do$;

-- ============================================================================
-- 4) Refresh policies (guarded like 050, but inside DO blocks so a vanilla
--    PostgreSQL without timescaledb_information never errors)
--
-- Materialize from 2 days back (covers policy restarts / late or out-of-order
-- writes) up to 1 hour before now --- the realtime window computes the most
-- recent hour live at query time. Runs hourly.
--
-- The job-existence guard matches on proc_name =
-- 'policy_refresh_continuous_aggregate' (TimescaleDB 2.x) and falls back to
-- 'policy_continuous_aggregate' (the earlier name). Matching the wrong name
-- lets the NOT EXISTS be always-true, and add_continuous_aggregate_policy
-- then errors "already exists" on a re-run.
-- ============================================================================

DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
       AND to_regclass('public.cagg_global_volume_1h') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM timescaledb_information.jobs
           WHERE hypertable_name = 'cagg_global_volume_1h'
             AND proc_name IN ('policy_refresh_continuous_aggregate', 'policy_continuous_aggregate')
       ) THEN
        PERFORM add_continuous_aggregate_policy(
            'cagg_global_volume_1h',
            start_offset      => INTERVAL '2 days',
            end_offset        => INTERVAL '1 hour',
            schedule_interval => INTERVAL '1 hour'
        );
    END IF;
END $do$;

DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
       AND to_regclass('public.cagg_global_tvl_1h') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM timescaledb_information.jobs
           WHERE hypertable_name = 'cagg_global_tvl_1h'
             AND proc_name IN ('policy_refresh_continuous_aggregate', 'policy_continuous_aggregate')
       ) THEN
        PERFORM add_continuous_aggregate_policy(
            'cagg_global_tvl_1h',
            start_offset      => INTERVAL '2 days',
            end_offset        => INTERVAL '1 hour',
            schedule_interval => INTERVAL '1 hour'
        );
    END IF;
END $do$;

DO $do$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb')
       AND to_regclass('public.cagg_global_ath_price_1h') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM timescaledb_information.jobs
           WHERE hypertable_name = 'cagg_global_ath_price_1h'
             AND proc_name IN ('policy_refresh_continuous_aggregate', 'policy_continuous_aggregate')
       ) THEN
        PERFORM add_continuous_aggregate_policy(
            'cagg_global_ath_price_1h',
            start_offset      => INTERVAL '2 days',
            end_offset        => INTERVAL '1 hour',
            schedule_interval => INTERVAL '1 hour'
        );
    END IF;
END $do$;

-- ============================================================================
-- 5) Apply an initial refresh so the aggregates are immediately queryable
-- without waiting for the first scheduler tick. These are top-level CALLs
-- because refresh_continuous_aggregate is a procedure and PL/pgSQL cannot
-- execute CALL from inside a function. Refreshing an already-refreshed cagg
-- is a safe no-op, so re-runs are fine.
-- ============================================================================

CALL refresh_continuous_aggregate('cagg_global_volume_1h', '2026-01-01', now());
CALL refresh_continuous_aggregate('cagg_global_tvl_1h', '2026-01-01', now());
CALL refresh_continuous_aggregate('cagg_global_ath_price_1h', '2026-01-01', now());