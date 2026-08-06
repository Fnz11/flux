# FBYT Clone — Plan 2: Audit & Improvement Tasks

> Written: 2026-08-06
> Scope: Frontend (TanStack / React), Backend (Go/Gin), Contracts (Anchor/Solana)

---

## Pre-work: Current State Audit

Before diving into each task, here is a honest snapshot of **what is actually working vs broken** right now across the three layers.

### Contract (Anchor — `fbyt-clone-vault`)

| Instruction | Status | Notes |
|---|---|---|
| `initialize_vault` | ⚠️ Partial | Signature correct on-chain. However the frontend `useCreateVault` hook silently falls back to a **fake random signature** when program call throws, so the on-chain vault is **never actually created** in most flows. |
| `activate_vault / deactivate_vault` | ✅ Exists | Not wired into any UI. |
| `deposit` | ✅ Exists | Wired in `useDeposit.ts`. |
| `withdraw` | ✅ Exists | Wired in `useWithdraw.ts`. |
| `execute_trade_pyth` | ✅ Exists | Wired in `useExecuteTrade.ts` via Pyth Hermes. |
| `collect_fees` | ✅ Exists | No UI on `/payout` yet (stub). |
| `set_pending_manager / accept_manager` | ✅ Exists | No UI. |
| `pause_vault` | ✅ Exists | No UI. |

The `initialize_vault` instruction requires `deposit_mint`, `share_token_mint`, and `vault_authority` accounts that the **frontend does not construct**. It passes the manager's pubkey as `vault` which is wrong — the vault is a PDA seeded from `[VAULT_SEED, manager.key()]`.

### Backend (Go/Gin)

| Area | Status | Notes |
|---|---|---|
| `GET /vaults` with `?status=` | ✅ Works | Supports filter by status, pagination. |
| `GET /vaults` sort params | ❌ Missing | No `sort_by` / `sort_order` query params implemented. |
| `POST /vaults` | ✅ Works | Creates vault record in Postgres. |
| `GET /vaults/:address/balances` | ✅ Works | Returns token balances. |
| WebSocket hub | ✅ Works | Channel-based pub/sub is correctly implemented in Go. |
| WebSocket auth (JWT token required) | ⚠️ Problem | WS requires a `?token=` JWT, but the frontend connects at app boot **without a token**. Connection will 401 for all users. |
| Vault `createdAt` / sort on create | ✅ Exists in model | Not exposed as sort option in API. |
| `MinRaiseAmount` stored | ❌ Missing | `VaultResponse` and Postgres model do NOT store `min_raise_amount`, `lockup_period`. Only fees are stored. |

### Frontend (TanStack Start)

| Page/Component | Status | Notes |
|---|---|---|
| `/` (Dashboard) | ⚠️ Partial | Shows platform aggregate cards and portfolio. Does NOT show manager's own vaults or investor's invested vaults as per spec. |
| `/vaults` | ⚠️ Partial | Renders vaults as **cards** (grid), not the table layout shown in img1. No status filter. No column sorting. |
| `/vaults/create` | ❌ Broken | Form is very stripped-down (4 plain fields). Missing all FBYT OG sections: Vault Type toggle, Identity block, Cover Image upload, USD Rate display, Advanced Settings (lockup unit selector, fee withdrawal period, fee structure), agreement checkbox. |
| `/trade` | ⚠️ Partial | Shows swap form + trade history. Does NOT prominently show **vault assets** (what tokens the vault currently holds). Current vault balances exist only in a tucked side panel. |
| `/vaults/:id` | ❌ Stub | Hard-coded zeros; no real data connected. |
| WebSocket on frontend | ❌ Wrong | `websocket-store.ts` sends `{ type: "subscribe", vaultId }` but the backend hub expects `{ type: "subscribe", channel: "vaults" }`. Protocol mismatch — subscriptions are silently ignored. |
| WebSocket page-level sub/unsub | ❌ Missing | No route-aware effect that subscribes on mount and unsubscribes on unmount when navigating. |
| TX Confirmation (Phantom) | ⚠️ Incomplete | Our `ConfirmationDialog` is an internal modal. The Phantom wallet popup (imgs 3 & 4) is controlled by what accounts/instructions we pass in the transaction. Missing: `set_compute_unit_price`, `set_compute_unit_limit` instructions and correct ATA creation accounts so Phantom shows the detailed breakdown. |

---

## Task 1 — `/trade`: Vault Assets Panel

### Problem
The trade page shows vault balances only as a small secondary panel when a vault is already selected. The spec says "show vault assets" prominently — meaning the manager sees exactly what tokens the vault holds before deciding what to trade.

### What needs to change

#### Frontend — `frontend/src/routes/trade.tsx` + `SwapForm.tsx`
1. Add a dedicated **`VaultAssetsPanel`** component that appears above (or alongside) the swap form.
2. This component takes the selected `vaultId` and calls `useVaultBalancesQuery(vaultId)`.
3. Show a clean token row list: token icon, symbol, balance, and approximate USD value (using Pyth prices).
4. If no vault is selected, show a prompt: "Select a vault above to view its assets."
5. Remove the current tucked-away balance list inside `SwapForm`'s right column (was an afterthought).

#### Backend
- The `/api/v1/vaults/:address/balances` endpoint already exists. No backend changes needed for this task.

#### Files to modify
- `[MODIFY] frontend/src/routes/trade.tsx` — import and render `<VaultAssetsPanel>` above `<SwapForm>`
- `[NEW] frontend/src/routes/trade/_components/VaultAssetsPanel.tsx` — new component
- `[MODIFY] frontend/src/routes/trade/_components/SwapForm.tsx` — remove duplicate tucked-away balances section

---

## Task 2 — `/vaults`: Status Filter + Sortable Columns (Table Layout)

### Problem
- Current UI is a card grid — not a table.
- No filter by status (Fundraising / Active / Dormant).
- No sortable columns.
- Missing columns from img1: **PNL, CREATED, MIN, INVESTORS, ASSET (sparkline), ACTION**.

### What needs to change

#### Backend — `vault_handler.go` + `repository`
1. Add `sort_by` query param to `ListVaults`: accepted values = `pnl`, `created_at`, `investors`, `min_raise_amount`, `tvl`.
2. Add `sort_order` query param: `asc` | `desc`.
3. Add `min_raise_amount` and `lockup_period` to `VaultResponse` (currently missing from model and response).
4. Add investor count to vault response (count of distinct investor addresses from `portfolios` table).

#### Frontend — `frontend/src/routes/vaults/index.tsx`
1. Replace `<VirtualizedList>` + `<VaultCard>` with a proper **`<VaultsTable>`** component.
2. Table columns (matching img1):
   - `VAULT` — avatar circle with initials + vault display name + manager handle (truncated)
   - `PNL` — highlighted in orange when active sort; shows `+X.XX%` in green
   - `CREATED` — formatted date (e.g. "Apr 12, 2026")
   - `MIN` — min raise amount in USD (e.g. "$1 USD")
   - `INVESTORS` — investor count
   - `ASSET` — accepted deposit asset icon badges
   - sparkline chart — mini green area chart (SVG or recharts)
   - `ACTION` — chevron `>` button navigating to vault detail
3. Add **status filter tabs** above the table: `All | Fundraising | Active | Dormant`. Clicking updates `?status=` query param and re-fetches.
4. Clicking a column header sets `sort_by` and toggles `sort_order` in URL search params and re-queries.
5. The PNL column header should be orange/highlighted when it is the active sort (matching img1).

#### Files to modify
- `[NEW] frontend/src/routes/vaults/_components/VaultsTable.tsx`
- `[NEW] frontend/src/routes/vaults/_components/VaultSparkline.tsx` — tiny SVG sparkline
- `[MODIFY] frontend/src/routes/vaults/index.tsx` — add filter tabs, use VaultsTable
- `[MODIFY] frontend/src/services/apis/rest-api/vault.service.ts` — add `sortBy`, `sortOrder`, `status` params
- `[MODIFY] backend/internal/handlers/vault_handler.go` — parse `sort_by` / `sort_order`
- `[MODIFY] backend/internal/repository/vault_repo.go` — apply ORDER BY dynamically with whitelist
- `[MODIFY] backend/internal/models/vault.go` — add `MinRaiseAmount`, `LockupPeriod` to `VaultResponse`

---

## Task 3 — `/vaults/create`: Match OG FBYT Form (img2)

### Problem
Current form has 4 plain fields. The real FBYT form (img2) has 5 rich sections.

### What the OG form looks like (img2 analysis)

**Section 1 — VAULT TYPE**
- Toggle between **Open-ended** (investors can deposit/redeem any time) and **Closed-end** (deposits only during fundraise, fixed-term).
- Both options are card-style with icon, title, and description. Selected card has highlighted (orange) border.

**Section 2 — VAULT IDENTITY**
- `Display Name` — text input (current value shown in orange)
- `Strategy Description` — textarea with 0/500 char counter
- `Cover Image` — file upload zone with image preview + "REMOVE" link

**Section 3 — BASIC CONFIGURATION**
- `Min. Raise Amount` — number input with a unit toggle (SOL / USDC / USDT)
- Shows USD conversion below: e.g. "≈ 0.014B USD"
- `Select Accepted Asset` — multi-button group: SOL | USDC | USDT (maps to `allowed_output_mints`)
- `USD RATE` row — shows Pyth oracle price, e.g. "1 SOL = $74.24". Green tick when oracle is ready.

**Section 4 — ADVANCED SETTINGS**

*Investment Parameters:*
- `Min. Investment` — number input + SOL unit label; shows "Protocol min: $0.01 USD"
- `Lockup Period` — number input + unit dropdown (Hours / Days / max 45 days)

*Fee Structure:*
- `Management Fee (% / Year)` — number input (Max: 15%); label "/Year"
- `Fee Withdrawal Period` — segmented control: **Weekly** | Monthly | Quarterly | Yearly (active = orange)
- `Performance Fee (% on Profit)` — number input (Max: 20%); label "On Profit"

**Section 5 — AGREEMENT**
- Checkbox: "I agree and accept the Terms and Conditions" (Terms in orange link)

**CTA** — Full-width orange `CREATE VAULT` button

### What needs to change

#### Frontend — `frontend/src/routes/vaults/create.tsx`
1. Completely replace the existing minimal form with the 5-section layout above.
2. Vault Type stored as `vault_type: "open" | "closed"` in form state.
3. Display Name and Strategy Description stored in `metadata.displayName` / `metadata.description`.
4. Cover Image: encode as base64 → stored in `metadata.coverImageUrl`.
5. Accepted Assets: maps to `allowed_output_mints` on the contract (whitelisted Devnet mint addresses).
6. USD Rate: call `usePythPrice("SOL/USD")` to display live oracle rate with green tick.
7. Lockup Period unit dropdown changes the multiplier: Hours → `n * 3600`, Days → `n * 86400` seconds.
8. Fee Withdrawal Period stored in `metadata.feeWithdrawalPeriod`.

#### Contract — `initialize_vault` instruction (Rust)
The contract already accepts `allowed_output_mints: [Pubkey; 4]`. However the **frontend does not pass `deposit_mint`, `share_token_mint`, or `vault_authority` accounts**.

Frontend hook `useCreateVault.ts` must be fixed to:
1. Derive the vault PDA: `findProgramAddressSync([Buffer.from("vault"), manager.toBuffer()], programId)`.
2. Derive the vault authority PDA: `findProgramAddressSync([Buffer.from("vault_authority"), vaultPda.toBuffer()], programId)`.
3. Pick `deposit_mint` based on selected accepted asset (SOL → wrapped SOL mint, USDC → USDC devnet mint).
4. Generate a fresh Keypair for `share_token_mint` and sign with it as an additional signer.
5. Prepend `set_compute_unit_price` + `set_compute_unit_limit` instructions so Phantom shows the detailed breakdown (matching imgs 3 & 4).

#### Backend — `vault_handler.go` + `models/vault.go`
1. `CreateVault` endpoint must accept and store `min_raise_amount`, `lockup_period`, `vault_type`, and extended metadata fields.
2. Update `VaultResponse` accordingly.

#### Files to modify
- `[MODIFY] frontend/src/routes/vaults/create.tsx` — full redesign into 5-section form
- `[MODIFY] frontend/src/routes/vaults/_hooks/useCreateVault.ts` — correct PDA derivation + accounts + compute budget ixs
- `[MODIFY] backend/internal/models/vault.go` — add `MinRaiseAmount`, `LockupPeriod`, `VaultType` fields
- `[MODIFY] backend/internal/handlers/vault_handler.go` — accept new fields
- `[MODIFY] backend/internal/repository/vault_repo.go` — persist new fields

---

## Task 4 — TX Confirmation: Match FBYT Phantom Breakdown (imgs 3 & 4)

### Problem
In imgs 3 & 4, when the user clicks "Execute Swap" or "Create Vault" on FBYT, Phantom shows:
- `set_compute_unit_price` instruction → Compu...11111 program
- `set_compute_unit_limit` instruction → Compu...11111 program
- `create` instruction for ATA with accounts: `ata`, `mint`, `payer`, `system_program`, `token_program`, `wallet`
- `transfer` instruction with `lamports`, `payer`, `receiver`
- `sync_native` instruction
- Second `create` for output ATA
- `Unknown` instruction (our custom Anchor program instruction — appears as Unknown because Phantom doesn't have our IDL)

This rich breakdown is what Phantom renders when the transaction is **properly constructed** with compute budget instructions and correct ATA account metas. Our current code does NOT add these, so Phantom shows only a minimal balance-change view.

### What needs to change

#### Frontend — `frontend/src/lib/transactions.ts`
1. Before building any transaction, **prepend**:
   ```ts
   ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000 })
   ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 })
   ```
2. For swap (`execute_trade_pyth`):
   - Include `createAssociatedTokenAccountInstruction` for input ATA and output ATA if they don't already exist (these are the `create` instructions Phantom shows).
   - Include `createSyncNativeInstruction` for wrapped SOL flows.
3. For vault creation (`initialize_vault`):
   - Include ATA creation for `share_token_mint`.
   - Include SOL `transfer` for vault rent-exemption funding.
4. Once the transaction contains these exact instruction types, Phantom will render the same breakdown as imgs 3 & 4.

#### Files to modify
- `[MODIFY] frontend/src/lib/transactions.ts` — add `buildTransactionWithComputeBudget` helper
- `[MODIFY] frontend/src/routes/vaults/_hooks/useCreateVault.ts` — use updated transaction builder
- `[MODIFY] frontend/src/hooks/useExecuteTrade.ts` — use updated transaction builder

---

## Task 5 — WebSocket: Single Connection, Channel-Based, Route-Aware Sub/Unsub

### Problem (3 separate bugs)

**Bug 1 — Protocol mismatch**
Backend hub expects: `{ "type": "subscribe", "channel": "vaults" }` or `{ "type": "subscribe", "channel": "portfolio:0xABC..." }`.
Frontend store sends: `{ "type": "subscribe", "vaultId": "some-uuid" }` — the `channel` field is missing; the hub ignores it.

**Bug 2 — No auth on WS connect**
The WS endpoint requires a JWT token via `?token=` query param. The frontend connects at app boot without any token → HTTP 401 → connection silently fails. All real-time updates are dead.

**Bug 3 — No route-aware subscription lifecycle**
When navigating from `/portfolio` → `/vaults`, the frontend should:
1. Unsubscribe from `portfolio:<walletAddress>` channel
2. Subscribe to `vaults` channel

Currently there is no mechanism for this at all.

### Proposed Channel Naming Convention

| Page/Route | Subscribe channel | Unsub on leave |
|---|---|---|
| `/` | `dashboard` | yes |
| `/vaults` | `vaults` | yes |
| `/vaults/:id` | `vault:<id>` | yes |
| `/trade` | `vault:<selected-vaultId>` | yes |
| `/portfolio` | `portfolio:<walletAddress>` | yes |
| `/invest` | `vaults` | yes |
| `/payout` | `vault:<id>` (current vault) | yes |

### What needs to change

#### Backend — `ws/client.go`
1. `canSubscribe`: `dashboard` and `vaults` are public (always allow). `vault:<id>` is public (read-only). `portfolio:<addr>`, `user:<addr>`, `wallet:<addr>` require matching wallet address claim.
2. No other backend changes needed — the hub's subscribe/unsubscribe logic is correct.

#### Backend — `ws_handler.go` + auth flow
The WS endpoint currently requires a JWT token. Two options:

- **Option A (preferred — simpler):** Allow unauthenticated connection but gate private channels at subscribe time. Accept optional `?wallet_address=` query param for identity. Remove the 401 on missing token — instead treat the client as anonymous and reject private channel subscriptions.
- **Option B:** Issue a short-lived WS JWT after wallet connection. Frontend requests `POST /auth/ws-token` with signed wallet proof, gets a JWT, passes it as `?token=`. Already aligned with `middleware.ValidateToken` pattern but requires extra auth endpoint.

**Recommendation: Option A** for speed. Option B for production security.

#### Frontend — `stores/websocket-store.ts`
1. **Fix protocol**: `subscribe(channel: string)` sends `{ type: "subscribe", channel }`. Remove `vaultId` field entirely.
2. **Fix auth**: If using Option B, `connect(url, token?)` appends `?token=<jwt>` to the URL.
3. Add `switchChannels(leave: string[], join: string[])` atomic helper for route transitions.

#### Frontend — `frontend/src/hooks/useRouteWsChannel.ts` (NEW)
```ts
// Usage in any page component:
// useRouteWsChannel(['vaults'])
// useRouteWsChannel([`portfolio:${walletAddress}`])
export function useRouteWsChannel(channels: string[]) {
  const subscribe = useWebSocketStore(s => s.subscribe)
  const unsubscribe = useWebSocketStore(s => s.unsubscribe)
  useEffect(() => {
    channels.forEach(c => subscribe(c))
    return () => channels.forEach(c => unsubscribe(c))
  }, [channels.join(',')])
}
```

Add `useRouteWsChannel` call to each page component with its corresponding channel(s).

#### Files to modify
- `[MODIFY] backend/internal/ws/client.go` — fix `canSubscribe` logic (public vs private channels)
- `[MODIFY] backend/internal/handlers/ws_handler.go` — make auth optional (Option A) or add token endpoint (Option B)
- `[MODIFY] frontend/src/stores/websocket-store.ts` — fix protocol (`channel` field instead of `vaultId`)
- `[NEW] frontend/src/hooks/useRouteWsChannel.ts` — route-aware channel hook
- `[MODIFY] frontend/src/routes/index.tsx` — `useRouteWsChannel(['dashboard'])`
- `[MODIFY] frontend/src/routes/vaults/index.tsx` — `useRouteWsChannel(['vaults'])`
- `[MODIFY] frontend/src/routes/vaults/$id/index.tsx` — `useRouteWsChannel(['vault:' + id])`
- `[MODIFY] frontend/src/routes/trade.tsx` — `useRouteWsChannel(['vault:' + vaultId])`
- `[MODIFY] frontend/src/routes/portfolio/index.tsx` — `useRouteWsChannel(['portfolio:' + walletAddress])`
- `[MODIFY] frontend/src/routes/invest/index.tsx` — `useRouteWsChannel(['vaults'])`

---

## Task 6 — `/` Dashboard: Mode-Aware Vault Lists

### Problem
The dashboard shows platform aggregate metrics and a connected portfolio summary. It does NOT show:
- **Manager mode**: user's own vaults (sorted by `created_at` DESC)
- **Investor mode**: vaults the user has invested in (sorted by investment date DESC)

### What needs to change

#### Frontend — `frontend/src/routes/index.tsx`

**Manager mode block** (render when `isManager === true` and wallet connected):
1. Call `useVaultsQuery({ managerAddress: walletAddress, sortBy: 'created_at', sortOrder: 'desc' })`.
2. Render a compact table/list (reuse or adapt `VaultsTable` from Task 2, scoped to manager's vaults).
3. Section title: "Your Vaults" with a "View All →" link to `/vaults`.
4. If no vaults: empty state with CTA button to `/vaults/create`.

**Investor mode block** (render when `isManager === false` and wallet connected):
1. Call `usePortfolioQuery(walletAddress)` — already exists.
2. For each portfolio position, fetch/join vault details to get display name and PNL.
3. Sort by `invested_at` DESC.
4. Render compact table: Vault name, TVL, PnL%, invested amount, action button (→ vault detail).
5. Section title: "Your Investments" with "View Portfolio →" link to `/portfolio`.

#### Backend — `vault_handler.go` + `repository`
1. Add `manager_address` query param to `ListVaults` to filter vaults by manager wallet address.
2. This allows frontend to fetch only the authenticated manager's vaults.

#### Files to modify
- `[MODIFY] frontend/src/routes/index.tsx` — add mode-aware vault/investment sections
- `[NEW] frontend/src/routes/_components/ManagerVaultsList.tsx`
- `[NEW] frontend/src/routes/_components/InvestorVaultsList.tsx`
- `[MODIFY] backend/internal/handlers/vault_handler.go` — add `?manager_address=` filter
- `[MODIFY] backend/internal/repository/vault_repo.go` — add manager address filter to list query

---

## Execution Order (Priority / Dependencies)

```
Task 5 (WebSocket fix)          ← must be done first; all real-time features depend on it
  |
  +--> Task 2 (Vaults table)    ← sort/filter API also needed by Task 6
  |       |
  |       +--> Task 6 (Dashboard mode-aware lists)
  |
  +--> Task 3 (Create Vault form)  ← correct PDA derivation needed by Task 4
  |       |
  |       +--> Task 4 (TX confirmation match Phantom)
  |
  +--> Task 1 (Trade vault assets panel)  ← independent, can be done anytime
```

**Recommended implementation order: 5 → 2 → 6 → 3 → 4 → 1**

---

## Open Questions / Decisions Needed

1. **WebSocket auth (Task 5)**: Option A (unauthenticated connect, gate private channels at subscribe-time) or Option B (short-lived JWT)? Option A is faster; Option B is more secure.

2. **Sparkline data source (Task 2)**: The img1 table shows a mini area chart per vault. Does the backend have historical TVL data per vault? If not, should we use random noise as a placeholder or skip the sparkline initially?

3. **Cover image upload (Task 3)**: Upload to S3/backend storage (returns URL) or base64-encode into metadata JSONB? Base64 is simpler but bloats the DB for large images.

4. **Multi-vault per manager (Task 3)**: The contract seeds vault PDA as `[VAULT_SEED, manager.key()]` — this means **one vault per manager pubkey**. Is this intentional? If a manager wants multiple vaults they need different wallets. Should the seed include a nonce/index?

5. **PNL calculation (Task 2)**: PNL is not currently tracked in the DB. Should it be computed live as `(current TVL - total deposits) / total deposits`? Or is there a planned separate PNL tracking mechanism?
