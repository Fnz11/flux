-- ============================================================================
-- 040_compression_policy.sql
-- TimescaleDB native columnar compression + OHLCV CAGG index fix.
-- Owner: Subagent 5 (SQL layer, adjustment-3.md items 1.5.3 and 2.10).
--
-- Purpose
--   * Enable TimescaleDB native columnar compression on both hypertables
--     (trade_histories, price_history), segmenting by vault_id. Chunks older
--     than 7 days are compressed automatically by the compression policy,
--     cutting disk usage 10-20x with no API-visible change (compressed rows
--     are decompressed transparently on read).
--   * Add the vault-first index on cagg_price_ohlcv_1h (2.10): the existing
--     unique index leads with `bucket`, forcing a full scan for the
--     vault_id + time-range access pattern of GetOHLCV. The new index leads
--     with vault_id so vault-scoped OHLCV range reads do an index range scan.
--
-- Ordering (see README.md): runs AFTER 010 (hypertables exist) and 020/030.
--   Requires TimescaleDB >= 2.13. Direct 5432 connection only, never PgBouncer.
--   All statements guarded / idempotent, re-runnable.
-- ============================================================================

-- Fail fast instead of blocking production traffic (README conventions).
SET lock_timeout = '10s';

-- ===========================================================================
-- 1) Enable compression on both hypertables
--
-- ALTER TABLE ... SET (timescaledb.compress, ...) has NO IF NOT EXISTS form,
-- and re-applying it to an already-compressed hypertable raises an error
-- ("compression is already enabled"). Wrap each in a DO block that only
-- applies the settings when timescaledb_information.hypertables still reports
-- compression_enabled = false for that hypertable.
--
-- compress_segmentby = 'vault_id': vault_id is the dominant shared dimension
--   of the read patterns (per-vault metrics, OHLCV, trade listings), so it is
--   the segmentby column (decompression can be skipped for whole segments).
-- compress_orderby is left at the default (the partitioning time column),
--   which keeps compressed chunks time-ordered for drop-by-chunk retention.
--   NOTE: trade_histories PK includes executed_at and price_history PK includes
--   fetched_at, so the PK satisfies the "partition column in PK" rule that
--   compression requires.
-- ===========================================================================

DO $do$
BEGIN
    IF to_regclass('public.trade_histories') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM timescaledb_information.hypertables
           WHERE hypertable_name = 'trade_histories' AND compression_enabled
       ) THEN
        ALTER TABLE trade_histories
            SET (timescaledb.compress = 't',
                 timescaledb.compress_segmentby = 'vault_id');
    END IF;
END $do$;

DO $do$
BEGIN
    IF to_regclass('public.price_history') IS NOT NULL
       AND NOT EXISTS (
           SELECT 1 FROM timescaledb_information.hypertables
           WHERE hypertable_name = 'price_history' AND compression_enabled
       ) THEN
        ALTER TABLE price_history
            SET (timescaledb.compress = 't',
                 timescaledb.compress_segmentby = 'vault_id');
    END IF;
END $do$;

-- ===========================================================================
-- 2) Compression policies: compress chunks older than 7 days
--
-- Leaves the most recent week (the hot working set) uncompressed for fast
-- writes/point reads; everything older is compressed by the background
-- worker. if_not_exists => TRUE is idempotent across re-runs. Guarded by
-- to_regclass so a pre-AutoMigrate run is a no-op instead of an error.
-- ===========================================================================

SELECT add_compression_policy('trade_histories', INTERVAL '7 days', if_not_exists => TRUE)
WHERE to_regclass('public.trade_histories') IS NOT NULL;

SELECT add_compression_policy('price_history', INTERVAL '7 days', if_not_exists => TRUE)
WHERE to_regclass('public.price_history') IS NOT NULL;

-- ===========================================================================
-- 3) OHLCV CAGG vault-first index fix (optimization-3.md section 2.10)
--
-- The unique index created in 010 is (bucket, vault_id, token) --- bucket
-- leads. GetOHLCV filters by vault_id + time range; with the vault column
-- second, those range scans walk the whole leading bucket prefix. This
-- secondary index leads with vault_id then bucket DESC so the common
-- vault-first time-range read is an index range scan.
-- ===========================================================================

DO $do$
BEGIN
    IF to_regclass('public.cagg_price_ohlcv_1h') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_cagg_ohlcv_vault_bucket
            ON cagg_price_ohlcv_1h (vault_id, bucket DESC);
    END IF;
END $do$;