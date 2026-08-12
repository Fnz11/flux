# Dummy Data Removal & Real Data Integration Plan

This plan breaks down the removal of all hardcoded mock data, fake charts, and simulated fallbacks across both the Frontend and Backend into 10 distinct, concurrent subagent tasks.

## Backend Subagents

### Subagent 1: Market Metrics Service (Backend)
- **Role**: Backend Developer
- **Task**: Implement a new REST endpoint `/api/v1/metrics/market` to serve global market statistics (Market Cap, Circulating Supply, 24h Volume, ATH). This will replace the hardcoded stats in the frontend `PerformanceChart`.

### Subagent 2: Leaderboard Service (Backend)
- **Role**: Backend Developer
- **Task**: Implement a new REST endpoint `/api/v1/metrics/leaderboard` to serve "Trending", "Top Gainers", and "New Tokens". Ensure it reads from the database or an active caching layer. This replaces the hardcoded `LEADERBOARD_DATA` object.

### Subagent 3: Historical Series Service (Backend)
- **Role**: Backend Developer
- **Task**: Create endpoints (e.g., `/api/v1/vaults/:id/sparkline` and `/api/v1/portfolio/history`) that return historical NAV and PnL data arrays. This will replace the fake step-wise month-over-month growth in `usePortfolioView` and provide data for `VaultSparkline`.

### Subagent 4: Global Activity Feed (Backend)
- **Role**: Backend Developer
- **Task**: Implement a global `/api/v1/transactions` feed endpoint that returns recent deposits, withdrawals, and vault swaps across the entire platform. This provides data for the empty "Recent Activity" table on the Invest page.

### Subagent 5: Simulation & Fallback Cleanup (Backend)
- **Role**: Backend Developer
- **Task**: Remove or restrict the `/api/v1/transactions/simulate` endpoint from `transaction_handler.go`. Clean up any remaining demo/mock transaction routing that avoids actual on-chain verification, ensuring strict production flow.

---

## Frontend Subagents

### Subagent 6: Global Market UI Integration (Frontend)
- **Role**: Frontend Developer
- **Task**: Create a `market.service.ts` hook. Wire up `PerformanceChart.tsx` and `LeaderboardWidget.tsx` to use the new `/api/v1/metrics/market` and `/api/v1/metrics/leaderboard` endpoints, removing all static JSON.

### Subagent 7: Portfolio Charts & UI Integration (Frontend)
- **Role**: Frontend Developer
- **Task**: Refactor `usePortfolioView.ts` to fetch actual historical arrays from the backend instead of generating fake `totalInvested + totalPnl * 0.3` arrays. Fix `PortfolioSummary.tsx` to calculate real month-over-month PnL instead of hardcoding `+28.32%`.

### Subagent 8: Vault Analytics & Sparklines (Frontend)
- **Role**: Frontend Developer
- **Task**: Update `VaultsTable.tsx`, `InvestorVaultsList.tsx`, and `ManagerVaultsList.tsx` to pass real sparkline arrays to `VaultSparkline.tsx`, replacing the hardcoded `[10, 12, 11...]`. Remove the static SVG path charts in `PriceDisplay.tsx` and `InvestSummary.tsx` and replace them with real data bindings.

### Subagent 9: Wallet & Edge-Case Fallbacks (Frontend)
- **Role**: Frontend Developer
- **Task**: Remove the "Demo Wallet (Devnet)" button and hardcoded public key from `WalletConnectButton.tsx`. Remove the hardcoded fallback balances (`SOL`, `USDC`, `USDT`, `PYTH`) from `VaultAssetsPanel.tsx`.

### Subagent 10: Trade & Deposit Enforcement (Frontend)
- **Role**: Frontend Developer
- **Task**: Map the "Recent Activity" table in `invest/index.tsx` to the global transactions feed. Refactor `useDeposit.ts`, `useWithdraw.ts`, and `useExecuteTrade.ts` to remove the fallback calls to `/transactions/simulate`, strictly enforcing on-chain execution.

---

## Review & Approval Required
Before spawning these agents, please confirm if this division of labor looks correct to you!
