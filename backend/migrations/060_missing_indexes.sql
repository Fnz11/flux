-- ============================================================================
-- 060_missing_indexes.sql
-- Missing indexes from the audit (adjustment-3.md section 1.4).
-- Owner: Subagent 5 (SQL layer).
--
-- Purpose
--   Close the B-tree / BRIN / partial-index gaps identified in 1.4:
--     1.4.1 composite (manager_id, status, created_at DESC) on vaults
--     1.4.2 price_history partial index — NOT CREATED (see body: index
--          predicates must be IMMUTABLE; a sliding 30-day window is not
--          expressible, and 010's full index + the BRIN below cover the reads)
--     1.4.3 partial index on vaults for soft-delete filtering (deleted_at)
--     1.4.4 covering index on vaults for status + sort-by-TVL listings
--     1.4.5 BRIN indexes on the hypertables for cross-chunk vault scans
--
-- Ordering (see README.md): runs AFTER 010/020/030. vaults exists via GORM
-- AutoMigrate; price_history / trade_histories are hypertables from 010.
-- Direct 5432 connection only, never through PgBouncer. All statements are
-- guarded / idempotent, safe to re-run.
-- ============================================================================

-- Fail fast instead of blocking production traffic (README conventions).
SET lock_timeout = '10s';

-- ============================================================================
-- 1.4.1 vaults (manager_id, status, created_at DESC)
--
-- Serves vault listing filtered by manager (List with ManagerAddress:
-- correlated subquery on users -> manager_id IN (...) + status filter) with
-- the common newest-first sort. The leftmost prefix (manager_id) also covers
-- manager-scoped lookups alone.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vaults_manager_status_created
    ON vaults (manager_id, status, created_at DESC);

-- ============================================================================
-- 1.4.2 price_history "recent 30 days" partial index — NOT CREATED
--
-- The audit proposed a sliding-window partial index:
--     (vault_id, fetched_at DESC) WHERE fetched_at > now() - INTERVAL '30 days'
-- That predicate is INVALID in PostgreSQL: index predicates must use IMMUTABLE
-- functions only, and now() is STABLE, so the server rejects it with
-- "functions in index predicate must be marked IMMUTABLE". A partial index
-- cannot express a sliding window at all, so there is no valid way to keep the
-- index scoped to a rolling 30 days.
--
-- We deliberately omit it: the recent per-vault price read
-- (vault_id + fetched_at DESC) is already served by 010's full B-tree
-- `idx_price_history_vault_fetched`, and 060's BRIN index below accelerates
-- cross-chunk vault scans. No index is lost by skipping this item.
-- ============================================================================

-- ============================================================================
-- 1.4.3 vaults partial index for soft-delete
--
-- WHERE deleted_at IS NULL appears in the MV queries (030) and in GORM
-- soft-delete filtering. This tiny partial index lets the planner resolve
-- "all live vaults" without scanning the full table.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vaults_not_deleted
    ON vaults (id)
    WHERE deleted_at IS NULL;

-- ============================================================================
-- 1.4.4 covering index for vault listing
--
-- (status, created_at DESC, tvl) INCLUDE (id) supports the common
-- "WHERE status = ? ORDER BY created_at/tvl" listing paths as index-only
-- scans, avoiding heap lookups for the projection columns.
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_vaults_status_created_tvl
    ON vaults (status, created_at DESC, tvl)
    INCLUDE (id);

-- ============================================================================
-- 1.4.5 BRIN indexes on the hypertables
--
-- Queries spanning many chunks (e.g. 30-day metrics) benefit from BRIN on
-- (vault_id): each chunk's min/max is a single range entry, so the index is
-- tiny vs a full B-tree while still pruning chunks cheaply for vault filters.
-- pages_per_range = 128 balances pruning granularity with index size.
-- BRIN requires the hypertable structure, so this MUST run after 010; the
-- to_regclass guards also keep it a no-op before 010 has converted the tables.
-- ============================================================================

DO $do$
BEGIN
    IF to_regclass('public.trade_histories') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_trade_histories_vault_brin
            ON trade_histories USING brin (vault_id)
            WITH (pages_per_range = 128);
    END IF;
END $do$;

DO $do$
BEGIN
    IF to_regclass('public.price_history') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS idx_price_history_vault_brin
            ON price_history USING brin (vault_id)
            WITH (pages_per_range = 128);
    END IF;
END $do$;