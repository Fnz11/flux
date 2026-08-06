# Adjustment 3 Report: Missing States and Form Audits

## 1. Missing Error/Loading/Empty States

- **`src/routes/vaults/$id/_components/VaultTradesTab.tsx`** (Line 42-83)
  - **Issue**: Lacks a `loading` state when fetching trades from the REST API (`tradeService.getHistory(vaultId)`). Because `trades` is initialized as an empty array, it immediately displays the "No trades recorded yet" empty state (`<TableEmpty>`) while data is still being fetched.
  - **Action**: Introduce a loading state variable, update it during the data fetch, and render a loading skeleton before defaulting to the empty table.

- **`src/routes/trade/_components/SwapForm.tsx`**
  - **Issue 1**: The Vault `<Select>` component (Lines 103-114) lacks an empty state. If `vaults` is empty, the dropdown menu will simply be blank with no textual feedback to the user.
  - **Issue 2**: Lacks loading states for the vaults list (`useVaultsQuery`) and vault balances (`useVaultBalancesQuery`). The UI does not reflect that background network requests are occurring.
  - **Action**: Check for `isLoading` from `useVaultsQuery` to disable the vault selector or show a spinner. Include a fallback `<SelectItem disabled value="empty">No vaults available</SelectItem>` when the `vaults` array is empty.

- **`src/routes/invest/_components/DepositModal.tsx` & `WithdrawModal.tsx`**
  - **Issue**: No loading states are handled for `useVaultsQuery` or `usePortfolioQuery`. 
  - **Action**: Add UI feedback (e.g., skeletons or spinners) when vault metadata or portfolio positions are still being fetched.

- **`src/routes/payout.tsx`** (Lines 54-70)
  - **Issue**: The vault filter `<Select>` in the `PageHeader` action hides completely if `vaults.length === 0`. While this acts as a hidden empty state, it is inconsistent with UI expectations for form filters.
  - **Action**: Consider rendering the `<Select>` in a disabled state with a placeholder like "No vaults available" when `vaults` is empty instead of completely removing it.


## 2. Forms lacking RHF + Shadcn Form + Zod

- **`src/routes/vaults/create.tsx`** (Lines 46-116)
  - **Status**: Uses `react-hook-form` and `zod`, but the UI is built using the raw HTML `<form>`, `<Label>`, and `<Input>` tags.
  - **Action**: Refactor to use `shadcn/ui` Form wrappers (`<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>`).

- **`src/routes/vaults/$id/edit.tsx`** (Lines 94-156)
  - **Status**: Uses `react-hook-form` and `zod`, but the UI is built using the raw HTML `<form>`, `<Label>`, and `<Input>` tags.
  - **Action**: Refactor to use `shadcn/ui` Form wrappers (`<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>`).

- **`src/routes/trade/_components/SwapForm.tsx`**
  - **Status**: Form logic and inputs are controlled entirely using raw `useState` (`vaultId`, `inputAmount`, `slippage`). It completely lacks `react-hook-form`, `zod` validation schemas, and `shadcn/ui` Form wrappers.
  - **Action**: Define a Zod schema for input amounts and slippage, wrap the entire form using `useForm` (RHF), and replace the raw inputs with `shadcn/ui` Form components.

- **`src/routes/settings/_components/TradePreferences.tsx`** (Lines 31-68)
  - **Status**: Uses `useState` for controlled inputs (`slippageBps`, `dustThreshold`), completely lacking `react-hook-form`, `zod`, and `shadcn/ui` Form wrappers.
  - **Action**: Implement RHF and Zod for validation of numeric inputs, and wrap the fields in `<Form>`, `<FormField>`, `<FormItem>`, etc.

- **`src/routes/invest/_components/DepositModal.tsx`** (Lines 49-57)
  - **Status**: The amount input is a controlled input via the `useState` hook (`useDepositModal`). Lacks RHF, Zod, and Shadcn Form wrappers.
  - **Action**: Update the component logic to use RHF and Zod for deposit amount validation, and apply Shadcn Form components.

- **`src/routes/invest/_components/WithdrawModal.tsx`** (Lines 69-77)
  - **Status**: The share amount input is a controlled input via `useState`. Lacks RHF, Zod, and Shadcn Form wrappers.
  - **Action**: Update the component logic to use RHF and Zod for withdrawal amount validation against `max`, and apply Shadcn Form components.
