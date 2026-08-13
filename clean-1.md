# Comprehensive Frontend Refactoring Plan

This document outlines a complete plan to clean up the frontend codebase. Based on a deep scan across the entire `frontend/src` directory, we have identified extensive technical debt falling into four key areas: inline schemas/constants, duplicated UI components (inline tabs), violations of the "One File, One Responsibility" rule, and custom UI elements that must be replaced with standardized `shadcn/ui` components.

## 1. Extract Schemas and Constants

Many `z.object` validations, configuration arrays, and domain constants are defined inline within components or route files, severely limiting reuse and bloating the logic.

**Action**: Move these to dedicated domain files inside `frontend/src/validations/` and `frontend/src/constants/`.

### Validations (`validations/`)
*   **Invest Domain** (`validations/invest.ts`):
    *   `depositSchema` (from `invest/_components/DepositModal.tsx`)
    *   `withdrawSchema` (from `invest/_components/WithdrawModal.tsx`)
*   **Trade/Settings Domain** (`validations/trade.ts`):
    *   `tradePreferencesSchema` (from `settings/_components/TradePreferences.tsx`)
    *   `tradeSearchSchema` (from `routes/trade.tsx`)
    *   `swapSchema` (from `trade/_components/SwapForm.tsx`)
*   **Vaults Domain** (`validations/vault.ts`):
    *   `editVaultSchema` (from `vaults/$id/edit.tsx`)
    *   `createVaultSchema` (from `vaults/create.tsx`)
    *   `vaultsSearchSchema` (from `vaults/index.tsx`)

### Constants (`constants/`)
*   **Vaults/Assets** (`constants/vault.ts`):
    *   `FOCUS_ASSETS` (from `invest/vaults/index.tsx`)
    *   `STATUS_TABS` (from `vaults/index.tsx`)
    *   `['weekly', 'monthly', 'quarterly', 'yearly'] as const` (from `vaults/create.tsx`)
    *   `['SOL', 'USDC', 'USDT'] as const` (from `vaults/create.tsx`)
*   **Charts/UI** (`constants/ui.ts`):
    *   `DEFAULT_COLORS` (from `portfolio/_components/AllocationChartInner.tsx`)
*   **Navigation** (`constants/navigation.ts`):
    *   Extract the inline navigation object arrays from `components/MobileNav.tsx` and `components/Sidebar.tsx`.

## 2. Reusable Tabs / Segmented Control Components

There are numerous locations where `Array.map` is used inline to generate segmented controls, tabs, or button groups with custom active/inactive styling. 

**Action**: Implement a standard `Tabs` or `ToggleGroup` component (via `shadcn`) and refactor the following:

*   **Trading & Settings:**
    *   Slippage selectors: `[0.1, 0.5, 1.0, 2.0].map(...)` in `trade/_components/SwapForm.tsx`.
    *   BPS preferences: `['10', '50', '100'].map(...)` in `settings/_components/TradePreferences.tsx`.
    *   Token selectors: `TOKENS.map(...)` in `invest/_components/DepositModal.tsx`.
*   **Data Views & Portfolios:**
    *   Timeframes: `TIMEFRAMES.map(...)` in `portfolio/_components/PerformanceChart.tsx`.
    *   Sort keys: `['value', 'pnl', 'name'].map(...)` in `portfolio/index.tsx`.
    *   Vault statuses: `STATUS_TABS.map(...)` in `vaults/index.tsx`.
*   **Forms:**
    *   Vault creation steps and selections in `vaults/create.tsx`.

## 3. Enforce "One File, One Responsibility"

A massive portion of the codebase defines multiple sub-components inside a single file. This is an anti-pattern that makes files like `SwapForm.tsx` and `create.tsx` enormous and unmaintainable.

**Action**: Split multi-component files into individual files within their respective `_components/` directories.

### Major Violators to Split Immediately:
*   **`trade/_components/SwapForm.tsx`**: Extract `VaultSelectField`, `PayInputField`, `SwapDirectionToggle`, `ReceiveSection`, `SlippageField`, `SwapActionButton`, and `RouteDetails`.
*   **`vaults/create.tsx`**: Extract `VaultTypeCard`, `VaultTypeSection`, `VaultIdentitySection`, `BasicConfigSection`, `AdvancedSettingsSection`, `AgreementSection`, and `CreateVaultSubmit`.

### Standard Components to Split:
*   **Routes & Layouts**:
    *   `routes/__root.tsx`: Extract `RootBootstrap` and `RootDocument`.
    *   `routes/_components/InvestorVaultsList.tsx`: Extract `InvestmentRow`.
    *   `routes/_components/ManagerVaultsList.tsx`: Extract `ManagedVaultRow`.
*   **Portfolio & Charts**:
    *   `portfolio/_components/AllocationChartInner.tsx` & `PerformanceChartInner.tsx`: Extract `CustomTooltip`.
    *   `portfolio/_components/PerformanceChart.tsx`: Extract `ChangeBadge` and `ChangeText`.
*   **Trade**:
    *   `trade/_components/ConfirmationDialog.tsx`: Extract `Row`.
    *   `trade/_components/TokenSelector.tsx`: Extract `TokenIcon`.
*   **Vaults**:
    *   `vaults/$id/_components/VaultOverview.tsx`: Extract `MetricCard`.
    *   `vaults/_components/VaultsTable.tsx`: Extract `VaultRow` and `VaultHeader`.
*   **UI Primitives** (`components/ui/`):
    *   `SweepButton.tsx`: Extract `DotMatrix`.
    *   `dialog.tsx`: Ensure `DialogHeader` etc., follow shadcn patterns or are exported properly.

## 4. Adopt Standardized `shadcn` Components

Custom implementations of standard UI elements lead to inconsistent design and harder maintenance. We must strip out custom markup in favor of `shadcn/ui`.

**Action**: Audit and replace custom-built elements with their `shadcn` equivalents.

### Avatars & User Initials
Currently, avatars are built using markup like `<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br...">`.
*   **Targets**: `components/Sidebar.tsx`, `portfolio/_components/LeaderboardWidget.tsx`, `vaults/_components/VaultsTable.tsx`, `vaults/create.tsx`, and `EmptyState.tsx`.
*   **Fix**: Use `shadcn`'s `<Avatar>`, `<AvatarImage>`, and `<AvatarFallback>`.

### Badges & Status Pills
Currently, statuses are built with `<span className="inline-flex items-center gap-1 rounded-full bg-status-success/10... px-2.5 py-0.5">`.
*   **Targets**: 
    *   `components/ui/AddressPill.tsx`
    *   `invest/_components/InvestSummary.tsx`
    *   `invest/_components/VaultInvestCard.tsx`
    *   `payout/_components/PayoutSummary.tsx`
    *   `settings/_components/WalletStatus.tsx`
    *   `vaults/$id/_components/VaultOverview.tsx`
*   **Fix**: Replace all instances with the `shadcn` `<Badge>` component. If a specific variant (like `success` or `warning`) is missing, we must add those variants to the `badge.tsx` recipe rather than writing inline classes.

### Skeletons
Currently, loading states use custom markup like `<div className="size-6 shrink-0 animate-pulse rounded-full bg-bg-inset" />`.
*   **Targets**: `LeaderboardWidget.tsx`, `VaultInvestCard.tsx`, and various chart loaders.
*   **Fix**: Use the `shadcn` `<Skeleton>` component.

### Alerts / Notification Badges
*   **Targets**: `NotificationsPopover.tsx` and `MobileNav.tsx` use absolute positioned dots for alerts (e.g., `<span className="absolute -top-1 -right-1 flex size-4... rounded-full">`).
*   **Fix**: Centralize this pattern into an explicit `NotificationBadge` or `Indicator` component built on top of `shadcn` primitives rather than scattering absolute positioning everywhere.
