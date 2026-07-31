# Product Requirements Document (PRD): "FBYT-Clone" (MVP)

## 1. Vision

Build a non-custodial, vault-based investment platform on Solana that solves the UX and performance limitations observed in existing market solutions. This POC serves as a high-performance demonstration of engineering competence, focusing on efficient data handling, robust state management, and advanced on-chain Oracle integration.

## 2. Core Features (MVP Scope)

### Manager Mode

* **Vault Creation:** Initialize a vault PDA (Anchor). Set parameters: `minRaiseAmount`, `performanceFee`, `managementFee`, `lockupPeriod`.
* **Advanced Management:**
  * Edit vault metadata (Tags/Focus Assets) via backend (Postgres). Restrict Focus Assets to a strict whitelisted dropdown to fix search filtering bugs.
  * **Execute Trades (Pyth Oracle AMM):** Manager executes a swap. The Anchor program reads live Devnet prices from the Pyth Network Oracle, burns the input token, and mints the exact mathematical equivalent of the output token directly to the vault.
* **Fee Management:** Dashboard to view accrued fees, with explicit UI copy explaining the automated backend "Keeper" distribution system.

### Investor Mode

* **Investment Flow:** Deposit SOL/USDC into Vault PDA. Receive state-based "Share Tokens" (accounting in the PDA). *Future scope: Multi-currency "Zap" deposits.*
* **Withdrawal Flow:** In-kind withdrawal (receives underlying assets held by vault).
* **Dashboard:** Real-time PnL monitoring using WebSocket updates.

## 3. Architecture Overview

* **Blockchain:** Solana (Devnet). Anchor framework.
* **Oracles:** Pyth Network (for Devnet live price feeds).
* **Backend:** Golang (`Gin` framework, `Gorm` ORM). PostgreSQL.
* **Frontend:** TanStack Start (TypeScript).
* **Real-time Logic:** WebSockets (`gorilla/websocket` in Go) to push targeted updates (`type: "update"`) to the frontend.

## 4. Technical Improvements (The "Fixes")

| **Issue Identified**        | **Proposed Solution in Clone**                                                                                       |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| **HTTP Polling**            | Implement WebSocket subscription. Backend pushes`{"type": "update", "vaultId": "..."}`.                                  |
| **Phantom Simulation Fail** | Implement strict quote-locking in Zustand store. Pause polling immediately on wallet trigger.                              |
| **State Conflict**          | Use`sessionStorage`for Manager/Invest mode toggles (tabs are isolated).                                                  |
| **React Lag**               | Use`@tanstack/react-virtual`for all vault lists (DOM windowing).                                                         |
| **Dust Filtering**          | Centralized`dustThreshold`constant in backend (shared by API and Frontend) to prevent`/trade`vs`/portfolio`mismatch. |
| **Failed TX UX**            | Local "Pending Transactions" state store in Zustand. Explicit "Trade Failed" UI with Solscan links.                        |
| **Missing History**         | Auto-invalidate and refetch trade history cache upon successful WebSocket confirmation of swap.                            |

## 5. Data Models (Postgres + Gorm)

### Vault

* `ID` (Primary Key)
* `Address` (Solana PDA Address)
* `ManagerAddress`
* `VaultStatus` (Fundraising, Active, Dormant)
* `Metadata` (JSONB): Contains `FocusAssets` (strict enum), `Description`, `DisplayName`.
* `PerformanceFee`, `ManagementFee` (BPS)

### TradeHistory

* `VaultID` (Foreign Key)
* `TransactionSignature`
* `Type` (Buy/Sell/Deposit/Withdraw)
* `InputToken`, `OutputToken`, `Amount`, `PriceAtExecution`

## 6. Smart Contract Logic (Anchor)

### Instructions

1. **`initialize_vault`** : Creates the vault PDA with fee configuration and manager PubKey.
2. **`deposit`** : Transfers assets from user to vault PDA, updates vault state, calculates/mints share price tokens.
3. **`withdraw`** : Calculates proportional asset claim, transfers assets (in-kind) back to user, burns shares.
4. **`execute_trade_pyth`** : (The Oracle AMM)

* Validates manager signature.
* Reads the current Devnet price from the Pyth Price Account (e.g., SOL/USD).
* Calculates the conversion rate.
* Decrements `VaultAssetsA`, increments `VaultAssetsB` based on the exact Pyth price feed, ensuring a mathematically pure Devnet trade execution.

## 7. Development Phases

### Phase 1: The Engine (Smart Contract + DB)

* Implement Anchor instructions (Init, Deposit, Withdraw, Pyth Swap).
* Define Go models and Gorm migrations for Postgres.

### Phase 2: The API (Golang + WebSockets)

* Create Gin API routes (REST) for initial state loading.
* Implement Gorilla WebSockets for real-time vault/trade updates.

### Phase 3: The Client (TanStack Start)

* UI architecture with Tailwind/Shadcn.
* Zustand global state (fixing the multi-tab bug).
* Integration of `@solana/wallet-adapter-react`.

## 8. Pages

### A. Manage
1. `/` - dashboard overview
2. `/vaults` - vault list
3. `/vaults/create` - create vault
4. `/vaults/:id/` - detail vault
5. `/vaults/:id/edit` - edit vault
6. `/payout` - payout fee
7. `/trade` - swap trade

### B. Invest
1. `/` - dashboard overview
2. `/invest` - list of vaults
3. `/portfolio` - portfolio

### C. General
1. `/settings` - settings page