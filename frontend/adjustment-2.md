# Frontend Adjustment 2 - Codebase Audit

## 1. Missing Reusable Components

### [P0] KPI Stat Cards — `routes/index.tsx`, `routes/portfolio/_components/PortfolioSummary.tsx`
**Issue:** The 4 portfolio metric summary cards (Invested, Value, PNL, Return) and their identical JSX structures are copy-pasted directly into `index.tsx` (lines 118–141) and `PortfolioSummary.tsx` (lines 8–32). Any style change requires updating two places.
**Fix:** Remove the duplicated block from `index.tsx` and instead import `<PortfolioSummary />` there directly. The component already exists and is the single source of truth.

---

### [P1] Empty Vaults Table State — `routes/invest/index.tsx`, `routes/vaults/index.tsx`
**Issue:** Identical empty `<Table>` layout with `<TableEmpty>` state definitions are used in both invest and vaults list pages.
**Fix:** Extract a shared `<EmptyVaultsTable />` component inside `components/ui/` to eliminate the duplication.

---

## 2. Raw HTML → Shadcn Components

### [P0] Raw `<button>` tags — `components/ui/AddressPill.tsx`, `components/ui/EmptyState.tsx`, `components/ui/ErrorBoundary.tsx`, `components/ui/WalletConnectButton.tsx`, `components/ui/metric-controls.tsx`, `components/ui/toggle-group.tsx`
**Issue:** These UI components use standard raw `<button>` HTML elements instead of importing and using the project's `<Button>` from `components/ui/button.tsx`. This breaks visual consistency and bypasses the variant system.
**Fix:** Replace all raw `<button>` tags with `<Button>` from shadcn and map them to appropriate `variant` and `size` props.

---

### [P1] Raw `<input>` tag — `components/ui/NavHeader.tsx`
**Issue:** Uses a raw `<input>` HTML element for the search bar. The `<Input />` shadcn component is available and adds consistent focus rings, sizing, and dark mode support.
**Fix:** Import and use `<Input />` from `@/components/ui/input` with appropriate `className` overrides.

---

## 3. Hardcoded CSS → Design Tokens

### [P0] Hardcoded Hex Colors in KPI Borders — `routes/index.tsx`, `routes/portfolio/_components/PortfolioSummary.tsx`
**Issue:** The stat cards use hardcoded hex values for their colored left borders:
- `border-l-[#ff8a65]` → should be `border-l-primary-coral`
- `border-l-[#f4d03f]` → should be `border-l-primary-gold`
- `border-l-[#28C840]` → should be `border-l-status-success`
- `border-l-[#FF5F57]` → should be `border-l-status-error`

**Fix:** Replace all hardcoded color values with the project's defined design token utilities in `styles.css`. This ensures changes to the design system propagate everywhere automatically.

---

## 4. Monolithic Files → Decompose

### [P0] Settings Page — `routes/settings.tsx`
**Issue:** Over 150 lines with three completely independent settings sections (Wallet Connection, Network/RPC Config, Trade Execution Parameters) all hardcoded into a single component tree with mixed local state.
**Fix:** Split into sub-components in a `routes/settings/_components/` directory:
- `<WalletStatus />` — displays connected wallet, copy address, disconnect
- `<RpcConfig />` — RPC URL input, save/reset state
- `<TradePreferences />` — dust threshold, slippage defaults

---

### [P1] Payout Page — `routes/payout.tsx`
**Issue:** The page is ~180 lines and mixes the header, metric summary cards, explanatory "How It Works" text, and a large fee history table all in one component function.
**Fix:** Extract into `routes/payout/_components/`:
- `<PayoutSummary />` — the 3 fee metric cards
- `<FeeHistory />` — the filterable fee history table

---

## 5. Component Logic → Custom Hooks

### [P0] Trade History Aggregation — `routes/portfolio/index.tsx`, `routes/trade.tsx`
**Issue:** The logic to collect target vault IDs, fire `Promise.all` across `getHistory()` calls, flatten results, and sort by `executed_at` is duplicated inside `useEffect` in two separate page components.
**Fix:** Extract into `/hooks/useTradeHistory.ts`:
```ts
function useTradeHistory(vaultIds: string[]): { trades: ApiTrade[], isLoading: boolean }
```
Both pages then call this single hook.

---

### [P1] Fee Aggregation — `routes/payout.tsx`
**Issue:** The multi-vault fee fetching loop + `Promise.all` + total computation (totalFees, totalPerf, totalMgmt) is all inline inside `useEffect` + `useState` inside `PayoutPage`.
**Fix:** Extract into `/hooks/useFees.ts`:
```ts
function useFees(vaultIds: string[]): { fees: ApiFee[], totalFees: number, totalPerf: number, totalMgmt: number, isLoading: boolean }
```

---

## 6. Inline Fetches → Service + React Query

### [P0] Dashboard Metrics Fetch — `routes/index.tsx` (lines 37–51)
**Issue:** `getMetrics('tvl')`, `getMetrics('invested')`, `getMetrics('fees')` are fetched manually inside a `useEffect` with a local `useState` loading flag. Bypasses React Query caching entirely.
**Fix:**
```ts
// services/apis/rest-api/metrics.service.ts — already exists, just add query key
const { data } = useQuery({
  queryKey: ['metrics', 'dashboard'],
  queryFn: () => Promise.all([getMetrics('tvl'), getMetrics('invested'), getMetrics('fees')]),
})
```

---

### [P0] Payout Fee Fetching — `routes/payout.tsx` (lines 31–54)
**Issue:** Uses manual `useEffect` + `Promise.all` + `setState` to loop over vaults and call `feeService.getAccruedFees`. No caching, no deduplication.
**Fix:** Use `useQueries` from React Query, one query per vault:
```ts
const queries = useQueries({
  queries: vaults.map(v => ({
    queryKey: ['fees', v.id],
    queryFn: () => feeService.getAccruedFees(v.id),
  }))
})
```

---

### [P1] Trade History Fetch — `routes/portfolio/index.tsx`, `routes/trade.tsx`
**Issue:** Both pages use inline `useEffect` + `Promise.all` + `setState` to fetch trade history per vault. No React Query.
**Fix:** After extracting `useTradeHistory` hook (see §5), implement it using `useQueries`:
```ts
const queries = useQueries({
  queries: vaultIds.map(id => ({
    queryKey: ['trades', id],
    queryFn: () => getHistory(id),
  }))
})
```

---

### [P1] Portfolio Data Fetch — `routes/portfolio/index.tsx`
**Issue:** `fetchPortfolio(wallet.publicKey)` is called inside `useEffect` and delegates to the Zustand store's own fetch logic. Should be a React Query query.
**Fix:** Create `usePortfolioQuery(walletAddress: string)` that calls `portfolioService.getPortfolio` and return it via `useQuery`.

---

## 7. Files with Multiple Responsibilities

### [P0] Zustand Stores mixing API calls — `stores/vault-store.ts`, `stores/portfolio-store.ts`
**Issue:** These stores combine global client-side UI state (loading flags, selected vault, filter state) with heavy async API data fetching (`fetchVaults`, `fetchPortfolio`). This duplicates what React Query is designed to handle.
**Fix:**
- Remove all `fetchXxx` actions and associated `isLoading` / `error` state from the Zustand stores
- Use `useVaultsQuery()` / `usePortfolioQuery()` hooks backed by React Query for server-state
- Keep Zustand stores for **local UI state only** (selected vault ID, modal open, filter values)

---

### [P1] `routes/trade.tsx` — page + redirect + data fetch
**Issue:** The file does three things: (1) manager-only access guard/redirect, (2) vault + trade history data fetching, (3) rendering `<SwapForm>` and `<TradeHistory>`. These should be separated.
**Fix:**
- Keep access guard in `beforeLoad` (already there — good)
- Extract data fetching into `useTradeHistory` hook (see §5)
- Trade page file should only handle layout

---

## 8. Dummy/Mock Data — Backend Brief

### [P0] Mock Transaction Signatures — `hooks/useDeposit.ts`, `hooks/useWithdraw.ts`
**Issue:** Both hooks have a fallback that generates a fake random signature string when on-chain execution fails or no real wallet is connected:
```ts
const mockSig = Array.from({ length: 88 }, () => '...').join('')
```
This is a demo stub — the UI behaves as if a real transaction succeeded.

**Backend Brief:**
> **Endpoint:** `POST /api/v1/transactions/simulate`
> **Purpose:** Return a stable simulated transaction signature for UI testing without a live wallet.
> **Request Body:** `{ vaultId: string, amount: number, tokenMint: string, userPubkey: string, action: 'deposit' | 'withdraw' }`
> **Response:** `{ signature: string, explorerUrl: string, status: 'simulated' }`
> **Note:** Signature should be deterministic per (vaultId + userPubkey + action) for reproducible dev testing.

---

### [P1] Vault Balances in SwapForm — `routes/trade/_components/SwapForm.tsx` (lines 228–242)
**Issue:** The "Current Vault Balances" section displays hardcoded static values: `14.5200 SOL` and `2,450.00 USDC`. These are completely fake.

**Backend Brief:**
> **Endpoint:** `GET /api/v1/vaults/:vaultId/balances`
> **Purpose:** Return the current token balances held inside the vault.
> **Response:** `{ balances: [{ mint: string, symbol: string, amount: number, usdValue: number }] }`
> **Note:** Should reflect the vault's on-chain token account balances at the time of request.

---

### [P1] Mock TVL Series in `invest/index.tsx`
**Issue:** The TVL/performance chart inside the invest page either uses static mock series data or no data at all for the `<ProgressMetricCard>` in the vault summaries.

**Backend Brief:**
> **Endpoint:** Already exists: `GET /api/v1/metrics/series?metric=tvl&period=7d`
> **Action needed:** Wire this to the invest page vault summary cards. The metric API already supports `tvl`, `invested`, `pnl`, `fees`, `volume` — use them.

---

### [P2] Trade history vault filter — `routes/trade.tsx`
**Issue:** The vault filter select dropdown passes a `vaultId` search param, but there is no backend deduplication — the frontend fetches ALL vault trade histories regardless and flattens them client-side.

**Backend Brief:**
> **Endpoint Enhancement:** `GET /api/v1/vaults/trades?vaultIds[]=uuid1&vaultIds[]=uuid2&limit=50`
> **Purpose:** Batch trade history endpoint to avoid N+1 fetching pattern.
> **Response:** `{ trades: ApiTrade[], total: number }`

---

## 9. Broken / Non-Working Logic

### [P0] Portfolio History fetches ALL platform vaults — `routes/portfolio/index.tsx`
**Issue:** The `useEffect` that fetches trade history builds target IDs as:
```ts
const targetIds = sortedPositions.map(p => p.vaultId).concat(vaults.map(v => v.id))
```
The `.concat(vaults.map(...))` appends every vault on the platform, not just the user's invested vaults. This causes the portfolio page to show trades from vaults the user has never interacted with.
**Fix:** Remove the `.concat(vaults.map(v => v.id))` entirely. Only use `sortedPositions.map(p => p.vaultId)`.

---

### [P0] `fetchVaults` called without catching errors — `routes/vaults/index.tsx` (line 17)
**Issue:**
```ts
fetchVaults()  // no .catch()
```
If the API fails, the error is silently swallowed by the Zustand store and the user sees an infinite loading spinner with no error message.
**Fix:** Add `.catch(() => {})` and surface a toast or empty state on failure.

---

### [P1] Infinite re-fetch risk — `routes/portfolio/index.tsx`, `routes/payout.tsx`, `routes/trade.tsx`
**Issue:** Dependency arrays on trade/fee fetching `useEffect`s include object/array references from Zustand stores (`[vaults]`, `[sortedPositions, vaults]`). Zustand may recreate these references on unrelated store updates, triggering continuous unnecessary re-fetches.
**Fix:** Memoize the derived array of vault IDs with `useMemo` before putting it in the dependency array, or migrate entirely to React Query which handles this natively.

---

### [P1] `beforeLoad` using hook inside non-hook context — `routes/payout.tsx`, `routes/trade.tsx`
**Issue:**
```ts
beforeLoad: () => {
  const isManager = useAppStore.getState().isManager  // OK - using .getState() not the hook
```
While `.getState()` is technically correct here (not the hook), the pattern is fragile — any developer might mistakenly call `useAppStore(s => s.isManager)` here which would break React's rules of hooks.
**Fix:** Document with a comment that `beforeLoad` is not a React component and must use `.getState()`, not the hook selector.

---

### [P2] `SwapForm` Max button hardcoded — `routes/trade/_components/SwapForm.tsx` (line 97)
**Issue:**
```ts
onClick={() => setInputAmount('10.0')}  // hardcoded stub
```
The "Max" button sets a hardcoded value of `10.0` instead of reading the user's actual wallet balance.
**Fix:** Fetch the user's SOL/token balance via `connection.getTokenAccountBalance()` or a service call, then use that value as the max. Until the vault balances endpoint (§8) is ready, at minimum pull the wallet balance.

---

### [P2] `WalletConnectButton` disconnect not implemented — `components/ui/WalletConnectButton.tsx`
**Issue:** The disconnect action in `WalletConnectButton` likely calls `wallet.disconnect()` but doesn't clear the portfolio store or any other app state, leaving stale data visible after disconnecting.
**Fix:** On disconnect, call `usePortfolioStore.getState().reset()` and `useVaultStore.getState().reset()` (or equivalent clear actions) to wipe user-specific state from memory.
