# Vault Optimization Plan: Precomputed Materialized Views

Based on an analysis of the current backend implementation (specifically `internal/repository/vault_repo.go`), there are significant performance bottlenecks related to dynamic aggregations on the `/vaults/:id` and `/vaults` (List) routes. 

## 1. Current Bottlenecks

*   **Dynamic Counts (`fetchVaultCounts`)**: For every vault fetched, the system runs `COUNT(*)` subqueries on the `trade_histories` and `portfolios` tables. As the platform grows, these tables will become large, making these subqueries extremely slow.
*   **Dynamic Sparklines (`fetchBatchSparklines`)**: The 30-day TVL/Price sparklines are calculated on the fly by grouping raw `vault_metrics` or `price_histories` data by day and calculating the average (`DATE_TRUNC('day', timestamp)`, `AVG(value)`). This is a heavy aggregation to perform dynamically on every API request.
*   **In-Memory Balance Calculation (`GetVaultBalances`)**: To get current vault balances, the system currently fetches **ALL historical trades** (`db.Where("vault_id = ?", v.ID)...Find(&trades)`) for a vault and iterates through them in Go to calculate the holdings (adding deposits, subtracting withdrawals, etc.). This O(N) operation will inevitably cause severe memory spikes and timeouts as a vault accumulates more trades.

## 2. Proposed Optimizations

To resolve these bottlenecks, we should shift from "Compute on Read" to "Compute on Write" (or "Compute periodically") using Materialized Views and Summary Tables.

### A. Precomputed Vault Stats (Counts)
Instead of counting trades and portfolios dynamically:
1.  **Add Columns or a Stats Table**: Add `trade_count` and `portfolio_count` directly to the `vaults` table (or create a dedicated `vault_stats` table).
2.  **Event-Driven Updates**: Update these counts asynchronously when new data is ingested. 
    *   *Option 1 (DB level)*: PostgreSQL Triggers (`AFTER INSERT ON trade_histories`).
    *   *Option 2 (App level)*: Increment the counts in the same transaction where a trade or portfolio is created, or queue a background job to increment them.

### B. Precomputed Vault Balances (Crucial)
Instead of reducing all historical trades into balances on every read:
1.  **Create a `vault_balances` Table**: Structure: `id`, `vault_id`, `token_mint`, `amount`, `updated_at`.
2.  **Incremental Updates**: Whenever a `TradeHistory` is recorded (Deposit, Withdraw, Buy, Sell), the backend should simultaneously update the `vault_balances` table. 
    *   *Deposit*: `amount += AmountIn`
    *   *Withdraw*: `amount -= AmountOut`
3.  **Read Path**: The `GetVaultBalances` endpoint simply becomes a `SELECT * FROM vault_balances WHERE vault_id = ?`, dropping the complexity from O(N) trades to O(1) lookup.

### C. Materialized View for Sparklines
Instead of querying raw metrics and applying `DATE_TRUNC` and `AVG`:
1.  **PostgreSQL Materialized View**: Create a DB-level Materialized View:
    ```sql
    CREATE MATERIALIZED VIEW vault_daily_sparkline_mv AS
    SELECT vault_id, DATE_TRUNC('day', timestamp) AS bucket, AVG(value) AS val
    FROM vault_metrics
    WHERE metric = 'tvl'
    GROUP BY vault_id, DATE_TRUNC('day', timestamp);
    ```
2.  **Scheduled Refresh**: Run `REFRESH MATERIALIZED VIEW CONCURRENTLY vault_daily_sparkline_mv;` via a background cron job (e.g., every hour or at midnight).
3.  **Read Path**: The `/vaults/:address/sparkline` endpoint directly queries this view, which is pre-aggregated and indexed.

## 3. Implementation Steps

1.  **Schema Migration**: 
    *   Create the `vault_balances` table.
    *   Add count columns to the `vaults` table.
    *   Create the materialized view `vault_daily_sparkline_mv`.
2.  **Data Backfill (Migration script)**:
    *   Write a one-off script to compute current balances from all historical trades and insert them into `vault_balances`.
    *   Run an `UPDATE` statement to populate `trade_count` and `portfolio_count` in the `vaults` table.
3.  **Refactor Write Paths**:
    *   Update the logic in `trade_handler.go` / `trade_service.go` to maintain `vault_balances` and increment `trade_count` when recording a trade.
    *   Update the portfolio service to increment `portfolio_count`.
4.  **Refactor Read Paths (`vault_repo.go`)**:
    *   Remove `fetchVaultCounts` and simply read the columns from the `vault` struct.
    *   Update `GetVaultBalances` to query the new `vault_balances` table instead of fetching all trades.
    *   Update `fetchBatchSparklines` to query `vault_daily_sparkline_mv`.
