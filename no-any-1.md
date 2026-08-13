# Plan: Remove `any` Types from Frontend Codebase

This plan outlines the steps required to remove `any` types across the frontend codebase, ensuring better type safety and catching potential runtime errors during development.

## 1. Domain Mappers (`frontend/src/lib/mappers.ts`)
Currently, the mappers accept `raw: any` to handle the snake_case data returned from the backend. 
- Create interfaces for the raw API responses (e.g., `RawApiVault`, `RawApiPortfolioPosition`, `RawApiConfig`, `RawApiTrade`).
- Replace `raw: any` with these typed interfaces.
- Replace `(p: any)` inside the sparkline map with a properly typed object interface like `{ date: string, value: number } | number`.

## 2. API Utility (`frontend/src/lib/api.ts`)
- Change the `params` argument in the `get` function from `Record<string, any>` to a safer type like `Record<string, string | number | boolean | null | undefined>`.

## 3. Solana Anchor Hooks (`useDeposit.ts`, `useWithdraw.ts`, `useExecuteTrade.ts`)
- Replace `wallet as any` and `program.idl as any` with proper `@solana/wallet-adapter-react` and `@coral-xyz/anchor` types.
- Ensure `signTransaction` and `signAllTransactions` cast the wallet to an interface containing the required signing functions if `WalletContextState` doesn't natively expose them in the exact way Anchor expects, using `unknown` or a specific interface instead of `any`.

## 4. Anchor Provider Initialization (`frontend/src/lib/anchor.ts`)
- Define a proper `AnchorWallet` interface instead of using `any` for `signTransaction` and `signAllTransactions` (using `@solana/web3.js` types like `Transaction` and `VersionedTransaction`).
- Avoid passing `wallet as any` to `AnchorProvider`.

## 5. Web3 Transactions Library (`frontend/src/lib/transactions.ts`)
- Replace `catch (err: any)` with `catch (err: unknown)` and properly type-check the error before accessing its properties (e.g., `if (err instanceof Error)`).
- Replace `signer: { publicKey?: any; signTransaction: ... }` with proper `@solana/web3.js` `PublicKey` types.

## 6. Components (`MobileNav.tsx`, `PageHeader.tsx`, `WalletConnectButton.tsx`, `SearchAutocomplete.tsx`)
- In `WalletConnectButton.tsx`, type `walletName` in `handleSelectWallet(walletName: any)` to `WalletName` from `@solana/wallet-adapter-base` or `string`.
- Remove `navigate({ to: path as any })` in navigation components and replace it with proper TanStack Router route types or a type-safe wrapper.
- Properly type the `item` argument in `SearchAutocomplete`'s `onSelect(item as any, results.kind)`.

## 7. Mocks and Tests (`frontend/src/mocks/handlers.ts`, `frontend/e2e/fixtures.ts`)
- Avoid `(body as any)` when parsing JSON from mock requests. Define a mock request body interface instead.
- In E2E fixtures, avoid extending the window object using `(window as any)`. Instead, augment the global `Window` interface in a `d.ts` file to include `__mockSockets`, `__mockWsMessage`, and `__mockWallet`.
- Replace `mockWallet: any` with a proper mock object type matching the injected wallet standard interface.

## 8. Polyfills (`frontend/src/lib/buffer-polyfill.ts`)
- Augment the global `Window` and `typeof globalThis` interfaces to include `Buffer` instead of using `(window as any).Buffer`.

## Note on Generated Files
Files like `routeTree.gen.ts` contain `any` by default as part of the TanStack router generator. These will be left as-is, as modifying generated code directly is discouraged and will be overwritten.
