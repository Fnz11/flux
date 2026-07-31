-- 020_btree_indexes.sql
-- B-tree indexes to eliminate sequential scans on high-traffic tables.
--
-- NOTE ON GORM-MANAGED INDEXES (internal/models/*.go, AutoMigrate in internal/database/migrate.go):
--   users.wallet_address            -> uniqueIndex tag (skip)
--   vaults.address                  -> uniqueIndex tag (skip)
--   vaults.manager_id               -> index tag        (skip)
--   vaults.deleted_at               -> index tag        (skip)
--   portfolios.user_id              -> index tag        (skip)
--   portfolios.vault_id             -> index tag        (skip)
--   trade_histories.vault_id        -> index tag        (skip)
--   trade_histories.actor_id        -> index tag        (skip)
--   trade_histories.trade_type      -> index tag        (skip)
--   trade_histories.executed_at     -> index tag        (skip)
--   trade_histories.transaction_signature -> uniqueIndex tag (skip)
-- This file ONLY adds composite/unique indexes GORM cannot express as single-column tags.
--
-- Safe to run via psql at any time: all statements are IF NOT EXISTS and idempotent.
-- If this runs on a busy production DB, wrap in a maintenance window or use
-- CREATE INDEX CONCURRENTLY (outside a transaction).

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------
-- trade_histories
-- ---------------------------------------------------------------------------

-- Serves: GET /vaults/:address/trades -> WHERE vault_id = ? ORDER BY executed_at DESC
--   (internal/handlers/trade_handler.go:62-77) and trade_repo.ListByVault
--   (internal/repository/trade_repo.go:53-68).
-- GORM's single-column vault_id and executed_at indexes force a sort on every
-- listing; this composite keeps rows pre-sorted in DESC order (no Sort node,
-- cheap LIMIT/OFFSET paging). Also accelerates agent 4's per-vault MV refreshes.
CREATE INDEX IF NOT EXISTS idx_trade_histories_vault_executed
    ON trade_histories (vault_id, executed_at DESC);

-- Serves: trade listings filtered by type without a vault predicate
--   (internal/repository/trade_repo.go:57-58, vaultID == "" + tradeType != "").
-- Combined with the index above the planner can BitmapAnd for the
-- vault_id + trade_type + ORDER BY executed_at DESC case.
CREATE INDEX IF NOT EXISTS idx_trade_histories_type_executed
    ON trade_histories (trade_type, executed_at DESC);

-- NOTE: actor_id is already covered by GORM's single-column index tag
-- (internal/models/trade_history.go) -- no new index needed.

-- ---------------------------------------------------------------------------
-- portfolios
-- ---------------------------------------------------------------------------

-- Serves: position upsert/reduce lookups -> WHERE user_id = ? AND vault_id = ?
--   (internal/repository/portfolio_repo.go:25,59 and internal/services/pnl_service.go:37,71).
-- Turns a bitmap scan of two single-column indexes into a single unique lookup,
-- and hardens the First()/Create() upsert against duplicate-position races
-- (concurrent syncs for the same user+vault would now fail on the second insert
-- instead of silently creating a duplicate row).
-- Leftmost prefix (user_id) also serves GetByUser / BatchRecalculate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_portfolios_user_vault
    ON portfolios (user_id, vault_id);

-- NOTE: vault_id is already covered by GORM's single-column index tag -- it
-- serves GetTotalSharesByVault / RecalculatePosition SUMs
-- (internal/repository/portfolio_repo.go:107, internal/services/pnl_service.go:107),
-- the GetVault portfolio count (internal/handlers/vault_handler.go:94) and the
-- GROUP BY vault_id share aggregate (internal/handlers/portfolio_handler.go:67-71).

-- ---------------------------------------------------------------------------
-- vaults
-- ---------------------------------------------------------------------------

-- Serves: ListVaults -> WHERE status = ? (plus COUNT) 
--   (internal/handlers/vault_handler.go:44-57, internal/repository/vault_repo.go:54-66).
-- status has NO gorm tag, so this is the first index on the column.
-- Low-cardinality column: with a small vaults table the planner may still choose
-- a seq scan; if listings are dominated by one status (e.g. 'Active'), consider
-- a partial index instead: CREATE INDEX idx_vaults_active ON vaults (id) WHERE status = 'Active';
CREATE INDEX IF NOT EXISTS idx_vaults_status
    ON vaults (status);

-- ---------------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------------
-- Nothing to add: wallet_address has a GORM uniqueIndex tag, and no other
-- column is filtered or joined on (internal/repository/user_repo.go).
