# Enterprise Solana Transaction Optimization Plan

## Objective
Transform the naive transaction polling model into a robust, low-latency enterprise dApp pattern (similar to Jupiter, Tensor, Helius). This applies to all transaction flows (Create Vault, Deposit, Withdraw) across both frontend and backend.

## 1. Frontend Optimizations (React / Solana Web3.js)

### 1.1 Hybrid Confirmation Pattern
Replace `connection.confirmTransaction` with a robust `Promise.race` hybrid pattern in `lib/transactions.ts`. 

- **Primary**: `signatureSubscribe` (WebSocket) for ~400ms confirmation.
- **Immediate Check**: `getSignatureStatuses` (RPC) immediately after sending, to catch fast processing before WS connects.
- **Expiry Monitor**: Continuously check `getBlockHeight` against the transaction's `lastValidBlockHeight`. Abort fast if the transaction expires.

### 1.2 Commitment Level
- Standardize on `confirmed` commitment for all UI interactions. Avoid `finalized` (which takes ~12-15s).

### 1.3 WebSocket RPC Connection
- Ensure `useConnection` is configured with a valid `wsEndpoint`. Without this, `@solana/web3.js` falls back to slow HTTP polling for subscriptions.

### 1.4 Optimistic UI Updates
- In `useCreateVault`, `useDeposit`, and `useWithdraw`:
  - Await the `confirmed` RPC status via the new hybrid helper.
  - Call `/tx/submit` to pass the signature to the backend.
  - **Do not block the UI** waiting for backend indexing. Immediately show success toast, navigate/close modals, and let TanStack Query refetch in the background.

## 2. Backend Optimizations (Go / Gin)

### 2.1 Direct Trigger on `/tx/submit`
- **Current Issue**: The frontend submits the signature, but the backend waits for the 5-15s `TxIndexerWorker` ticker to pick it up from the DB and confirm it.
- **Fix**: Modify `SubmitTransaction` (in `tx_prepare_handler.go` / `tx_prepare_service.go`) to immediately spawn a goroutine or trigger an instant reconciliation job for that specific `draftId`. 
- This ensures the backend indexes the transaction immediately upon frontend notification.

### 2.2 Re-purpose `TxIndexerWorker` as a Safety Net
- Keep the `TxIndexerWorker` ticker, but treat it purely as a fallback/catch-up mechanism for:
  - Dropped connections.
  - Users closing the tab before calling `/tx/submit`.
  - RPC node desyncs.

### 2.3 Backend RPC Commitment
- Ensure the backend's `GetTransaction` logic checks for `confirmed` status rather than defaulting to `finalized`, allowing the draft to transition to `CONFIRMED` status faster.

## 3. Implementation Steps

1.  **FE - `lib/transactions.ts`**: Rewrite `confirmTransactionHelper` to use the hybrid pattern (WS + Status + Expiry).
2.  **FE - App Config**: Update Solana provider to explicitly set `wsEndpoint` (e.g., `ws://127.0.0.1:8900` for local).
3.  **BE - `tx_prepare_handler.go`**: Update `/tx/submit` to fire an immediate sync channel/goroutine to `TxIndexerWorker` or `TxPrepareService` to reconcile the tx instantly.
4.  **FE - Hooks**: Refactor `useCreateVault`, `useDeposit`, `useWithdraw` to fire-and-forget the backend wait, relying on the instant RPC confirmation for UX state changes.
