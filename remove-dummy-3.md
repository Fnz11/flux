# Dummy Data Removal — Final Audit Report

Generated: 2026-08-08 · Audited by: backend_auditor + frontend_auditor subagents

---

## Overall Score

| Layer | Done | Partial | Not Done | Total |
|---|---|---|---|---|
| **Frontend** (remove-dummy.md SA6–SA10) | **5** | 0 | 0 | 5 |
| **Backend** (remove-dummy-be.md SA1–SA10) | **10** | 0 | 0 | 10 |
| **Combined** | **15** | 0 | 0 | 15 |

> [!NOTE]
> The frontend team delivered a **perfect 5/5**. The backend team delivered **8/10** with one partial and one outstanding task.

---

## Frontend Audit (remove-dummy.md — SA6 to SA10)

### ✅ FE-SA6 — Global Market UI Integration
**Status: DONE**

- [`market.service.ts`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/services/apis/rest-api/market.service.ts) was created with `getMarketStats()` (`/metrics/market`) and `getLeaderboard()` (`/metrics/leaderboard`).
- [`PerformanceChart.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/portfolio/_components/PerformanceChart.tsx#L82) now uses `useMarketStatsQuery()`. All hardcoded values (`$75,843.52`, `$1.86T`, `19.8M SOL`, `$96,091.34`) were removed.
- [`LeaderboardWidget.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/portfolio/_components/LeaderboardWidget.tsx#L31) now uses `useLeaderboardQuery(tab)`. The static `LEADERBOARD_DATA` object was fully removed.

---

### ✅ FE-SA7 — Portfolio Charts & UI Integration
**Status: DONE**

- [`usePortfolioView.ts`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/portfolio/_hooks/usePortfolioView.ts#L13) now fetches real historical NAV data via `usePortfolioHistoryQuery(walletAddress)`. The fake step-wise array (`totalInvested + totalPnl * 0.3`, etc.) is completely gone.
- [`PortfolioSummary.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/portfolio/_components/PortfolioSummary.tsx#L104-L113) now calculates the percentage change dynamically using `change.pct` and `totalPnlPercent`. The hardcoded `+28.32%` was removed.

---

### ✅ FE-SA8 — Vault Analytics & Sparklines
**Status: DONE**

- [`VaultSparkline.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/vaults/_components/VaultSparkline.tsx#L16-L31) — The hardcoded fallback `[10, 12, 11, 15, 14, 18, 17, 22, 20, 25]` was removed. It now renders a dashed line when no data is provided.
- [`VaultsTable.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/vaults/_components/VaultsTable.tsx#L56), [`InvestorVaultsList.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/_components/InvestorVaultsList.tsx#L14), and [`ManagerVaultsList.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/_components/ManagerVaultsList.tsx#L31) all query via `useVaultSparklineQuery(vaultId)` and pass real arrays to `<VaultSparkline data={sparkline} />`.
- [`PriceDisplay.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/trade/_components/PriceDisplay.tsx#L89-L128) now plots live Pyth price history dynamically.
- [`InvestSummary.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/invest/_components/InvestSummary.tsx#L19-L35) computes SVG polygon/polyline paths from real `usePortfolioHistoryQuery` data points.

---

### ✅ FE-SA9 — Wallet & Edge-Case Fallbacks
**Status: DONE**

- [`WalletConnectButton.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/components/ui/WalletConnectButton.tsx) — The Demo Wallet button and hardcoded pubkey (`5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1`) were removed.
- [`VaultAssetsPanel.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/trade/_components/VaultAssetsPanel.tsx#L24) — The hardcoded SOL/USDC/USDT/PYTH fallback array was removed. Balances are fetched via `useVaultBalancesQuery(vaultId)`. The hardcoded `+12.4%` badge was replaced with the computed `allocPct`.

---

### ✅ FE-SA10 — Trade & Deposit Enforcement
**Status: DONE**

- [`invest/index.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/invest/index.tsx#L80) now renders a `<RecentActivity />` component which fetches from the real global transactions endpoint via `useGlobalTransactionsQuery`.
- [`useDeposit.ts`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/hooks/useDeposit.ts), [`useWithdraw.ts`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/hooks/useWithdraw.ts), [`useExecuteTrade.ts`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/hooks/useExecuteTrade.ts) — All now execute strict on-chain Anchor instructions. Zero references to `/transactions/simulate` remain in `frontend/src`.

---

## Backend Audit (remove-dummy-be.md — SA1 to SA10)

### ✅ BE-SA1 — Seeder & Localnet Setup Cleanup
**Status: DONE**

- [`seed.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/seed/seed.go) — `simulateSignature()` fully removed. Buy/Sell swaps now produce real on-chain memo transactions signed by the vault keypair via `sol.Sign()`.
- [`solana.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/seed/solana.go#L69-L114) — `Airdrop()` now uses `airdropWithRetry()` with exponential backoff, jitter, rate limit detection (`isRateLimitCode`, `hasRateLimitMarker`), and a max of 6 attempts. Covered by unit tests in `backoff_test.go`.

---

### ✅ BE-SA2 — Transaction Enforcement
**Status: DONE**

- `transaction_handler.go` and the `SimulateTransaction` function were completely deleted.
- [`verify_handler.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/handlers/verify_handler.go#L67-L157) implements the new `VerifyTransaction` endpoint which validates on-chain signatures against the RPC before updating DB state.
- [`router.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/router/router.go#L147) now registers `POST /api/v1/transactions/verify` (auth-guarded). No `/simulate` route exists anywhere.

---

### ✅ BE-SA3 — Market Metrics Aggregation
**Status: DONE**

- [`080_global_metrics_cagg.sql`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/migrations/080_global_metrics_cagg.sql) — Three TimescaleDB continuous aggregates created: `cagg_global_volume_1h`, `cagg_global_tvl_1h`, `cagg_global_ath_price_1h`.
- [`global_metrics_repo.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/repository/global_metrics_repo.go#L69-L191) — Repository queries these CAGGs with a fallback to raw table queries when CAGGs are unavailable.

---

### ✅ BE-SA4 — Market Metrics API
**Status: DONE**

- [`global_metrics_handler.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/handlers/global_metrics_handler.go) — `GET /api/v1/metrics/global` endpoint registered in [`router.go:L137`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/router/router.go#L137).
- [`market_handler.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/handlers/market_handler.go) — `GET /api/v1/metrics/market` endpoint registered in [`router.go:L131`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/router/router.go#L131).

---

### ✅ BE-SA5 — Leaderboard Engine
**Status: DONE**

- [`050_cagg_trade_volume.sql`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/migrations/050_cagg_trade_volume.sql) — `cagg_trade_volume_1h` CAGG for volume ranking.
- [`010_timescale_hypertables.sql`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/migrations/010_timescale_hypertables.sql) — `cagg_price_ohlcv_1h` for price-change ranking.
- [`leaderboard_repo.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/repository/leaderboard_repo.go) implements `getTrending()` (by volume), `getGainers()` (by % price change), and `getNew()` (by `created_at DESC`).

---

### ✅ BE-SA6 — Leaderboard API
**Status: DONE**

- [`leaderboard_handler.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/handlers/leaderboard_handler.go#L28-L64) — `GET /api/v1/metrics/leaderboard` registered in [`router.go:L134`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/router/router.go#L134). Supports `type` (trending/gainers/new), `limit`, and `period` query parameters.

---

### ✅ BE-SA7 — Portfolio Historical Series
**Status: DONE**

- [`history_handler.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/handlers/history_handler.go#L65-L102) and [`history_repo.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/repository/history_repo.go#L100) exist and are functional.
- **Route contract**: `GET /api/v1/portfolio/history?wallet={address}` (query param) is the agreed shape. Both sides are aligned:
  - Backend: `router.go:L117` registers `GET /api/v1/portfolio/history`, handler reads `c.Query("wallet")`.
  - Frontend: [`portfolio_history.service.ts`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/services/apis/rest-api/portfolio_history.service.ts#L10) calls `/portfolio/history` with `{ wallet, range }` query params.
  - Consumers: `usePortfolioView.ts`, `PortfolioSummary.tsx`, `InvestSummary.tsx` all use `usePortfolioHistoryQuery(wallet)`.

---

### ✅ BE-SA8 — Vault Sparkline API
**Status: DONE**

- `GET /api/v1/vaults/:id/sparkline` registered in [`router.go:L96`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/router/router.go#L96).
- Implemented in [`history_handler.go:L24-L63`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/handlers/history_handler.go#L24-L63) returning a normalized point array for the frontend chart.

---

### ✅ BE-SA9 — Global Transactions Feed
**Status: DONE**

- `GET /api/v1/transactions` registered in [`router.go:L144`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/router/router.go#L144).
- [`global_feed_handler.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/handlers/global_feed_handler.go#L38-L82) implements pagination (`page`, `limit`), optional filters (`wallet`, `type`), and returns `items` + `total`.

---

### ✅ BE-SA10 — WebSocket Real-time Feeds
**Status: DONE**

- [`event_service.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/services/event_service.go): `DispatchTradeConfirmed` now broadcasts to both `vault:<id>` and `global:activity`. New `DispatchGlobalLeaderboard()` broadcasts an empty-payload `leaderboard_update` to `global:leaderboard` (frontend refetches real data — no fabricated values).
- [`sync_handler.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/handlers/sync_handler.go): calls `DispatchGlobalLeaderboard()` after vault updates and confirmed trades.
- [`hub.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/ws/hub.go) + [`client.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/ws/client.go): `global:*` channels are subscribable by anonymous clients via existing generic fan-out (`canSubscribe` returns true for non-wallet-scoped channels); no hub changes needed.
- Test coverage added in [`websocket_test.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/ws/websocket_test.go) and [`event_service_test.go`](file:///Users/macbookprom1/projects/fbyt-clone-1/backend/internal/services/event_service_test.go).
- Frontend: `useRouteWsChannel` wired for Invest (`global:activity`), Dashboard (`global:activity` + `global:leaderboard`), and Portfolio (`global:leaderboard`). [`RecentActivity.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/invest/_components/RecentActivity.tsx) invalidates `['transactions']` on `trade_confirmed`; [`LeaderboardWidget.tsx`](file:///Users/macbookprom1/projects/fbyt-clone-1/frontend/src/routes/portfolio/_components/LeaderboardWidget.tsx#L38-L45) invalidates `['leaderboard']` on `leaderboard_update`. Real-time push replaces HTTP polling.

---

## Remaining Work

All 15 audit items are complete (Frontend 5/5, Backend 10/10). No remaining work.

| ID | Area | Status |
|---|---|---|
| **BE-SA7** ✅ | Portfolio History route shape | DONE — query-param shape `GET /api/v1/portfolio/history?wallet=...` aligned across backend router + frontend service. |
| **BE-SA10** ✅ | WebSocket global channels | DONE — `global:activity`/`global:leaderboard` broadcasts + fan-out + frontend `useRouteWsChannel` wiring with live refetch. |
