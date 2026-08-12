# Frontend Testing Plan

## Objectives
- **Scale:** Achieve 300+ tests covering unit, integration, and End-to-End (E2E) layers.
- **Isolation (Pure Frontend Testing):** Mock all Backend REST APIs, WebSockets, and On-Chain interactions so the frontend is tested entirely in isolation.
- **Coverage:** Ensure every case (happy paths, error states, empty states, loading states, and edge cases) is comprehensively covered.

## 1. Tooling & Setup
- **Unit & Integration:** `Vitest` + `React Testing Library` (RTL) + `MSW` (Mock Service Worker).
  - *Why MSW?* It intercepts network requests at the service worker level, allowing us to seamlessly mock REST APIs for components and hooks without changing application code.
- **E2E Testing:** `Playwright`.
  - *Why Playwright?* Excellent capabilities for network interception (`page.route`) to mock API and WebSocket traffic per test, and reliable UI automation.
- **Web3 Mocking:** Mock `@solana/wallet-adapter-react` to simulate wallet connections, and mock `@coral-xyz/anchor` (`getProgram`) to simulate instant transaction successes or failures without a real RPC.

## 2. Test Layers & Scope

### A. Unit Tests (~100 Tests)
*Focus: Pure logic, state management, and data transformation (No UI rendering).*

1. **Mappers (`src/lib/mappers.ts`)**
   - Happy paths: correctly mapping snake_case to camelCase.
   - Edge cases: null, undefined, missing fields, malformed data.
2. **State Stores (`src/stores/*`)**
   - **Vault Store:** fetching lists, fetching by ID, updating metadata, error states.
   - **Transaction Store:** adding pending tx, confirming tx, moving to history, clearing.
   - **Notification Store:** adding items, unread counts, marking as read, parsing WS messages.
   - **WebSocket Store:** connection, reconnection backoff (max attempts), sub/unsub logic.
3. **Services (`src/services/apis/*`)**
   - Verify API endpoint formatting, query string generation, and payload structure.
4. **Custom Hooks (`src/hooks/*`)**
   - `useDeposit`, `useWithdraw`, `useExecuteTrade`.
   - Test cases: success flows (returning signature), failure flows (throwing errors), wallet not connected errors.
5. **Utility Functions**
   - Formatting tools, calculations (PnL, percentages).

### B. Integration Tests (~150 Tests)
*Focus: UI components, pages, and their interaction with mocked hooks/stores.*

1. **Core UI Components (`src/components/ui/*`)**
   - Render tests for Buttons, Inputs, Dialogs, Selects.
   - State tests: disabled, loading, invalid inputs.
2. **Complex Components**
   - **WalletConnectButton:** disconnected, connecting, connected (showing AddressPill).
   - **SearchAutocomplete:** debounce typing, empty results, selecting an item.
   - **NotificationsPopover:** empty state, populated state, clicking to mark read.
3. **Route / Page Components (`src/routes/*`)**
   - **Vaults List (`/vaults`):**
     - Loading skeleton.
     - Empty state (no vaults found).
     - Populated list, sorting, filtering by status.
   - **Vault Details (`/vaults/$id`):**
     - Fetching data and rendering charts.
     - Error state (vault not found).
   - **Trade / Invest Forms:**
     - Form validation (empty amounts, zero amounts, exceeding balance).
     - Displaying fees and estimated outputs.
     - Simulating submit clicks and verifying the correct hook is called.
   - **Portfolio (`/portfolio`):**
     - Displaying positions and aggregate PnL.

### C. End-to-End (E2E) Tests (~50+ Tests)
*Focus: Full user flows in a real browser using Playwright with mocked network responses.*

1. **Authentication Flow:**
   - Simulating wallet connection via mocked provider and verifying UI updates.
2. **Investor Flows:**
   - Navigating the vault directory.
   - Selecting a vault and executing a successful deposit.
   - Handling a failed deposit (mocking a rejected transaction).
   - Executing a withdrawal and verifying the transaction toast appears.
3. **Manager Flows:**
   - Navigating to the create vault page.
   - Filling out the creation form, submitting, and seeing the new vault in the list.
   - Executing a trade (Buy/Sell) and verifying the slippage and output token changes.
   - Updating vault metadata.
4. **Real-time / WebSocket Flows:**
   - Simulating an incoming `PRICE_UPDATE` via WS mock and verifying charts/numbers update.
   - Simulating an incoming `TX_CONFIRMED` notification and seeing the success toast.
5. **Edge Cases & Error Handling:**
   - 404 pages.
   - Network errors (mocking 500 API responses) and verifying error boundaries or error alerts.

## 3. Mocking Implementation Strategy

- **REST API (Vitest/Integration):** 
  - Create `src/mocks/handlers.ts` for MSW.
  - Intercept `/api/v1/vaults`, `/api/v1/portfolio`, etc., to return predefined JSON objects.
- **REST API (Playwright/E2E):** 
  - Use `page.route('**/api/v1/**', ...)` to intercept and return mock JSON. This allows custom mock data per test (e.g., forcing a 500 error for one specific test).
- **WebSocket Mocking:** 
  - For Vitest: Use the existing `FakeWebSocket` approach (seen in `ws.test.ts`) to simulate server pushes.
  - For E2E: Expose a global testing function (`window.__mockWsMessage(data)`) during Playwright tests to inject WS messages from the test script.
- **On-Chain Mocking:**
  - Bypass actual Solana RPC calls by mocking the wallet adapter context in tests. 
  - Replace Anchor's `Program` methods with vi/jest spy functions that return dummy transaction signatures.

## 4. Execution Plan
1. **Phase 1 (Setup):** Install Vitest, React Testing Library, JSDOM, and MSW. Configure `vite.config.ts` for testing. Install `@playwright/test`.
2. **Phase 2 (Unit):** Fill out the remaining unit tests for stores, mappers, and hooks.
3. **Phase 3 (Integration):** Implement MSW handlers. Write tests for forms, UI components, and Route pages.
4. **Phase 4 (E2E):** Setup Playwright fixtures for network/wallet mocking. Write feature-by-feature E2E specs.
