# Skeleton UI Improvement Plan

## Objective
Replace generic, "big block" container-level skeletons with highly detailed, granular skeleton components that match the structure of the content they are loading. This will create a smoother, more perceived-performance-friendly loading experience.

## Components to Create

### 1. Table Skeleton (`TableSkeleton.tsx`)
Instead of a single block for the whole table, the table skeleton should structurally resemble an actual table:
- Container with table borders/shadows.
- `TableHeader` UI visible, containing `TableHead` items.
- `TableRow` elements, each containing multiple `TableCell` elements.
- Within each cell, a `Skeleton` of appropriate width/height to mimic text or badges.
- Configurable number of rows and columns (e.g., `<TableSkeleton rows={5} columns={4} />`).

### 2. Card Skeleton (`CardSkeleton.tsx` / `VaultCardSkeleton.tsx`)
- Container mimicking the card dimensions and border.
- Circular or small square `Skeleton` for icons/avatars.
- Varying width `Skeleton` bars for titles and subtitles.
- Separate `Skeleton` blocks for stats or chart areas.

### 3. Widget/Stats Skeleton (`StatsSkeleton.tsx`)
- Instead of masking the entire stats block, mask the individual value and label within the stats container.

## Implementation Steps

### Phase 1: Creating Skeleton Primitives
- [ ] Create `TableSkeleton` component in `frontend/src/components/ui/` (or update existing ones).
- [ ] Update `VaultInvestCardSkeleton.tsx` and `VaultStatsSkeleton.tsx` to be more granular.
- [ ] Create `ListSkeleton` for simple lists.

### Phase 2: Updating Pages & Components
Search for `isLoading`, `isPending`, or `<Skeleton>` usage and replace container blocks with granular ones in:
- `frontend/src/routes/invest/vaults/index.tsx` (Replace block with `TableSkeleton` or grid of `VaultCardSkeleton`).
- `frontend/src/routes/invest/vaults/$id/index.tsx` (Detailed layout skeleton).
- `frontend/src/routes/invest/_components/VaultStats.tsx`
- `frontend/src/routes/portfolio/_components/TradeHistory.tsx` (Use `TableSkeleton`)
- `frontend/src/routes/payout/_components/FeeHistory.tsx` (Use `TableSkeleton`)
- `frontend/src/routes/vaults/_components/VaultsTable.tsx`
- `frontend/src/routes/_components/InvestorVaultsList.tsx`
- `frontend/src/routes/_components/ManagerVaultsList.tsx`

### Phase 3: Review and Refine
- Ensure skeletons share the same layout properties (padding, margins, grid/flex) as the real components to prevent layout shift when the data finishes loading.
- Test loading states across all pages.
