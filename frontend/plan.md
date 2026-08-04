## Agent 1: Infrastructure & Scaffolding (The Base)
**Goal:** Initialize the raw repository, routing skeleton, and styling engine.
*   **Task 1.1:** Initialize TanStack Start with TypeScript.
*   **Task 1.2:** Configure Tailwind CSS and initialize Shadcn UI CLI.
*   **Task 1.3:** Set up the root `__root.tsx` layout and define the routing tree based on the PRD (Manager, Invest, General pages).
*   **Task 1.4:** Define global CSS variables, typography, and standard layout containers (Nav, Sidebar, Main Content area).

## Agent 2: Web3 Connection & Wallet (The Bridge)
**Goal:** Handle the Solana connection layer and wallet lifecycle.
*   **Task 2.1:** Install and configure `@solana/wallet-adapter-react` and `@solana/wallet-adapter-react-ui`.
*   **Task 2.2:** Build a custom `WalletConnectButton` component wrapping the default UI to match Shadcn styling.
*   **Task 2.3:** Implement a global context or hook to easily access `publicKey`, `signTransaction`, and `connection`.
*   **Task 2.4:** Implement strict quote-locking logic to pause background polling immediately when the Phantom wallet prompt is triggered to prevent simulation failures.

## Agent 3: Global State Management (The Brain)
**Goal:** Build the Zustand stores and handle session-isolated state.
*   **Task 3.1:** Build the `useAppStore` to handle the Manager/Invest mode toggle, utilizing `sessionStorage` for strict tab isolation.
*   **Task 3.2:** Build the `useTransactionStore` to track "Pending", "Success", and "Failed" local transaction states.
*   **Task 3.3:** Build a `useConfigStore` that initializes on load by calling `GET /api/v1/config` (handling the `dustThreshold` and `focusAssetsWhitelist`).

## Agent 4: API & WebSocket Pipeline (The Nervous System)
**Goal:** Connect the UI to the Go backend for real-time indexing.
*   **Task 4.1:** Create a typed Axios/Fetch client for standard REST endpoints (`/vaults`, `/portfolio`).
*   **Task 4.2:** Implement the Gorilla WebSocket listener (`ws://.../v1/ws`).
*   **Task 4.3:** Map incoming WebSocket messages (`TRADE_EXECUTED`, `TX_CONFIRMED`) directly to Zustand store update functions to trigger reactive UI re-renders without HTTP polling.

## Agent 5: Shared Components & Virtualization (The Bricks)
**Goal:** Build the reusable, high-performance UI components.
*   **Task 5.1:** Implement `@tanstack/react-virtual` for a generic, highly performant `VirtualizedList` component to handle massive vault directories without React lag.
*   **Task 5.2:** Build a strict `TokenAmount` formatter component that references the centralized `dustThreshold` from Agent 3's store.
*   **Task 5.3:** Create generic Web3 components: `AddressPill` (truncates pubkeys), `SolscanLink`, and `CopyButton`.

## Agent 6: Manager Mode - Vault Lifecycle (The Creator)
**Goal:** Build the UI for initializing and managing vaults.
*   **Task 6.1:** Build the `/vaults/create` form using React Hook Form and Zod, taking `minRaiseAmount`, `performanceFee`, `managementFee`, and `lockupPeriod`.
*   **Task 6.2:** Wire the creation form to the Solana wallet adapter to trigger the Anchor `initialize_vault` instruction.
*   **Task 6.3:** Implement the `/vaults/:id/edit` backend metadata form, strictly enforcing the `focusAssets` dropdown against the API whitelist.
*   **Task 6.4:** Build the `/payout` dashboard to visualize accrued fees based on backend calculations.

## Agent 7: Manager Mode - Trading Engine (The Trader)
**Goal:** Implement the execution UI for the Pyth Oracle AMM.
*   **Task 7.1:** Build the `/trade` swap interface (Input token, Output token, Amount).
*   **Task 7.2:** Integrate real-time Pyth devnet price feeds into the UI to show the manager the expected execution rate before signing.
*   **Task 7.3:** Wire the "Execute Swap" button to the `execute_trade_pyth` Anchor instruction.
*   **Task 7.4:** Implement the `/trades/sync` fallback: immediately POST the transaction signature to the backend upon successful wallet signature.

## Agent 8: Investor Flow (The Depositor)
**Goal:** Build the consumer-facing investment and withdrawal mechanisms.
*   **Task 8.1:** Build the `/invest` directory, utilizing Agent 5's virtualized list to display active vaults.
*   **Task 8.2:** Build the Deposit Modal, triggering the Anchor `deposit` instruction and calculating expected Share Tokens.
*   **Task 8.3:** Build the Withdraw Modal, showing the in-kind underlying asset return based on the user's current share token balance.

## Agent 9: Real-Time Portfolio & PnL (The Dashboard)
**Goal:** Visualize user investments and vault performance.
*   **Task 9.1:** Build the `/portfolio` page, fetching the user's active positions from the Go backend.
*   **Task 9.2:** Create a real-time PnL component that listens to the Zustand store (updated by Agent 4's WebSockets) to tick the UI up or down instantly.
*   **Task 9.3:** Build the Trade History table for individual vault detail pages (`/vaults/:id`), ensuring it auto-invalidates and refetches when the WebSocket confirms a swap.

## Agent 10: UX Polish & Edge Cases (The Sweeper)
**Goal:** Ensure enterprise-grade reliability and feedback.
*   **Task 10.1:** Implement global Error Boundaries to catch and gracefully display React crashes.
*   **Task 10.2:** Refine the "Failed TX UX": Ensure the Zustand transaction store explicitly renders "Trade Failed" toasts with actionable Solscan trace links.
*   **Task 10.3:** Audit loading states (Skeletons) across all TanStack routes to prevent layout shift during data fetching.
*   **Task 10.4:** Final responsiveness audit using Tailwind classes for mobile/tablet optimization.