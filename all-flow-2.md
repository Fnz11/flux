# Full System Flow Analysis

This document provides a comprehensive, verified mapping of all data flows within the system, specifically detailing interactions between the Frontend, the Backend, and the Solana Program.

---

## 1. Frontend -> Solana Program (Direct Flows)

### Overview
- **Solana Libraries**: `@coral-xyz/anchor`, `@solana/web3.js`, `@solana/spl-token`, `@solana/wallet-adapter-react`.
- **Program ID**: `FBYT1111111111111111111111111111111111111111`.
- **Initialization**: `src/lib/anchor.ts` sets up the `AnchorProvider` and Program instance. `src/lib/transactions.ts` handles compute budget limits and transaction sending.

### Flows
**A. Vault Initialization (`initializeVault`)**
* **Caller Component**: `src/routes/vaults/create.tsx` (via `useCreateVault`)
* **Accounts**: `manager` (Signer), `vault` (PDA), `shareTokenMint` (Keypair/Signer), `vaultAuthority` (PDA), system programs.
* **Flow**: Converts inputs (lamports/bps) -> Generates mint keypair -> Builds instruction -> Signs & Sends transaction -> Awaits confirmation -> Syncs with Backend via `POST /vaults`.

**B. Deposit (`deposit`)**
* **Caller Component**: `src/routes/invest/_components/DepositModal.tsx` (via `useDeposit`)
* **Accounts**: `investor` (Signer), `vault`, `vaultAuthority`, investor/vault Token Accounts, `depositMint`, `shareTokenMint`, investor Share Account, system programs.
* **Flow**: Converts amount -> Creates ATAs if needed -> Wraps SOL if native -> Appends `deposit` instruction -> Signs & Sends -> Syncs with Backend via `POST /transactions/verify`.

**C. Withdraw (`withdraw`)**
* **Caller Component**: `src/routes/invest/_components/WithdrawModal.tsx` (via `useWithdraw`)
* **Accounts**: `investor` (Signer), `vault`, `vaultAuthority`, investor/vault Token Accounts, `withdrawMint`, `shareTokenMint`, investor Share Account, system programs.
* **Flow**: Converts share amount -> Creates ATA if needed -> Appends `withdraw` instruction -> Signs & Sends -> Syncs with Backend via `POST /transactions/verify`.

**D. Trade Execution via Pyth Oracle (`executeTradePyth`)**
* **Caller Component**: `src/routes/trade/_components/SwapForm.tsx` (via `useExecuteTrade`)
* **Accounts**: `manager` (Signer), `vault`, `vaultAuthority`, vault Input/Output ATAs, `vaultInputMint`, `vaultOutputMint`, Pyth `priceUpdate` PDA, token program.
* **Flow**: Converts trade amount & slippage -> Creates ATAs if needed -> Wraps SOL if native -> Appends `executeTradePyth` instruction -> Signs & Sends -> Syncs with Backend via `POST /trades/sync`.

---

## 2. Frontend -> Backend (API & WebSockets)

### Overview
- **API Client**: `frontend/src/lib/api.ts` (Axios, Base URL: `http://localhost:8080/api/v1`).
- **WebSocket Client**: `frontend/src/stores/websocket-store.ts` (Endpoint: `ws://localhost:8080/api/v1/ws`).
- **Backend Framework**: Go Gin Web Framework (`backend/internal/router/router.go`).

### Status of Identified Issues ✅
1. **Unimplemented `/fees/:vaultId` Route**: **RESOLVED** — Created `FeeHandler` in `backend/internal/handlers/fee_handler.go` with unit tests and registered routes `GET /api/v1/fees/:vaultId` and `GET /api/v1/vaults/:address/fees` in `backend/internal/router/router.go`.
2. **Route Mismatch for Update Vault Metadata**: **RESOLVED** — Updated `frontend/src/services/apis/rest-api/vault.service.ts` to call `PATCH /api/v1/vaults/:address` and registered route alias `PATCH /api/v1/vaults/:address/metadata` in the backend router for full forward/backward compatibility. All tests passed.

### Core Flows
* **Config**: `GET /api/v1/config` (Fetches dust threshold, whitelists)
* **Auth**: `POST /api/v1/auth/nonce` & `POST /api/v1/auth/verify` (Sign In With Solana -> returns JWT)
* **Vaults**:
  * `GET /api/v1/vaults` (List vaults, paginated/filtered)
  * `GET /api/v1/vaults/:address` (Single vault details)
  * `POST /api/v1/vaults` (Create vault metadata on backend)
  * `GET /api/v1/vaults/:vaultId/balances` (Token balances for vault)
  * `GET /api/v1/vaults/:id/sparkline` (Vault performance chart)
* **Trades**:
  * `GET /api/v1/vaults/:vaultId/trades` (Vault trade history)
  * `GET /api/v1/vaults/trades` (Batch fetch multi-vault trades)
  * `POST /api/v1/trades/sync` (Manager syncing executed trade)
* **Investor / Portfolios**:
  * `GET /api/v1/portfolio/:wallet` (User positions)
  * `GET /api/v1/portfolio/history` (User performance chart)
* **Metrics & Leaderboard**:
  * `GET /api/v1/metrics/series` (TVL, PnL, Fees, Volume charts)
  * `GET /api/v1/metrics/market` (Global platform stats)
  * `GET /api/v1/metrics/leaderboard` (Trending/Gainers)
* **Global Activity / Search / Notifications**:
  * `GET /api/v1/transactions` (Global feed)
  * `POST /api/v1/transactions/verify` (Investor verifying deposit/withdraw)
  * `GET /api/v1/search` (Omni-search for investors/managers)
  * `GET / POST /api/v1/notifications` (Read/Create alerts)

---

## 3. Backend -> Solana Program (On-chain Syncing)

### Overview
- **SDK**: Go Solana library `github.com/gagliardetto/solana-go`.
- **Infrastructure**: Custom RPC circuit breaker (`sony/gobreaker` in `pkg/solana/client.go`) prevents RPC rate limits from exhausting DB connections.
- **Anchor Parser**: `pkg/solana/anchor.go` manually decodes 8-byte instruction discriminators using SHA-256 to parse `initialize_vault`, `deposit`, `withdraw`, and `execute_trade_pyth` payloads in Go.

### Flows
**A. Vault Initialization Sync (`POST /sync/vault`)**
* Calls `GetTransaction()` via RPC to fetch on-chain tx.
* Verifies `initialize_vault` instruction presence.
* Extracts `vaultAddress` and verifies transaction success.
* Saves to Postgres `vaults` table (Status: "Fundraising").
* Evicts Redis cache, dispatches WS events.

**B. Trade / Deposit / Withdraw Sync (`POST /sync/trade` / `POST /verify/transaction`)**
* Fetches tx via `GetTransaction()` *outside* DB transaction block for performance.
* Verifies JWT signer matches the on-chain signer.
* **Classification**:
  - Parses `execute_trade_pyth` -> Identifies as `Buy` or `Sell` based on SOL/USDC mint accounts.
  - Parses `deposit` / `withdraw` -> Calculates NAV, shares, and execution price.
* Updates `trade_histories`, `portfolios`, and `vault_tvl` within a single Postgres transaction.
* Evicts Redis cache, dispatches WS events (`trade_confirmed`).

**C. Local Database Seeder (`cmd/seed`)**
* Backend includes a robust seeder (`internal/seed/solana.go`).
* Generates wallets, requests airdrops (with exponential backoff/jitter).
* Signs and sends real `system.Transfer` and `memo.Instruction` transactions against local `http://localhost:8899` to simulate legitimate signatures for frontend testing.
