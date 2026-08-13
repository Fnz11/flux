import { useState, useEffect, useRef, useMemo } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useInfiniteVaultsQuery } from '@/services/hooks'
import type { PaginatedVaults } from '@/services/apis/rest-api/vault.service'
import { VaultsTable, type SortColumn } from './_components/VaultsTable'
import { EmptyVaultsTable } from '@/components/ui/EmptyVaultsTable'
import { SweepButton } from '@/components/ui/SweepButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Layers, Search, X, Loader2 } from 'lucide-react'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
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
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()

  const currentStatus = search.status ?? 'All'
  const currentSearch = search.search ?? ''
  const sortBy = search.sortBy
  const sortOrder = search.sortOrder

  const [searchInput, setSearchInput] = useState(currentSearch)
  const loadMoreRef = useRef<HTMLDivElement>(null)

  // Sync local searchInput if URL search param changes externally
  useEffect(() => {
    setSearchInput(search.search ?? '')
  }, [search.search])

  // Debounce updating search param in URL
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== (search.search ?? '')) {
        navigate({
          search: (prev) => ({
            ...prev,
            search: searchInput.trim() ? searchInput.trim() : undefined,
          }),
          replace: true,
        })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, search.search, navigate])

  const {
    data: vaultsData,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteVaultsQuery({
    status: currentStatus,
    search: search.search,
    sortBy: sortBy,
    sortOrder: sortOrder,
  })

  const vaults: Vault[] = useMemo(() => {
    if (!vaultsData?.pages) return []
    return vaultsData.pages.flatMap((page: PaginatedVaults) => page.vaults)
  }, [vaultsData])

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    if (!fetchNextPage || !hasNextPage || isFetchingNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage()
        }
      },
      { threshold: 0.1, rootMargin: '100px' },
    )

    const el = loadMoreRef.current
    if (el) observer.observe(el)
    return () => {
      if (el) observer.unobserve(el)
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage])

  const handleStatusChange = (status: (typeof STATUS_TABS)[number]) => {
    navigate({
      search: (prev) => ({
        ...prev,
        status: status === 'All' ? undefined : status,
      }),
      replace: true,
    })
  }

  const handleSort = (column: SortColumn) => {
    let nextOrder: 'asc' | 'desc' = 'desc'
    if (sortBy === column) {
      nextOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    } else if (column === 'displayName' || column === 'created_at') {
      nextOrder = 'asc'
    }

    navigate({
      search: (prev) => ({
        ...prev,
        sortBy: column,
        sortOrder: nextOrder,
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
          <div className="w-full h-64 animate-pulse rounded-xl bg-bg-inset p-5" />
        ) : vaults.length === 0 ? (
          <EmptyVaultsTable
            title="No vaults found"
            description={
              searchInput
                ? `No vaults matching "${searchInput}"`
                : currentStatus === 'All'
                  ? 'Create your first Solana investment vault to get started'
                  : `No vaults found with status "${currentStatus}"`
            }
            headers={['VAULT', 'PNL', 'CREATED', 'MIN', 'INVESTORS', 'ASSET', 'PERFORMANCE', 'ACTION']}
          />
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
    </div>
  )
}
