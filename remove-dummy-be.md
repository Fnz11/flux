# Backend Dummy Data & Fake Logic Removal Plan

This plan details the removal of simulated logic, fake handlers, and the implementation of missing backend endpoints. The work is divided into 10 distinct subagent streams.

## Subagent 1: Seeder & Localnet Setup Cleanup
- **Role**: Backend Infrastructure Specialist
- **Tasks**:
  1. Refactor `seed.go` to remove `simulateSignature()` for internal vault Buy/Sell swaps. Connect to the local Pyth/AMM program to perform actual swaps.
  2. Enhance `sol.Airdrop()` with intelligent backoff and retry logic to prevent rate-limit crashes on Devnet.
  3. Ensure `fundAccounts` verifies balance properly before attempting to request massive SOL airdrops.

## Subagent 2: Transaction Enforcement
- **Role**: Backend Security Specialist
- **Tasks**:
  1. Delete `SimulateTransaction` from `transaction_handler.go`.
  2. Implement a new `VerifyTransaction` endpoint that accepts an on-chain signature, verifies it against the RPC, and only then updates the internal database state.
  3. Update router mappings to remove all `/simulate` routes.

## Subagent 3: Market Metrics Aggregation
- **Role**: Database Engineer
- **Tasks**:
  1. Write TimescaleDB continuous aggregates (or materialized views) for global TVL, 24h Volume, and Platform ATH.
  2. Implement the repository methods in `metrics_repository.go` to query these aggregates efficiently.

## Subagent 4: Market Metrics API
- **Role**: Backend Developer
- **Tasks**:
  1. Create `/api/v1/metrics/global` endpoint.
  2. Wire the handler to the newly created repository methods from Subagent 3.
  3. Ensure the JSON response perfectly matches the interface expected by the frontend's `PerformanceChart`.

## Subagent 5: Leaderboard Engine
- **Role**: Database Engineer
- **Tasks**:
  1. Create database queries/views for "Trending" (highest volume), "Top Gainers" (highest % PnL), and "New" (recently created) tokens/vaults.
  2. Implement caching (Redis) for these queries to prevent database strain on the dashboard load.

## Subagent 6: Leaderboard API
- **Role**: Backend Developer
- **Tasks**:
  1. Implement `/api/v1/metrics/leaderboard` endpoint.
  2. Structure the response into the 3 categories (Trending, Gainers, New) matching the `LEADERBOARD_DATA` mock structure.

## Subagent 7: Portfolio Historical Series
- **Role**: Backend Developer
- **Tasks**:
  1. Implement `/api/v1/portfolio/{wallet}/history`.
  2. Query time-series data to calculate day-by-day Net Asset Value (NAV) and PnL for a given user's portfolio over the last 30/90 days.
  3. Format the output to directly replace the step-wise fake array in `usePortfolioView.ts`.

## Subagent 8: Vault Sparkline API
- **Role**: Backend Developer
- **Tasks**:
  1. Create `/api/v1/vaults/{id}/sparkline`.
  2. Query historical performance metrics for a specific vault to generate a normalized 10-point array.
  3. Alternatively, augment the existing `GET /vaults` endpoint to include a `sparkline: []int` field to prevent N+1 queries on the frontend tables.

## Subagent 9: Global Transactions Feed
- **Role**: Backend Developer
- **Tasks**:
  1. Implement a global `/api/v1/transactions` feed endpoint.
  2. Return a paginated list of recent deposits, withdrawals, and vault swaps across all users and vaults.
  3. Ensure sensitive user data is scrubbed before broadcasting.

## Subagent 10: WebSocket Real-time Feeds
- **Role**: Backend WebSocket Specialist
- **Tasks**:
  1. Update `ws.go` to broadcast new transactions to a `global:activity` channel.
  2. Broadcast leaderboard position changes to a `global:leaderboard` channel.
  3. Ensure the frontend can subscribe to these channels to eliminate the need for HTTP polling on the dashboard.
