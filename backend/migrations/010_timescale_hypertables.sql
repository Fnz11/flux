-- =====================================================================
-- 010_timescale_hypertables.sql
-- Agent 2 (Time-Series Database Migration) — owned file, number 010.
--
-- Converts time-series tables to TimescaleDB hypertables:
--   * trade_histories  -> hypertable on executed_at  (exists, GORM AutoMigrate)
--   * price_history    -> NEW hypertable on fetched_at (created here)
--   * cagg_price_ohlcv_1h -> 1-hour OHLCV continuous aggregate on price_history
--   * retention policies: raw prices 1 year, raw trades 2 years
--
-- Ordering (see README.md): 010 (this) -> 020 (indexes, agent 3) -> 030 (matviews, agent 4).
-- Run on a direct 5432 connection, NEVER through PgBouncer (transaction pooling
-- cannot hold the dedicated session state DDL requires).
--
-- Requires: TimescaleDB >= 2.13 (for create_hypertable if_not_exists), extension
-- enabled by agent 1's docker image. All statements are guarded so the script
-- is idempotent and safe to re-run.
-- =====================================================================

-- Fail fast instead of blocking production traffic (DBA skill rule).
SET lock_timeout = '10s';

-- Guard: agent 1 also enables this; IF NOT EXISTS makes it idempotent.
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- =====================================================================
-- 1) trade_histories -> hypertable on executed_at
--
-- TimescaleDB rule: every PRIMARY KEY and UNIQUE index MUST include the
-- partitioning column. GORM AutoMigrate created PK(id) and a UNIQUE index
-- on transaction_signature alone, so both must be re-declared to include
-- executed_at BEFORE conversion, otherwise create_hypertable fails.
--
-- (id, executed_at) PK: id stays the business key; executed_at is appended
-- purely to satisfy the partitioning constraint.
--
-- (transaction_signature, executed_at) UNIQUE: loses strict single-signature
-- uniqueness across different timestamps. Tradeoff accepted: replays of the
-- same signature within the same executed_at second are still blocked, and
-- the hypertable constraint is mandatory. Dedup logic stays in the service
-- layer (FindBySignature) if exact uniqueness is ever required.
-- =====================================================================

-- Re-declare PK to include the partitioning column (skips cleanly if the
-- table does not exist yet — run 010 after first AutoMigrate boot).
ALTER TABLE IF EXISTS trade_histories DROP CONSTRAINT IF EXISTS trade_histories_pkey;
ALTER TABLE IF EXISTS trade_histories ADD CONSTRAINT trade_histories_pkey PRIMARY KEY (id, executed_at);

DO $do$
BEGIN
    IF to_regclass('public.trade_histories') IS NOT NULL THEN
        DROP INDEX IF EXISTS idx_trade_histories_transaction_signature;
        CREATE UNIQUE INDEX idx_trade_histories_transaction_signature
            ON trade_histories (transaction_signature, executed_at);
    END IF;
END $do$;

-- Convert to hypertable, 7-day chunks (default interval, right for trade volume).
-- migrate_data => TRUE: required when the table already contains rows —
-- without it, create_hypertable refuses to convert a non-empty table
-- ("must be empty / use migrate_data"). It migrates existing rows into
-- backdated chunks instead of requiring a manual data backfill.
-- if_not_exists => TRUE: no-op when already converted (idempotent re-runs).
SELECT create_hypertable(
           'trade_histories',
           'executed_at',
           chunk_time_interval => INTERVAL '7 days',
           migrate_data       => TRUE,
           if_not_exists      => TRUE
       )
WHERE to_regclass('public.trade_histories') IS NOT NULL;

-- =====================================================================
-- 2) price_history -> NEW hypertable on fetched_at
--
-- Powers future OHLCV / PnL-over-time queries (agent 9 repository APIs,
-- agent 7 PnL reads, agent 10 charting benchmarks). Per-vault per-token
-- tick rows written by the price sync service.
-- =====================================================================

CREATE TABLE IF NOT EXISTS price_history (
    id        uuid          NOT NULL DEFAULT gen_random_uuid(),
    vault_id  uuid          NOT NULL,
    token     varchar(32)   NOT NULL,
    price     numeric(36,18) NOT NULL,
    volume    numeric(36,18) NOT NULL DEFAULT 0,
    fetched_at timestamptz  NOT NULL,
    CONSTRAINT price_history_pkey PRIMARY KEY (id)
);

-- Same PK rule as trade_histories: partitioning column must join the PK.
ALTER TABLE IF EXISTS price_history DROP CONSTRAINT IF EXISTS price_history_pkey;
ALTER TABLE IF EXISTS price_history ADD CONSTRAINT price_history_pkey PRIMARY KEY (id, fetched_at);

-- FK to vaults with explicit ON DELETE (DBA skill rule). Guarded so this
-- also works when vaults is created by AutoMigrate only after this script.
DO $do$
BEGIN
    IF to_regclass('public.price_history') IS NOT NULL
       AND to_regclass('public.vaults') IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_price_history_vault') THEN
        ALTER TABLE price_history
            ADD CONSTRAINT fk_price_history_vault
            FOREIGN KEY (vault_id) REFERENCES vaults (id) ON DELETE CASCADE;
    END IF;
END $do$;

-- 1-day chunks: price ticks are higher volume than trades; smaller chunks
-- keep retention drops and compression (future) granular.
SELECT create_hypertable(
           'price_history',
           'fetched_at',
           chunk_time_interval => INTERVAL '1 day',
           if_not_exists      => TRUE
       )
WHERE to_regclass('public.price_history') IS NOT NULL;

-- Lookup paths for the read APIs: per-vault history and per-token history.
-- (vault_id, fetched_at DESC): latest-first per vault — PnL / chart queries.
-- (token, fetched_at DESC): latest-first per token — market data queries.
CREATE INDEX IF NOT EXISTS idx_price_history_vault_fetched
    ON price_history (vault_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_price_history_token_fetched
    ON price_history (token, fetched_at DESC);

-- =====================================================================
-- 3) Retention policies
--
-- price_history  (1 year): raw ticks are bulk; hourly OHLCV survives in the
--   continuous aggregate below. Tradeoff: price-range queries beyond 1 year
--   lose tick precision — acceptable, charting reads the cagg instead.
-- trade_histories (2 years): full trade detail kept for 2 years for audit
--   and PnL reconstruction. Tradeoff: ~2x disk vs 1 year; beyond 2 years
--   the rows are gone entirely, so raise this before it bites, or downscale
--   to a daily trade-summary cagg first.
--
-- Retention drops whole chunks atomically (DROP TABLE chunk) instead of
-- DELETE — orders of magnitude faster, no bloat, no vacuum pressure.
-- =====================================================================

SELECT add_retention_policy('price_history', INTERVAL '1 year')
WHERE to_regclass('public.price_history') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM timescaledb_information.jobs
      WHERE hypertable_name = 'price_history' AND proc_name = 'policy_retention'
  );

SELECT add_retention_policy('trade_histories', INTERVAL '2 years')
WHERE to_regclass('public.trade_histories') IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM timescaledb_information.jobs
      WHERE hypertable_name = 'trade_histories' AND proc_name = 'policy_retention'
  );

-- =====================================================================
-- 4) Continuous aggregate: 1-hour OHLCV on price_history
--
-- Instant OHLCV for agent 9's repository APIs and future charting: query
-- cagg_price_ohlcv_1h instead of scanning raw ticks. Real-time aggregation
-- is ON by default: end_offset of 1 hour means the most recent hour is
-- computed live at query time — no stale last-bucket.
-- =====================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS cagg_price_ohlcv_1h
WITH (timescaledb.continuous) AS
SELECT time_bucket('1 hour', fetched_at) AS bucket,
       vault_id,
       token,
       FIRST(price, fetched_at) AS open,
       MAX(price)               AS high,
       MIN(price)               AS low,
       LAST(price, fetched_at)  AS close,
       SUM(volume)              AS volume
FROM price_history
GROUP BY bucket, vault_id, token
WITH NO DATA;

-- Unique lookup key: (bucket, vault_id, token) — one OHLCV bar per
-- vault/token/hour; also serves WHERE bucket >= ... AND vault_id = ...
CREATE UNIQUE INDEX IF NOT EXISTS cagg_price_ohlcv_1h_bucket_key
    ON cagg_price_ohlcv_1h (bucket, vault_id, token);

-- Refresh policy: recompute hourly; materialize from 2 days back (covers
-- policy restarts / late ticks) up to 1 hour before now (realtime window).
SELECT add_continuous_aggregate_policy(
           'cagg_price_ohlcv_1h',
           start_offset      => INTERVAL '2 days',
           end_offset        => INTERVAL '1 hour',
           schedule_interval => INTERVAL '1 hour'
       )
WHERE NOT EXISTS (
    SELECT 1 FROM timescaledb_information.jobs
    WHERE hypertable_name = 'cagg_price_ohlcv_1h'
      AND proc_name = 'policy_continuous_aggregate'
);

-- One-time backfill after first load of historical prices:
-- CALL refresh_continuous_aggregate('cagg_price_ohlcv_1h', '2026-01-01'::timestamptz, now());
