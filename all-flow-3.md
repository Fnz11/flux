# All-Flow Audit v3
> Audited: 2026-08-09 | Scope: Frontend → Backend → Solana Program (and direct Frontend → Program)

---

## TL;DR – Critical Bugs Found

| # | Severity | Area | Issue |
|---|----------|------|-------|
| 1 | 🔴 CRITICAL | IDL / Program | **Program ID mismatch** – IDL says `FBYT1111…` but program declares `FJY6JUz…` |
| 2 | 🔴 CRITICAL | IDL vs Program | **`initializeVault` accounts in IDL wrong** – missing `deposit_mint`, stale signer list |
| 3 | 🔴 CRITICAL | IDL vs Program | **`VaultState` in IDL is incomplete** – missing `creator`, `pending_manager`, `deposit_mint`, `allowed_output_mints`, `is_paused`, `high_water_mark`, etc. |
| 4 | 🔴 CRITICAL | execute_trade_pyth | **Transfer is self-to-self** – both transfer_in and transfer_out go from an account to ITSELF; no actual swap occurs |
| 5 | 🔴 CRITICAL | useExecuteTrade → Backend | **Frontend sends `transaction_signature` but backend requires `signature`** → 400 Bad Request |
| 6 | 🔴 CRITICAL | SyncVault | **`ix.Accounts[0]` is the manager wallet, not the vault PDA** – vault stored with wrong address |
| 7 | 🟠 HIGH | Deposit/Withdraw → Backend | **Calls `/transactions/verify` (read-only) instead of `/trades/sync`** – TVL and portfolio never updated |
| 8 | 🟠 HIGH | useExecuteTrade | **Trade type always 'Buy'** – amountIn > 0 is always true |
| 9 | 🟡 MEDIUM | useDeposit | **Hardcoded USDC_DECIMALS=6** – any non-USDC non-SOL vault token will produce wrong raw amounts |
| 10 | 🟡 MEDIUM | classifyInstructions | **Withdraw arg key "shares" never matches** – only fallback "shares_to_burn" works |
| 11 | 🟡 MEDIUM | IDL Events | **On-chain Deposited/Withdrawn events have extra fields** not in IDL (nav_per_share, total_assets_after, total_shares_after) |
| 12 | 🟢 LOW | useDeposit | Sends duplicate `transaction_signature` AND `signature` in verify body |

---

## 1. Program ID Mismatch (CRITICAL 🔴)

**Files:** `frontend/anchor/idl/fbyt_clone_vault.json`, `frontend/src/lib/idl.json`, `contracts/programs/fbyt-clone-vault/src/lib.rs`

```diff
- IDL metadata.address: "FBYT1111111111111111111111111111111111111111"
+ lib.rs declare_id!: "FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais"
+ Anchor.toml:          "FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais"
```

Both IDL files (`frontend/anchor/idl/` and `frontend/src/lib/`) carry a placeholder address `FBYT1111…`. The actual deployed program ID is `FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais`.

**Impact:** Every on-chain call routes to the wrong program. The ENTIRE frontend → Solana flow is broken.

**Fix:** Update both IDL files:
```json
"metadata": { "address": "FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais" }
```
Or better: regenerate with `anchor build`.

---

## 2. IDL `initializeVault` Accounts Mismatch (CRITICAL 🔴)

**File:** IDL vs `contracts/programs/fbyt-clone-vault/src/instructions/initialize_vault.rs`

| IDL Account | Actual Rust Account | Match? |
|---|---|---|
| `manager` (isSigner) | `manager` (Signer) | ✅ |
| `vault` (isMut) | `vault` (init PDA) | ✅ |
| `shareTokenMint` (isMut, **isSigner:true**) | `share_token_mint` (init, NOT signer) | ❌ |
| `vaultAuthority` | `vault_authority` | ✅ |
| *(missing in IDL)* | `deposit_mint` | ❌ |
| `systemProgram` | `system_program` | ✅ |
| `tokenProgram` | `token_program` | ✅ |
| `rent` | *(not in Rust struct)* | ❌ |

- `shareTokenMint.isSigner: true` in IDL is wrong — Anchor-initialized accounts are not signers
- `deposit_mint` is completely absent in IDL but required by the Rust context
- `rent` is in IDL but not in the Rust struct (handled automatically by Anchor 0.29+)

**Fix:** Run `anchor build` to regenerate the IDL.

---

## 3. IDL `VaultState` Struct Missing Fields (CRITICAL 🔴)

**Files:** IDL accounts section vs `contracts/programs/fbyt-clone-vault/src/state.rs`

| IDL Field | state.rs Field | Match? |
|---|---|---|
| `manager` | `manager` | ✅ |
| *(missing)* | `creator` | ❌ |
| *(missing)* | `pending_manager` (Option<Pubkey>) | ❌ |
| *(missing)* | `deposit_mint` | ❌ |
| *(missing)* | `share_token_mint` | ❌ |
| *(missing)* | `allowed_output_mints: [Pubkey; 4]` | ❌ |
| `minRaiseAmount` | `min_raise_amount` | ✅ |
| `performanceFeeBps` | `performance_fee_bps` | ✅ |
| `managementFeeBps` | `management_fee_bps` | ✅ |
| *(missing)* | `accrued_performance_fee` | ❌ |
| *(missing)* | `accrued_management_fee` | ❌ |
| `lockupPeriod` | `lockup_period` | ✅ |
| `totalSharesMinted` | `total_shares_minted` | ✅ |
| `totalAssetsDeposited` | `total_assets_deposited` | ✅ |
| `vaultBump` | `vault_bump` | ✅ |
| `vaultAuthorityBump` | `vault_authority_bump` | ✅ |
| `status` | `status` | ✅ |
| *(missing)* | `is_paused` | ❌ |
| `createdAt` | `created_at` | ✅ |
| `lastTradeAt` | `last_trade_at` | ✅ |
| *(missing)* | `high_water_mark` | ❌ |
| *(missing)* | `last_fee_accrual_at` | ❌ |
| *(missing)* | `_reserved: [u8; 64]` | ❌ |

Any deserialization of on-chain `VaultState` will produce garbage values because the byte offsets are all wrong.

**Fix:** `anchor build` regenerates a correct IDL.

---

## 4. `execute_trade_pyth` Self-Transfer Bug (CRITICAL 🔴)

**File:** `contracts/programs/fbyt-clone-vault/src/instructions/execute_trade_pyth.rs` lines 95–119

```rust
// transfer_in: vault_input_token_account → vault_input_token_account  (SAME!)
let transfer_in = TransferChecked {
    from: ctx.accounts.vault_input_token_account.to_account_info(),
    to:   ctx.accounts.vault_input_token_account.to_account_info(), // ← BUG
    ...
};

// transfer_out: vault_output_token_account → vault_output_token_account  (SAME!)
let transfer_out = TransferChecked {
    from: ctx.accounts.vault_output_token_account.to_account_info(),
    to:   ctx.accounts.vault_output_token_account.to_account_info(), // ← BUG
    ...
};
```

Both CPIs transfer tokens from an account to itself — a no-op. No actual swap happens. The `total_assets_deposited` accounting update after this is also incorrect as a result.

**Fix:** Implement a real DEX CPI (e.g. Jupiter aggregator, Orca Whirlpool) or correct `from`/`to` routing.

---

## 5. Frontend Sends Wrong Field to `/trades/sync` (CRITICAL 🔴)

**File:** `frontend/src/hooks/useExecuteTrade.ts` lines 182–194

Frontend sends:
```ts
await api.post('/trades/sync', {
  vault_id: params.vaultId,
  transaction_signature: signature,  // ← wrong key name
  trade_type, input_token, output_token, amount_in, amount_out, price_at_execution
})
```

Backend `SyncTradeRequest` struct (`backend/internal/handlers/sync_handler.go` line 59–62):
```go
type SyncTradeRequest struct {
    Signature string `json:"signature" binding:"required"`  // ← expects "signature"
    VaultID   string `json:"vault_id"  binding:"required"`
}
```

- `signature` field is missing → Go `binding:"required"` validation fails → **400 Bad Request every time**
- All extra fields (`trade_type`, `input_token`, etc.) are silently ignored — the backend re-derives them from on-chain data anyway

**Fix:**
```ts
await api.post('/trades/sync', {
  signature,              // ← was "transaction_signature"
  vault_id: params.vaultId,
})
```

---

## 6. `SyncVault` Extracts Wrong Account as Vault Address (CRITICAL 🔴)

**File:** `backend/internal/handlers/sync_handler.go` lines 131–137

```go
if anchorIx.Name == "initialize_vault" {
    if len(ix.Accounts) > 0 {
        vaultAddress = ix.Accounts[0]  // ← BUG: index 0 is MANAGER, not vault
    }
}
```

Rust `InitializeVault` struct account order:
- Index 0: `manager` (signer) ← what's being stored as vault address
- **Index 1: `vault` (PDA) ← what we actually want**
- Index 2: `deposit_mint`
- Index 3: `share_token_mint`
- Index 4: `vault_authority`

The backend stores the manager's wallet address as the vault's on-chain address, causing all subsequent vault lookups by address to fail.

**Fix:**
```go
vaultAddress = ix.Accounts[1]  // vault PDA is index 1
```

---

## 7. Deposit/Withdraw Call Read-Only Endpoint Instead of `/trades/sync` (HIGH 🟠)

**Files:** `frontend/src/hooks/useDeposit.ts` L184–195, `frontend/src/hooks/useWithdraw.ts` L143–153

After on-chain success, both hooks call:
```ts
await api.post('/transactions/verify', { signature, vault_id, action, amount, symbol })
```

`VerifyHandler.Verify()` is **read-only** — it only checks if the transaction exists on-chain and returns a status. It does NOT:
- Create a trade history record
- Update portfolio positions
- Update vault TVL

The correct endpoint is `POST /trades/sync` which goes through `SyncHandler.SyncTrade()` and handles all DB writes atomically.

**Impact:** After every deposit and withdrawal, the backend DB is never updated. TVL stays at 0. Portfolio positions are never created or modified.

**Fix:** Replace the `verify` call in both hooks:
```ts
// Instead of:
await api.post('/transactions/verify', { ... })

// Use:
await api.post('/trades/sync', { signature, vault_id: vaultId })
```

---

## 8. Trade Type Logic Always Returns 'Buy' (HIGH 🟠)

**File:** `frontend/src/hooks/useExecuteTrade.ts` line 180

```ts
const tradeType: TradeType = params.amountIn > 0 ? 'Buy' : 'Sell'
```

`params.amountIn > 0` is always true because the program rejects `amount_in == 0` and the frontend would fail earlier. Sell is never sent. The type should be derived from token direction (input = quote → Buy; input = base → Sell). Fortunately the backend ignores this field and re-derives it from on-chain mint addresses.

---

## 9. Hardcoded USDC_DECIMALS in `useDeposit` (MEDIUM 🟡)

**File:** `frontend/src/hooks/useDeposit.ts` lines 25, 81–83

```ts
const USDC_DECIMALS = 6
const lamports = isNative(tokenMint)
  ? Math.round(amount * LAMPORTS_PER_SOL)
  : Math.round(amount * 10 ** USDC_DECIMALS)  // ← assumes 6 decimals for ALL non-SOL tokens
```

Any vault accepting a token with different decimals (e.g. 8-decimal token) will compute wrong amounts.

---

## 10. Wrong Withdraw Arg Key in `classifyInstructions` (MEDIUM 🟡)

**File:** `backend/internal/handlers/sync_handler.go` lines 397–400

```go
if v, ok := anchorIx.Args["shares"].(uint64); ok {        // ← never matches
    amountIn = decimal.NewFromUint64(v)
} else if v, ok := anchorIx.Args["shares_to_burn"].(uint64); ok {  // ← this one works
    amountIn = decimal.NewFromUint64(v)
}
```

The first lookup key `"shares"` never matches (actual arg is `shares_to_burn`). The fallback works but the dead `"shares"` branch is confusing.

---

## 11. IDL Events Missing Fields (MEDIUM 🟡)

**Files:** IDL events vs `contracts/programs/fbyt-clone-vault/src/events.rs`

On-chain `Deposited` event emits: `vault, investor, amount, shares_minted, token_mint, nav_per_share, total_assets_after, total_shares_after`

IDL only declares: `vault, investor, amount, sharesMinted, tokenMint`

Missing: `nav_per_share`, `total_assets_after`, `total_shares_after`

Same pattern for `Withdrawn`. `VaultInitialized` is missing `deposit_mint`.

Any event listener will miss these fields.

---

## Flow-by-Flow Status Summary

### Flow A: Frontend → Solana (Deposit)
```
useDeposit → getProgram → PDA derivation ✅ → ATA setup ✅
→ program.methods.deposit().accounts() → WRONG PROGRAM ID 🔴
→ api.post('/transactions/verify') → no DB write 🟠
```
**Status: BROKEN**

### Flow B: Frontend → Solana (Withdraw)
```
useWithdraw → getProgram → PDA derivation ✅ → ATA setup ✅
→ program.methods.withdraw().accounts() → WRONG PROGRAM ID 🔴
→ api.post('/transactions/verify') → no DB write 🟠
```
**Status: BROKEN**

### Flow C: Frontend → Solana (Execute Trade)
```
useExecuteTrade → getProgram → PDA + ATA setup ✅
→ Pyth PDA derived correctly ✅
→ program.methods.executeTradePyth() → WRONG PROGRAM ID 🔴
→ On-chain: self-transfer no-op 🔴
→ api.post('/trades/sync', { transaction_signature }) → 400 Bad Request 🔴
```
**Status: BROKEN** (3 independent bugs)

### Flow D: Frontend → Backend → Solana (Vault Sync)
```
POST /vaults/sync → SyncHandler.SyncVault()
→ JWT + wallet check ✅
→ GetTransaction(sig) → Solana RPC ✅
→ Parse initialize_vault instruction ✅
→ Extract ix.Accounts[0] as vault address → WRONG (is manager) 🔴
→ Store wrong address in DB 🔴
```
**Status: BROKEN**

### Flow E: Frontend → Backend (Vault CRUD)
```
GET/POST/PATCH /vaults → VaultHandler ✅
All REST CRUD works independently of on-chain state ✅
```
**Status: WORKING** ✅

### Flow F: Backend → Solana (Trade Sync, if correctly called)
```
POST /trades/sync { signature, vault_id }
→ GetTransaction → RPC ✅
→ ParseTransaction ✅
→ classifyInstructions ✅ (withdraw fallback works)
→ ExecTx: create trade + update portfolio + update TVL ✅
→ Cache invalidation + WebSocket events ✅
```
**Status: WORKS** (if field name is fixed on frontend) ✅

### Flow G: Frontend → Backend (Auth / Portfolio / WS)
```
Auth: POST /auth/nonce + /auth/verify → JWT issued ✅
Portfolio: GET /portfolio/:wallet → works ✅ (but data is empty due to missing syncs)
WebSocket: GET /api/v1/ws → ✅
```
**Status: WORKING** ✅

---

## Pyth Oracle – Feed ID Match Check

| Component | Value | Match? |
|---|---|---|
| Frontend `SOL_USD_FEED_ID` | `ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` | ✅ |
| Program `SOL_USD_FEED_ID` | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` | ✅ |
| Frontend PDA seeds | `['write_price_update', hex(feedId)]` | ✅ |
| `MAXIMUM_AGE` | 60 seconds | ✅ |
| Confidence check | `conf * 100 <= price` (1% spread) | ✅ |

Pyth integration is **correct** on both frontend and program sides.

---

## Required Fixes – Priority Order

### Blockers (must fix before anything works)

1. **Update IDL `metadata.address`** in both:
   - `frontend/anchor/idl/fbyt_clone_vault.json`
   - `frontend/src/lib/idl.json`
   
   To: `"FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais"`

2. **Fix `/trades/sync` field** in `useExecuteTrade.ts`:
   ```ts
   // Change:
   await api.post('/trades/sync', { vault_id: params.vaultId, transaction_signature: signature, ... })
   // To:
   await api.post('/trades/sync', { signature, vault_id: params.vaultId })
   ```

3. **Fix deposit/withdraw to call `/trades/sync`** in `useDeposit.ts` and `useWithdraw.ts`:
   ```ts
   await api.post('/trades/sync', { signature, vault_id: vaultId })
   ```

4. **Fix `SyncVault` vault address extraction** in `sync_handler.go`:
   ```go
   vaultAddress = ix.Accounts[1]  // not Accounts[0]
   ```

5. **Fix `execute_trade_pyth` self-transfer** in `execute_trade_pyth.rs` — requires proper DEX CPI implementation.

### Important (data integrity)

6. **Regenerate IDL** via `anchor build` — fixes accounts, VaultState fields, events mismatch.

7. **Fix `initializeVault` IDL manually** if not regenerating: remove `rent`, add `deposit_mint`, fix `shareTokenMint.isSigner = false`.
