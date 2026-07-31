# FBYT-Clone: Frontend Implementation Plan (TanStack Start)

> Full PRD: `../PRD.md`  |  DB Models: `./db.md`  |  Design System: `../frontend/design.md`  |  Architecture: `../frontend/structure.md`

---

## Agent 1: Infrastructure & Scaffolding (The Base)

**Goal:** Initialize TanStack Start, Tailwind CSS v4, shadcn/ui, routing skeleton, and directory structure.

### Commands

```bash
cd F:\projects\fbyt-clone
pnpx @tanstack/cli@latest create fbyt-clone-frontend --add-ons shadcn,tanstack-query,tailwind -y
rm frontend/design.md frontend/plan.md frontend/structure.md 2>/dev/null || true
mv fbyt-clone-frontend/* frontend/ && mv fbyt-clone-frontend/.* frontend/ 2>/dev/null || true && rmdir fbyt-clone-frontend
cd frontend

pnpm add zustand @tanstack/react-virtual axios
pnpm add @solana/web3.js@^1.98.0 @solana/wallet-adapter-react@^0.15.35 @solana/wallet-adapter-react-ui@^0.9.35 @solana/wallet-adapter-wallets@^0.18.1 react-hook-form @hookform/resolvers zod

npx shadcn add button dialog input select badge card tabs toast sheet tooltip skeleton
```

### Directory Structure

```
src/
├── app/routes/
│   ├── __root.tsx               # Root layout: nav, sidebar, Outlet
│   ├── index.tsx                # Dashboard (/)
│   ├── vaults/
│   │   ├── index.tsx            # /vaults list
│   │   ├── create/index.tsx     # /vaults/create
│   │   ├── $id/
│   │   │   ├── index.tsx        # /vaults/:id
│   │   │   └── edit/index.tsx   # /vaults/:id/edit
│   │       ..._components/ _utils/ _hooks/ _constants/ _stores/
│   ├── trade/index.tsx          # /trade
│   ├── payout/index.tsx         # /payout
│   ├── invest/index.tsx         # /invest
│   ├── portfolio/index.tsx      # /portfolio
│   └── settings/index.tsx       # /settings
├── lib/
│   ├── api.ts                   # Axios client
│   ├── utils.ts                 # cn() utility
│   ├── providers/SolanaProvider.tsx
│   ├── hooks/useWallet.ts
│   └── stores/wallet-store.ts
├── services/
│   ├── apis/rest-api/           # vault.service, portfolio.service, config.service, trade.service, fee.service
│   ├── websocket/ws-listener.ts # WebSocket manager
│   └── hooks/                   # TanStack Query hooks
├── components/
│   ├── ui/                      # shadcn + custom: VirtualizedList, TokenAmount, AddressPill, etc.
│   └── wallet/                  # WalletConnectButton, NetworkBanner
├── stores/                      # Zustand stores
├── types/                       # TS interfaces
├── constants/                   # dustThreshold, focusAssetsWhitelist
├── utils/                       # formatters
├── styles.css                   # Tailwind v4 + Aceternity tokens
├── router.tsx
├── routeTree.gen.ts
└── ssr.tsx / client.tsx
```

### Global CSS (`src/styles.css`)

```css
@import "tailwindcss";

@theme {
  --color-primary-coral: #FA9A63;
  --color-primary-gold: #CDA63C;
  --color-primary-amber: #F6B253;
  --color-primary-cream: #FFD99F;
  --color-bg-void: #000000;
  --color-bg-surface: #0a0a0a;
  --color-bg-elevated: #171717;
  --color-bg-inset: #262626;
  --color-border-subtle: rgba(255, 255, 255, 0.08);
  --color-border-medium: rgba(255, 255, 255, 0.20);
  --color-status-success: #28C840;
  --color-status-warn: #FFBD2E;
  --color-status-error: #FF5F57;
  --color-status-info: #3086ff;
  --color-text-primary: #FAFAFA;
  --color-text-secondary: rgba(255, 255, 255, 0.80);
  --color-text-tertiary: #A3A3A3;
  --color-text-muted: #737373;
  --color-text-inverse: #171717;
  --font-family-sans: 'Inter', system-ui, sans-serif;
  --font-family-mono: 'DM Mono', ui-monospace, monospace;
  --letter-spacing-xl: -0.04em;
  --letter-spacing-lg: -0.03em;
  --letter-spacing-sm: -0.02em;
  --letter-spacing-xs: -0.01em;
  --animate-gradient-flow: gradientFlow 3s ease infinite;
}

@layer base {
  * { @apply border-border-subtle; }
  body {
    @apply bg-bg-surface text-text-primary font-sans antialiased;
    font-feature-settings: "cv02", "cv03", "cv04", "cv11";
  }
}
```

---

## Agent 2: Web3 Wallet Connection (The Bridge)

**Goal:** Solana wallet adapter integration, custom connect button, quote-locking, network detection.

### SolanaProvider (`src/lib/providers/SolanaProvider.tsx`)
- Wraps app with `ConnectionProvider` (Devnet), `WalletProvider` (Phantom + Solflare, `autoConnect`), `WalletModalProvider`
- `localStorageKey="fbyt-wallet"` for persistence

### Custom WalletConnectButton (`src/components/wallet/WalletConnectButton.tsx`)
- Uses `useWallet()` + `useWalletModal()` hooks directly
- Connected state: green dot + truncated address (`ABC1...XYZ4`) + wallet icon
- Disconnected: "Connect Wallet" → opens wallet modal
- Loading: "Connecting..." with disabled state
- Aceternity styling: `bg-black border border-white/20 hover:border-primary-coral/40`

### useWallet Hook (`src/lib/hooks/useWallet.ts`)
- Re-exports `useWallet` + `useConnection` with convenience utilities
- `sendTransaction` wraps adapter's method with `setWalletPromptOpen(true/false)` for quote-locking

### Quote-Locking Store (`src/lib/stores/wallet-store.ts`)
```ts
interface WalletState {
  isWalletPromptOpen: boolean;
  setWalletPromptOpen: (open: boolean) => void;
}
```
- When `true`, ALL background polling in TanStack Query must skip using `refetchInterval: () => isWalletPromptOpen ? false : 5000`
- Solves the Phantom simulation failure bug from PRD

### NetworkBanner (`src/components/wallet/NetworkBanner.tsx`)
- Detects if `connection.rpcEndpoint !== Devnet`
- Shows warning banner: "Wrong network — switch to Solana Devnet"

### Wallet Adapter CSS Override (`src/styles/wallet-adapter.css`)
- Dark-theme overrides for the wallet modal (bg-elevated, border-subtle, hover:primary-coral)

---

## Agent 3: Global State Management (The Brain)

**Goal:** 6 Zustand stores with TypeScript interfaces.

### useAppStore (`src/stores/app-store.ts`)
- `mode: 'manager' | 'investor'` persisted in `sessionStorage` (tab isolation — PRD state conflict fix)
- `currentUser: string | null` (wallet address)
- Active vault ID tracking

### useTransactionStore (`src/stores/transaction-store.ts`)
```ts
interface PendingTransaction {
  id: string; signature?: string; type: 'deposit' | 'withdraw' | 'trade';
  status: 'pending' | 'success' | 'failed'; vaultId: string;
  timestamp: number; errorMessage?: string;
}
```
- `pending: PendingTransaction[]`, `history: PendingTransaction[]` (capped 100)
- Actions: `addPendingTransaction`, `confirmTransaction(id, signature)`, `failTransaction(id, error)`
- Auto-fires `notificationStore` on success/fail

### useConfigStore (`src/stores/config-store.ts`)
- Fetched on app load via `GET /api/v1/config`
- Stores: `dustThreshold` (shared constant preventing /trade vs /portfolio mismatch), `focusAssetsWhitelist` (string[] for dropdown), `minRaiseAmount`, `lockupPeriod`
- Default fallback values on error (UI never blocks)

### useVaultStore (`src/stores/vault-store.ts`)
- `vaults: Vault[]`, `currentVault: Vault | null`, `isLoading`, `error`
- Actions: `fetchVaults()`, `fetchVaultById(id)`, `invalidateCache()` (called on WS `trade_confirmed`)

### usePortfolioStore (`src/stores/portfolio-store.ts`)
- `positions: PortfolioPosition[]`, `summary: PortfolioSummary`, `lastUpdated`
- `updateFromWs(vaultId, partial)` — real-time PnL ticks via WS
- `recalculateSummary()` — total invested, total value, total PnL, best/worst vault

### useWebSocketStore (`src/stores/websocket-store.ts`)
- `isConnected`, `lastMessage`, `reconnectAttempts`
- Auto-reconnect with exponential backoff (max 10), auto-resubscribe

---

## Agent 4: API & WebSocket Pipeline (The Nervous System)

**Goal:** Axios client, REST service modules, WebSocket listener, TanStack Query hooks.

### API Client (`src/lib/api.ts`)
```ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080/api/v1',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});
```
- Request interceptor: injects `Bearer` auth token via `setAuthToken(token)`
- Response interceptor: normalizes errors into `ApiError(status, message, code)`

### REST Service Modules (`src/services/apis/rest-api/`)

| Service | Functions |
|---------|-----------|
| `vault.service.ts` | `getAll()`, `getById(id)`, `updateMetadata(id, data)`, `create(vault)` |
| `portfolio.service.ts` | `getByWallet(wallet)` |
| `config.service.ts` | `getConfig()` |
| `trade.service.ts` | `getHistory(vaultId)`, `syncTrade(data)` |
| `fee.service.ts` | `getAccruedFees(vaultId)` |

### WebSocket Manager (`src/services/websocket/ws-listener.ts`)
- `WebSocketManager` class with typed `on(type, handler)` / `off(type, handler)` subscription
- Auto-reconnect: exponential backoff (1s→2s→4s→8s→16s), max 5 attempts
- Heartbeat: sends `{"type":"ping"}` every 30s
- `connect() / disconnect() / destroy()` lifecycle

### Message-to-Store Mapping
| WS Message Type | Store Action |
|----------------|-------------|
| `update` with `vaultId` | `useVaultStore.invalidateCache()` |
| `trade_confirmed` with `signature` | `useTransactionStore.confirmTransaction()` |
| `portfolio_update` with position | `usePortfolioStore.updateFromWs()` |
| `price_update` with prices | Local state in trade page |

### TanStack Query Hooks (`src/services/hooks/`)

| Hook | staleTime | gcTime | Notes |
|------|-----------|--------|-------|
| `useVaultsQuery` | 30s | 5min | refetchOnWindowFocus |
| `useVaultDetailQuery(id)` | 60s | 5min | enabled: `!!id` |
| `usePortfolioQuery(wallet)` | 15s | 5min | enabled: `!!wallet` |
| `useSyncTradeMutation` | — | — | invalidates vault+portfolio |
| `useUpdateVaultMetadataMutation` | — | — | invalidates vault |

Quote-locking integration: all `refetchInterval` callbacks check `useWalletStore.getState().isWalletPromptOpen`.

---

## Agent 5: Shared UI Components (The Bricks)

**Goal:** High-performance reusable components.

### VirtualizedList (`src/components/ui/virtualized-list.tsx`)
```tsx
interface Props<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight: number;
  overscan?: number; // default 5
}
```
- Uses `@tanstack/react-virtual` `useVirtualizer` with `count`, `getScrollElement`, `estimateSize`
- GPU-accelerated via `translateY` instead of `top`
- Handles 10,000+ items (PRD React lag fix)

### TokenAmount (`src/components/ui/token-amount.tsx`)
- Props: `amount: number | string`, `symbol: string`, `showUsd?`, `usdValue?`, `showIcon?`
- Dust filter: if `amount > 0 && amount < dustThreshold` → renders `< Dust` (PRD dust filtering fix)
- Compact notation: 1,234,567 → 1.23M
- Always `font-mono`, decimals truncated to 6

### AddressPill (`src/components/ui/address-pill.tsx`)
- Truncates: `ABC1...XYZ4` with copy-on-click
- Tooltip shows full address (shadcn Tooltip)
- Style: `bg-bg-inset border border-border-subtle rounded-full px-3 py-1 font-mono text-xs`

### SolscanLink (`src/components/ui/solscan-link.tsx`)
- Opens `https://solscan.io/{type}/{signature}?cluster=devnet` in new tab
- External link icon from lucide-react

### CopyButton (`src/components/ui/copy-button.tsx`)
- `navigator.clipboard.writeText()` with `document.execCommand()` fallback
- Checkmark icon for 2s, then reverts

### StatusBadge (`src/components/ui/status-badge.tsx`)
- Variants: Active (coral), Fundraising (gold), Dormant (neutral), Pending (yellow), Failed (red)
- Colored dot + text, `rounded-full px-2 py-0.5 font-mono text-xs`

### VaultCard (`src/components/ui/vault-card.tsx`)
- `bg-bg-elevated rounded-xl border border-border-subtle p-4`
- Links to `/vaults/{id}`
- Shows: StatusBadge, name, TVL (TokenAmount), manager (AddressPill), fee badges

### PageHeader, EmptyState, LoadingSkeletons
- PageHeader: consistent `title`, `description?`, `action?` layout
- EmptyState: centered icon + title + optional action button
- Skeletons: `VaultCardSkeleton`, `TableRowSkeleton`, `PortfolioSummarySkeleton`, `FormSkeleton` — animated pulse, matching final layout dimensions (no CLS)

---

## Agent 6: Manager Mode — Vault Lifecycle (The Creator)

**Goal:** Vault create/edit/payout pages with Anchor integration.

### `/vaults` (list page)
- Fetches via `useVaultsQuery`, renders `VirtualizedList` of `VaultCard`
- Filter/search by status and name
- "Create Vault" CTA button → navigates to `/vaults/create`

### `/vaults/create` (create form)
- React Hook Form + Zod validation:
  ```ts
  z.object({
    name: z.string().min(1).max(64),
    description: z.string().max(500).optional(),
    focusAssets: z.array(z.string()).min(1),  // strict whitelist dropdown from API
    minRaiseAmount: z.coerce.number().min(0),
    performanceFee: z.coerce.number().min(0).max(10000),
    managementFee: z.coerce.number().min(0).max(10000),
    lockupPeriod: z.coerce.number().int().min(0),
  })
  ```
- FocusAssets dropdown limited to `useConfigStore.focusAssetsWhitelist` (PRD search filtering fix)
- "Create Vault" triggers Anchor `initialize_vault` instruction:
  ```ts
  const sig = await program.methods
    .initializeVault(form.minRaiseAmount, form.performanceFee, form.managementFee, form.lockupPeriod)
    .accounts({ manager: wallet.publicKey })
    .rpc()
  ```
- Progress: `idle → signing → pending → confirming → done → redirect to /vaults/:id`
- On success: POST vault address + metadata to `POST /api/v1/vaults`

### `/vaults/:id/` (detail page)
- Tabbed: Overview | Trades | Investors
- Overview: VaultInfoCard (address, status, fees, TVL, dates), manager actions (Edit, Payout, Trade)
- Trades: VirtualizedList of TradeHistoryRow
- Uses `_components/VaultInfoCard.tsx`, `_hooks/useVaultDetail.ts`

### `/vaults/:id/edit` (edit metadata)
- Editable: name, description, focus assets (whitelist dropdown only)
- Save → `PUT /api/v1/vaults/:id/metadata`

### `/payout` (fee dashboard)
- Lists all vaults managed by connected wallet
- Shows accrued fees per vault via `GET /api/v1/fees/:vaultId`
- UI copy explaining automated Keeper distribution system
- "Claim Fees" button (future scope)

### `/` (manager dashboard)
- Summary cards: Total vaults, Total TVL, Total fees accrued
- Recent vault activity (last 5 trades)
- Quick actions: Create Vault, Execute Trade

---

## Agent 7: Manager Mode — Trading Engine (The Trader)

**Goal:** Swap UI with Pyth Oracle price integration and Anchor `execute_trade_pyth` instruction.

### `/trade` page (two-column layout)
- Left: Swap form | Right: Oracle price info + vault balances
- Vault selector (only vaults where connected wallet is manager)

### Pyth Price Integration (`_hooks/usePythPrice.ts`)
- Polls Pyth Hermes API every 15s for live Devnet prices
- Price freshness indicator: green (<30s), yellow (<60s), red (>60s)
- Supported feeds (Devnet):

| Feed | Hermes Feed ID |
|------|---------------|
| SOL/USD | `ef0d8b6b...280b56d` |
| USDC/USD | `eaa020c6...9e9c94a` |

### Swap Form (`_components/SwapForm.tsx`)
- Direction toggle: Buy / Sell
- Input token dropdown, amount with "Max" button (vault's token balance)
- Output token read-only field — computed from Pyth price
- Slippage tolerance: presets (0.1%, 0.5%, 1%) + custom, default 0.5%
- Price impact warning banner if >2%

### Review Step (`_components/TradeReview.tsx`)
- Modal showing: pay amount, receive amount, oracle price, slippage, min received, price impact

### Anchor Instruction (`execute_trade_pyth`)
- 13 accounts: vault PDA, vault authority, vault input/output ATAs, manager input/output ATAs, manager signer, pyth price account, pyth program, token program, ATA program, system program, rent
- Data: `trade_type` (0=buy/1=sell), `amount_in` (u64), `min_amount_out` (u64)

### Swap Flow
1. Wallet check → redirect to connect prompt
2. Load managed vaults → user selects vault
3. Price polling starts for vault's focus assets
4. User configures swap → quote computed live
5. Review step → wallet prompts `signTransaction`
6. On signature: POST to `POST /api/v1/trades/sync` immediately (fallback)
7. `useTransactionStore.addPendingTransaction('swap')`
8. On WS `trade_confirmed`: mark success, invalidate caches
9. On failure: "Trade Failed" toast with Solscan link

---

## Agent 8: Investor Flow (The Depositor)

**Goal:** Deposit/withdraw modals, vault directory.

### `/invest` page (vault directory)
- `VirtualizedList` of vault cards with filters (status, focus asset, search)
- Each card: name, status, TVL, manager, fees, APR
- "Deposit" button on active vaults → opens DepositModal
- "Withdraw" button → opens WithdrawModal

### DepositModal (`_components/DepositModal.tsx`)
- Select asset: SOL or USDC
- Amount input with USD approximation
- Expected share tokens display (computed ratio)
- USDC path: SPL approve step → Anchor `deposit`
- SOL path: Anchor `deposit` directly
- Progress: signing → pending → confirmed
- On success: POST `/api/v1/trades/sync`, refetch portfolio

### WithdrawModal (`_components/WithdrawModal.tsx`)
- Current share token balance display
- Shares input with "Max" button
- Expected in-kind assets breakdown
- Lockup period warning if applicable
- Triggers Anchor `withdraw` instruction → POST sync → refetch

### Wallet Interaction
- Both modals use `useWallet()` hook
- If not connected: "Connect Wallet" prompt
- TX lifecycle via `useTransactionStore`
- Errors: toast with Solscan link

---

## Agent 9: Real-Time Portfolio & PnL (The Dashboard)

**Goal:** Portfolio positions with live WebSocket updates.

### `/portfolio` page
- Wallet guard: "Connect to see portfolio" if not connected
- Summary bar: Total invested, current value, total PnL (abs + %), best/worst vault
- `VirtualizedList` of `PositionCard` components

### PositionCard (`_components/PositionCard.tsx`)
- Expandable: vault name, shares owned, invested, current value, PnL (green/red), PnL %, entry price, current price
- Expanded: RealTimePnL, allocation badges, TradeHistoryTable

### RealTimePnL (`_components/RealTimePnL.tsx`)
- Listens to `usePortfolioStore` for live WS updates
- Green (`#28C840`) for positive, red (`#FF5F57`) for negative
- CSS transition on value change
- Last-updated timestamp

### TradeHistoryTable (`_components/TradeHistoryTable.tsx`)
- Columns: Date, Type, Token, Amount, Price, TX Link (SolscanLink)
- Sortable by date, type
- Auto-invalidates on WS `trade_confirmed` (PRD missing history fix)
- Paginated or virtual scrolling

### PnL Calculation
- Total PnL (abs): `sum(currentValue) - sum(deposited)`
- Total PnL (%): `totalPnl / totalInvested * 100`
- Best/worst vault: highest/lowest `pnlPercent`

---

## Agent 10: UX Polish & Edge Cases (The Sweeper)

**Goal:** Error boundaries, toast notifications, loading states, responsive design, accessibility.

### Global Error Boundary (`src/components/ErrorBoundary.tsx`)
- Class component wrapping app root
- Dark-themed fallback UI (Aceternity): "Something went wrong" + error details toggle + "Reload" button
- Console-only logging (MVP)

### Notification System (`src/stores/notification-store.ts`)
```ts
interface Notification {
  id: string; type: 'success' | 'error' | 'warning' | 'info';
  title: string; description?: string; action?: { label: string; onClick: () => void };
  persistent?: boolean; timestamp: number;
}
```
- Auto-dismiss: success 4s, info 6s, warning/error manual (persistent)
- Max 3 visible, stacked bottom-right
- `Toaster` component reads store and renders shadcn Toast

### Failed TX UX (PRD fix)
- `useTransactionStore` marks every TX as `pending` immediately
- On failure: persistent toast with error reason + SolscanLink + "Retry" button
- "Recent Transactions" dropdown in nav shows history with status icons

### Loading States
- Skeleton components matching final layout dimensions (no CLS)
- TanStack Router `pendingMinMs` / `pendingMs` for route transitions
- LoadingBar: NProgress-style gold gradient bar at top of page

### Mode Toggle (PRD state conflict fix)
- Manager/Invest toggle in nav sidebar
- Stored in `sessionStorage` — isolated per browser tab
- On toggle: redirect to mode's home page
- Tab A can be Manager, Tab B can be Investor — no conflict

### Responsive Design
- Mobile: single column, hamburger nav, full-width modals
- Tablet: 2-column grid, collapsible sidebar
- Desktop: multi-panel persistent sidebar
- Modals: fullscreen on mobile (`sm:max-w-lg`)

### Settings (`/settings`)
- Slippage tolerance (persisted localStorage)
- RPC endpoint override
- Theme/language (MVP: dark only, English only)
- "Reset to defaults"

### Accessibility
- Focus rings (`ring-2 ring-primary-coral`) on all interactive
- `aria-label` on icon-only buttons
- `prefers-reduced-motion` respected
- Semantic HTML heading hierarchy

### Keyboard Shortcuts
- `Esc` closes modals/dropdowns
- `Enter` triggers focused button

---

## Development Order (Dependency Graph)

```
Agent 1 (Infrastructure)
  ├── Agent 2 (Web3 Wallet)
  │     └── Agent 3 (Zustand Stores) ── depends on Agent 1 for file structure
  │           └── Agent 4 (API/WS Pipeline) ── depends on Agent 3 stores
  │                 ├── Agent 5 (Shared Components) ── independent, can start with Agent 1
  │                 ├── Agent 6 (Manager Vault) ── depends on Agent 4 + Agent 5
  │                 ├── Agent 7 (Trading) ── depends on Agent 2 + Agent 4 + Agent 5
  │                 ├── Agent 8 (Investor) ── depends on Agent 2 + Agent 4 + Agent 5
  │                 └── Agent 9 (Portfolio) ── depends on Agent 4 + Agent 5
  └── Agent 10 (Polish) ── depends on ALL (final pass)
```

### Parallel Execution Strategy
- **Wave 1 (parallel):** Agent 1, Agent 2
- **Wave 2 (parallel):** Agent 3, Agent 5
- **Wave 3 (parallel):** Agent 4
- **Wave 4 (parallel):** Agent 6, Agent 7, Agent 8, Agent 9
- **Wave 5:** Agent 10 (full integration pass)
