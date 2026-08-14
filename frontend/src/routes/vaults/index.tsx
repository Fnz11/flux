import { useMemo } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useInfiniteVaultsQuery } from '@/services/hooks'
import type { PaginatedVaults } from '@/services/apis/rest-api/vault.service'
import { VaultsTable, type SortColumn } from './_components/VaultsTable'
import { VaultTableHeader } from './_components/VaultTableHeader'
import { Table, TableBody, TableEmpty } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { SweepButton } from '@/components/ui/SweepButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { WalletPrompt } from '@/components/ui/WalletPrompt'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Layers, Search, X, Loader2 } from 'lucide-react'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { useDebouncedSearch } from '@/hooks/useDebouncedSearch'
import { useTableSort } from '@/hooks/useTableSort'
import { useInfiniteScroll } from '@/hooks/useInfiniteScroll'
import { generateMetadata } from '@/lib/metadata'
import { vaultsSearchSchema } from '@/validations/vault'
import { STATUS_TABS, type StatusTab } from '@/constants/vault'
import type { Vault } from '@/types'

export const Route = createFileRoute('/vaults/')({
  validateSearch: (search) => vaultsSearchSchema.parse(search),
  head: () => ({
    meta: generateMetadata({
      title: 'Vault Management',
      description: 'Manage non-custodial Solana vaults, view performance metrics, and track investor TVL.',
      path: '/vaults',
    }),
  }),
  component: VaultsListPage,
})

function VaultsListPage() {
  useRouteWsChannel(['vaults'])
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()

  const currentStatus = search.status ?? 'All'

  const { searchInput, setSearchInput } = useDebouncedSearch({
    value: search.search ?? '',
    onChange: (val) => {
      navigate({
        search: (prev) => ({ ...prev, search: val }),
        replace: true,
      })
    },
  })

  const { sortBy, sortOrder, handleSort } = useTableSort<SortColumn>({
    sortBy: search.sortBy,
    sortOrder: search.sortOrder,
    onSortChange: (nextSortBy, nextSortOrder) => {
      navigate({
        search: (prev) => ({
          ...prev,
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
        }),
        replace: true,
      })
    },
  })

  const {
    data: vaultsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteVaultsQuery(
    {
      status: currentStatus,
      search: search.search,
      sortBy: sortBy,
      sortOrder: sortOrder,
      managerAddress: walletAddress || undefined,
    },
    20
  )

  const { loadMoreRef } = useInfiniteScroll({
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  })

  const vaults: Vault[] = useMemo(() => {
    if (!vaultsData?.pages || !walletAddress) return []
    const flat = vaultsData.pages.flatMap((page: PaginatedVaults) => page.vaults)
    return flat.filter(
      (v) => v.managerAddress && v.managerAddress.toLowerCase() === walletAddress.toLowerCase()
    )
  }, [vaultsData, walletAddress])

  const handleStatusChange = (status: (typeof STATUS_TABS)[number]) => {
    navigate({
      search: (prev) => ({
        ...prev,
        status: status === 'All' ? undefined : status,
      }),
      replace: true,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vaults"
        subtitle="Create and manage Solana investment vaults."
      />

      {!walletAddress ? (
        <WalletPrompt description="Please connect your manager wallet to view and manage your vaults." />
      ) : (
        <SectionCard
          icon={<Layers className="size-4 text-primary-coral" />}
          title="Solana Vaults"
          description="Browse, filter, and manage non-custodial Solana investment vaults"
        rightContent={
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative flex items-center min-w-[200px] sm:w-64">
              <Search className="absolute left-3 size-3.5 text-text-tertiary pointer-events-none" />
              <input
                type="text"
                aria-label="Search vaults"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search vaults..."
                className="w-full h-8 pl-8 pr-7 text-xs rounded-xl bg-bg-inset border border-border-medium text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary-coral/50 transition-colors font-mono"
              />
              {searchInput && (
                <button
                  type="button"
                  onClick={() => setSearchInput('')}
                  className="absolute right-2.5 size-3.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <SegmentedControl
              options={STATUS_TABS}
              value={currentStatus as StatusTab}
              onChange={(tab) => handleStatusChange(tab as StatusTab)}
              className="bg-bg-inset border-0 shrink-0"
            />

            <Link to="/vaults/create" className="shrink-0">
              <SweepButton className="h-8 text-xs whitespace-nowrap">Create Vault</SweepButton>
            </Link>
          </div>
        }
      >
        {isLoading ? (
          <Table className="min-w-[720px]" containerClassName="min-h-[480px]">
            <VaultTableHeader sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
            <TableBody>
              <TableRowSkeleton
                columns={8}
                rows={7}
                cellAligns={['left', 'left', 'left', 'left', 'left', 'left', 'left', 'right']}
                cellWidths={['w-36', 'w-16', 'w-24', 'w-16', 'w-12', 'w-16', 'w-20', 'w-16']}
              />
            </TableBody>
          </Table>
        ) : vaults.length === 0 ? (
          <Table className="min-w-[720px]" containerClassName="min-h-[480px]">
            <VaultTableHeader sortBy={sortBy} sortOrder={sortOrder} onSort={handleSort} />
            <TableBody>
              <TableEmpty
                colSpan={8}
                title="No vaults found"
                description={
                  searchInput
                    ? `No vaults matching "${searchInput}"`
                    : currentStatus === 'All'
                      ? 'Create your first Solana investment vault to get started'
                      : `No vaults found with status "${currentStatus}"`
                }
                minHeight="min-h-[400px]"
              />
            </TableBody>
          </Table>
        ) : (
          <div className="space-y-4">
            <VaultsTable
              vaults={vaults}
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            />

            {/* Infinite scroll sentinel and status */}
            <div ref={loadMoreRef} className="py-2 flex items-center justify-center">
              {isFetchingNextPage && (
                <div className="flex items-center gap-2 text-xs text-text-tertiary font-mono">
                  <Loader2 className="size-3.5 animate-spin text-primary-coral" />
                  Loading more vaults...
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>
      )}
    </div>
  )
}
