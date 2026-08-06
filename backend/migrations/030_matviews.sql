-- ============================================================================
-- 030_matviews.sql
-- Materialized Views: portfolio_summary, user_pnl_summary
-- Owner: Subagent 4 (SQL layer, opt.md Task 4.x)
--
-- Executed as a single psql script (also at app startup by AutoMigrate via
-- sqlDB.Exec). All statements are guarded; safe to re-run. Run on a direct
-- 5432 connection, never through PgBouncer.
--
-- Purpose
--   Pre-aggregate the two heaviest read patterns so API endpoints stop
--   scanning raw trade_histories / portfolios rows:
--     * portfolio_summary : per-vault current holdings (vault detail/listing)
--     * user_pnl_summary  : per (user, vault) realized + unrealized PNL
--
-- Refresh contract (with Subagent 5's background worker)
--   REFRESH MATERIALIZED VIEW CONCURRENTLY portfolio_summary;  -- every 5 min
--   REFRESH MATERIALIZED VIEW CONCURRENTLY user_pnl_summary;   -- every 5 min
--   UNIQUE indexes below are MANDATORY for CONCURRENTLY refresh.
--
-- Staleness tradeoff
--   Views are up to ~5 min behind the source tables. This is acceptable for
--   all READ paths (vault stats, PNL dashboards, listing endpoints) that are
--   non-consistency-critical. Writes (deposits/withdraws/trades) MUST keep
--   updating portfolios / trade_histories as today -- those tables remain
--   the system of record. Never write to a materialized view.
--
-- Guarded-creation contract
--   The views are created inside DO blocks guarded by to_regclass(), NOT with
--   DROP MATERIALIZED VIEW ... CASCADE + CREATE. Re-running this file is safe:
--     * An existing view is left untouched (its definition and any downstream
--       dependents --- e.g. another view or index built on top of it --- are NOT
--       destroyed, which the old CASCADE drop would have torn down).
--     * A fresh view is created as the SELECT bodies below describe.
--   The MVs depend on column types of the base tables; GORM AutoMigrate
--   (internal/database/migrate.go) drops them with CASCADE itself before
--   running this file, so those two DROPs never appear here.
--   The UNIQUE / secondary indexes live OUTSIDE the DO blocks (all IF NOT
--   EXISTS) so they apply even when the view already existed from a prior run.
--
--   Required for REFRESH MATERIALIZED VIEW CONCURRENTLY (agent 5): every MV
--   must have a UNIQUE index; they are declared here right after creation.
--
-- Conventions
--   * vaults.deleted_at IS NULL filter excludes soft-deleted vaults.
--   * All numeric outputs are cast to numeric(36,18) to mirror the Go models.
--   * Standard PostgreSQL only (no timescaledb syntax; agent 2's hypertables
--     are separate). time_bucket() could be layered on later if needed.
-- ============================================================================


-- Fail fast instead of blocking production traffic (README conventions).
SET lock_timeout = '10s';

-- ============================================================================
-- portfolio_summary
-- Grain: one row per vault (all vaults, including zero-holder ones).
--
-- TVL source: vaults.tvl (canonical on-chain TVL, the same value the domain's
-- PnLService uses as the current-value basis). SUM(portfolios.total_invested)
-- is COST BASIS, not market value -- exposed as total_invested, not tvl.
--
-- avg_entry_price is weighted across all holders:
--   SUM(shares_owned * average_entry_price) / SUM(shares_owned)
-- ============================================================================

-- Guarded creation: only create when the view does not already exist. See
-- the "Guarded-creation contract" header comment. The CREATE runs inside a
-- DO block so re-running the file never drops a downstream dependent.
DO $do$
BEGIN
    IF to_regclass('public.portfolio_summary') IS NULL THEN
        CREATE MATERIALIZED VIEW portfolio_summary AS
        SELECT
            v.id                                        AS vault_id,
            v.address                                   AS vault_address,
            v.manager_id                                AS manager_id,
            u.wallet_address                            AS manager_address,
            v.status                                    AS status,
            v.tvl::numeric(36,18)                       AS tvl,
            COALESCE(p.total_shares, 0)::numeric(36,18) AS total_shares,
            COALESCE(p.share_holders_count, 0)::bigint  AS share_holders_count,
            COALESCE(p.total_invested, 0)::numeric(36,18) AS total_invested,
            p.avg_entry_price::numeric(36,18)           AS avg_entry_price,
            COALESCE(t.trade_count, 0)::bigint          AS trade_count,
            COALESCE(
                GREATEST(v.updated_at, p.max_portfolio_updated, t.max_trade_executed),
                v.updated_at
            )                                           AS last_activity_at,
            now()::timestamptz                          AS as_of
        FROM vaults v
        LEFT JOIN users u ON u.id = v.manager_id
        LEFT JOIN (
            SELECT
                vault_id,
                SUM(shares_owned)                                          AS total_shares,
                COUNT(DISTINCT user_id)                                    AS share_holders_count,
                SUM(total_invested_value)                                  AS total_invested,
                SUM(shares_owned * average_entry_price)
                    / NULLIF(SUM(shares_owned), 0)                         AS avg_entry_price,
                MAX(updated_at)                                            AS max_portfolio_updated
            FROM portfolios
            GROUP BY vault_id
        ) p ON p.vault_id = v.id
        LEFT JOIN (
            SELECT
                vault_id,
                COUNT(*)      AS trade_count,
                MAX(executed_at) AS max_trade_executed
            FROM trade_histories
            GROUP BY vault_id
        ) t ON t.vault_id = v.id
        WHERE v.deleted_at IS NULL;
    END IF;
END $do$;

-- REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY (agent 5).
CREATE UNIQUE INDEX IF NOT EXISTS idx_portfolio_summary_vault
    ON portfolio_summary (vault_id);


-- ============================================================================
-- user_pnl_summary
-- Grain: one row per (user_id, vault_id) position. A user's total PNL is a
-- GROUP BY user_id over this view (a handful of rows per user).
--
-- current_value proxy (matches internal/services/pnl_service.go
-- RecalculatePosition): user's pro-rata share of the vault's on-chain TVL
--     current_value = (shares_owned / vault_total_shares) * vaults.tvl
--
-- realized_pnl (from trade_histories):
--     SUM(amount_out - amount_in) over position-closing trades
--     (trade_type = 'Withdraw'; the only trade type that closes a user
--     position -- 'Buy' is a vault-internal swap, 'Deposit' opens/adds one).
--     NOTE: sync_handler currently stores amount_out = 0 for Withdraw
--     instructions; until it captures withdrawal proceeds, this column
--     equals -SUM(shares withdrawn). Once proceeds are persisted the same
--     query yields dollar realized PNL after the next refresh.
--
-- unrealized_pnl  = current_value - total_invested
-- pnl_percent     = (unrealized_pnl / total_invested) * 100, 0 when invested = 0
-- total_pnl       = realized_pnl + unrealized_pnl
-- ============================================================================

-- Guarded creation: only create when the view does not already exist. See
-- the "Guarded-creation contract" header comment.
DO $do$
BEGIN
    IF to_regclass('public.user_pnl_summary') IS NULL THEN
        CREATE MATERIALIZED VIEW user_pnl_summary AS
        SELECT
            x.user_id                                   AS user_id,
            x.vault_id                                  AS vault_id,
            v.address                                   AS vault_address,
            COALESCE(NULLIF(v.metadata->>'name', ''), NULLIF(v.metadata->>'displayName', ''), v.address) AS vault_name,
            COALESCE(x.shares_owned, 0)::numeric(36,18) AS shares_owned,
            COALESCE(x.total_invested, 0)::numeric(36,18) AS total_invested,
            x.avg_entry_price::numeric(36,18)           AS average_entry_price,
            COALESCE(x.vault_total_shares, 0)::numeric(36,18) AS vault_total_shares,
            v.tvl::numeric(36,18)                       AS vault_tvl,
            CASE
                WHEN COALESCE(x.vault_total_shares, 0) > 0
                THEN (COALESCE(x.shares_owned, 0) / x.vault_total_shares * v.tvl)::numeric(36,18)
                ELSE 0::numeric(36,18)
            END                                         AS current_value,
            COALESCE(x.realized_pnl, 0)::numeric(36,18) AS realized_pnl,
            (
                CASE
                    WHEN COALESCE(x.vault_total_shares, 0) > 0
                    THEN COALESCE(x.shares_owned, 0) / x.vault_total_shares * v.tvl
                    ELSE 0
                END
                - COALESCE(x.total_invested, 0)
            )::numeric(36,18)                           AS unrealized_pnl,
            COALESCE(
                (
                    CASE
                        WHEN COALESCE(x.vault_total_shares, 0) > 0
                        THEN COALESCE(x.shares_owned, 0) / x.vault_total_shares * v.tvl
                        ELSE 0
                    END
                    - COALESCE(x.total_invested, 0)
                ) / NULLIF(COALESCE(x.total_invested, 0), 0) * 100,
                0
            )::numeric(36,18)                           AS pnl_percent,
            (
                COALESCE(x.realized_pnl, 0)
                + CASE
                    WHEN COALESCE(x.vault_total_shares, 0) > 0
                    THEN COALESCE(x.shares_owned, 0) / x.vault_total_shares * v.tvl
                    ELSE 0
                  END
                - COALESCE(x.total_invested, 0)
            )::numeric(36,18)                           AS total_pnl,
            COALESCE(
                GREATEST(v.updated_at, x.max_portfolio_updated, x.max_trade_executed),
                v.updated_at
            )                                           AS last_activity_at,
            now()::timestamptz                          AS as_of
        FROM vaults v
        JOIN (
            SELECT
                COALESCE(pos.user_id, rl.actor_id)  AS user_id,
                COALESCE(pos.vault_id, rl.vault_id) AS vault_id,
                pos.shares_owned                    AS shares_owned,
                pos.total_invested                  AS total_invested,
                pos.avg_entry_price                 AS avg_entry_price,
                pos.vault_total_shares              AS vault_total_shares,
                rl.realized_pnl                     AS realized_pnl,
                pos.max_portfolio_updated           AS max_portfolio_updated,
                rl.max_trade_executed               AS max_trade_executed
            FROM (
                SELECT
                    user_id,
                    vault_id,
                    SUM(shares_owned)                                          AS shares_owned,
                    SUM(total_invested_value)                                  AS total_invested,
                    SUM(shares_owned * average_entry_price)
                        / NULLIF(SUM(shares_owned), 0)                         AS avg_entry_price,
                    SUM(SUM(shares_owned)) OVER (PARTITION BY vault_id)        AS vault_total_shares,
                    MAX(updated_at)                                            AS max_portfolio_updated
                FROM portfolios
                GROUP BY user_id, vault_id
            ) pos
            FULL OUTER JOIN (
                SELECT
                    actor_id,
                    vault_id,
                    SUM(amount_out - amount_in) AS realized_pnl,
                    MAX(executed_at)            AS max_trade_executed
                FROM trade_histories
                WHERE trade_type = 'Withdraw'
                GROUP BY actor_id, vault_id
            ) rl ON rl.actor_id = pos.user_id AND rl.vault_id = pos.vault_id
        ) x ON x.vault_id = v.id
        WHERE v.deleted_at IS NULL;
    END IF;
END $do$;

-- REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY (agent 5).
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_pnl_summary_user_vault
    ON user_pnl_summary (user_id, vault_id);

-- Non-unique: supports vault-scoped reads (holder list per vault, agent 7).
CREATE INDEX IF NOT EXISTS idx_user_pnl_summary_vault
    ON user_pnl_summary (vault_id);
