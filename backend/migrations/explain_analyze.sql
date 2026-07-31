-- explain_analyze.sql
-- EXPLAIN ANALYZE verification for the B-tree indexes from 020_btree_indexes.sql.
--
-- USAGE (agent 10 / QA):
--   1. Apply migrations/020_btree_indexes.sql first.
--   2. Replace the UUID literals below with real values from the running DB:
--        psql "$DATABASE_URL" -c "SELECT id FROM trade_histories LIMIT 1;"   -- etc.
--   3. psql -d "$DATABASE_URL" -f migrations/explain_analyze.sql
--   4. For a before/after comparison, re-run the same queries BEFORE applying
--      020_btree_indexes.sql and diff the node types.
--
-- WHAT TO LOOK FOR:
--   GOOD:  "Index Scan using <our index name>" (or Bitmap Index Scan -> Bitmap
--          Heap Scan) with small "rows" / low "Buffers" and NO "Sort" node.
--   BAD:   "Seq Scan" (full table scan), or "Index Scan" followed by a
--          separate "Sort" node (index not covering the ORDER BY).
--   Our four indexes must appear:
--     idx_trade_histories_vault_executed, idx_trade_histories_type_executed,
--     uq_portfolios_user_vault, idx_vaults_status.

\set ON_ERROR_STOP on

-- (a) Per-vault trade list with type filter + DESC ordering
--     Mirrors internal/handlers/trade_handler.go:62-77 and
--     internal/repository/trade_repo.go:53-68.
--     EXPECTED after 020: Index Scan using idx_trade_histories_vault_executed
--     with a filter on trade_type (or BitmapAnd of idx_trade_histories_vault_executed
--     + idx_trade_histories_type_executed), no Sort node.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, vault_id, actor_id, trade_type, amount_in, amount_out, executed_at
FROM trade_histories
WHERE vault_id = 'REPLACE_WITH_REAL_VAULT_ID'
  AND trade_type = 'Buy'
ORDER BY executed_at DESC
LIMIT 20;

-- (b) Portfolio position lookup by user + vault
--     Mirrors internal/repository/portfolio_repo.go:25 and
--     internal/services/pnl_service.go:37 (upsert hot path).
--     EXPECTED after 020: Index Scan using uq_portfolios_user_vault.
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, user_id, vault_id, shares_owned, total_invested_value, average_entry_price
FROM portfolios
WHERE user_id = 'REPLACE_WITH_REAL_USER_ID'
  AND vault_id = 'REPLACE_WITH_REAL_VAULT_ID';

-- (c) Vault list by status
--     Mirrors internal/handlers/vault_handler.go:44-57 and
--     internal/repository/vault_repo.go:54-66 (GORM adds deleted_at IS NULL).
--     EXPECTED after 020: Index Scan using idx_vaults_status (or Bitmap).
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, address, manager_id, status
FROM vaults
WHERE status = 'Active'
  AND deleted_at IS NULL
ORDER BY id ASC
LIMIT 20;

-- (d) PnL aggregate: total shares grouped by vault_id
--     Mirrors internal/handlers/portfolio_handler.go:67-71.
--     Served by GORM's single-column idx_portfolios_vault_id (020 adds no index
--     here on purpose) -- proves the FK index is actively used for aggregations.
--     EXPECTED: Index Scan using idx_portfolios_vault_id, HashAggregate on top.
EXPLAIN (ANALYZE, BUFFERS)
SELECT vault_id, COALESCE(SUM(shares_owned), 0) AS total
FROM portfolios
WHERE vault_id IN ('REPLACE_WITH_REAL_VAULT_ID')
GROUP BY vault_id;

-- (e) Sanity check: confirm the 020 indexes exist and are enabled.
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_trade_histories_vault_executed',
    'idx_trade_histories_type_executed',
    'uq_portfolios_user_vault',
    'idx_vaults_status'
  )
ORDER BY indexname;

-- (f) Planner hint: are the indexes actually usable (not invalid)?
SELECT indexrelid::regclass AS index, indisvalid, indisready
FROM pg_index
WHERE indexrelid::regclass::text IN (
  'idx_trade_histories_vault_executed',
  'idx_trade_histories_type_executed',
  'uq_portfolios_user_vault',
  'idx_vaults_status'
);
