import { useMemo, useState, useEffect } from 'react'
import { Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { VaultsTable, type SortColumn } from '@/routes/vaults/_components/VaultsTable'
import { VaultTableHeader } from '@/routes/vaults/_components/VaultTableHeader'
import { VaultCard } from '@/routes/vaults/_components/VaultCard'
import { Table, TableBody, TableEmpty, Pagination } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { WalletPrompt } from '@/components/ui/WalletPrompt'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Layers, Search, X, LayoutList, LayoutGrid } from 'lucide-react'
import { STATUS_TABS, type StatusTab } from '@/constants/vault'
import { cn } from '@/lib/utils'
import type { Vault } from '@/types'

export interface VaultsExplorerProps {
  title?: string
  description?: string
  managerOnly?: boolean
  showCreateButton?: boolean
  defaultViewMode?: 'table' | 'cards'
  requireWallet?: boolean
  initialStatus?: StatusTab
  className?: string
  // Optional controlled props for route synchronization
  status?: StatusTab
  onStatusChange?: (status: StatusTab) => void
  search?: string
  onSearchChange?: (search: string) => void
  sortBy?: SortColumn
  sortOrder?: 'asc' | 'desc'
  onSortChange?: (column: SortColumn) => void
}

export function VaultsExplorer({
  title = 'Solana Vaults',
  description = 'Browse, filter, and discover non-custodial Solana investment vaults',
  managerOnly = false,
  showCreateButton = false,
  defaultViewMode = 'table',
  requireWallet = false,
  initialStatus = 'All',
  className,
  status: controlledStatus,
  onStatusChange,
  search: controlledSearch,
  onSearchChange,
  sortBy: controlledSortBy,
  sortOrder: controlledSortOrder,
  onSortChange,
}: VaultsExplorerProps) {
  let walletAddress = ''
  try {
    const wallet = useWallet()
    walletAddress = wallet?.publicKey?.toBase58() ?? ''
  } catch {
    walletAddress = ''
  }

  const [internalStatus, setInternalStatus] = useState<StatusTab>(initialStatus)
  const [internalSearch, setInternalSearch] = useState('')
  const [viewMode, setViewMode] = useState<'table' | 'cards'>(defaultViewMode)
  const [internalSortBy, setInternalSortBy] = useState<SortColumn>('tvl')
  const [internalSortOrder, setInternalSortOrder] = useState<'asc' | 'desc'>('desc')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const activeStatus = controlledStatus !== undefined ? controlledStatus : internalStatus
  const activeSearch = controlledSearch !== undefined ? controlledSearch : internalSearch
  const activeSortBy = controlledSortBy !== undefined ? controlledSortBy : internalSortBy
  const activeSortOrder = controlledSortOrder !== undefined ? controlledSortOrder : internalSortOrder

  const handleStatusSelect = (tab: StatusTab) => {
    setPage(1)
    if (onStatusChange) {
      onStatusChange(tab)
    } else {
      setInternalStatus(tab)
    }
  }

  const handleSearchInput = (val: string) => {
    setPage(1)
    if (onSearchChange) {
      onSearchChange(val)
    } else {
      setInternalSearch(val)
    }
  }

  const handleSort = (column: SortColumn) => {
    setPage(1)
    if (onSortChange) {
      onSortChange(column)
    } else {
      if (internalSortBy === column) {
        setInternalSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      } else {
        setInternalSortBy(column)
        setInternalSortOrder('desc')
      }
    }
  }

  const queryStatusParam = activeStatus === 'All' ? undefined : activeStatus

  // Always use standard useVaultsQuery for reliability & clean mock compatibility
  const { data: rawVaultsData, isLoading } = useVaultsQuery(
    {
      status: queryStatusParam,
      search: activeSearch || undefined,
      sortBy: activeSortBy,
      sortOrder: activeSortOrder,
      managerAddress: managerOnly ? (walletAddress || undefined) : undefined,
    },
    {
      enabled: requireWallet ? Boolean(walletAddress) : true,
    }
  )

  // Normalize vaults list
  const allVaults: Vault[] = useMemo(() => {
    let list: Vault[] = Array.isArray(rawVaultsData) ? rawVaultsData : []

    if (managerOnly && walletAddress) {
      list = list.filter(
        (v) => v.managerAddress && v.managerAddress.toLowerCase() === walletAddress.toLowerCase()
      )
    }

    // Client-side search filtering fallback
    if (activeSearch.trim()) {
      const q = activeSearch.toLowerCase()
      list = list.filter((v) => {
        const name = (v.metadata?.displayName || '').toLowerCase()
        const addr = (v.address || '').toLowerCase()
        return name.includes(q) || addr.includes(q)
      })
    }

    return list
  }, [rawVaultsData, managerOnly, walletAddress, activeSearch])

  const totalPages = Math.max(1, Math.ceil(allVaults.length / pageSize))
  const pagedVaults = useMemo(() => {
    return allVaults.slice((page - 1) * pageSize, page * pageSize)
  }, [allVaults, page, pageSize])

  // Reset page when filter changes
  useEffect(() => {
    setPage(1)
  }, [activeStatus, activeSearch, activeSortBy, activeSortOrder])

  if (requireWallet && !walletAddress) {
    return <WalletPrompt description="Please connect your manager wallet to view and manage your vaults." />
  }

  return (
    <SectionCard
      icon={<Layers className="size-4 text-primary-coral" />}
      title={title}
      description={description}
      className={className}
      rightContent={
        <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
          {/* Search Input */}
          <div className="relative flex items-center min-w-[180px] sm:w-60">
            <Search className="absolute left-3 size-3.5 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              aria-label="Search vaults"
              value={activeSearch}
              onChange={(e) => handleSearchInput(e.target.value)}
              placeholder="Search vaults..."
              className="w-full h-8 pl-8 pr-7 text-xs rounded-xl bg-bg-inset border border-border-medium text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary-coral/50 transition-colors font-mono"
            />
            {activeSearch && (
              <button
                type="button"
                onClick={() => handleSearchInput('')}
                className="absolute right-2.5 size-3.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Status Tabs */}
          <SegmentedControl
            options={STATUS_TABS}
            value={activeStatus}
            onChange={(tab) => handleStatusSelect(tab as StatusTab)}
            className="bg-bg-inset border-0 shrink-0"
          />

          {/* View Mode Switcher */}
          <div className="flex items-center rounded-xl bg-bg-inset p-1 border border-border-subtle shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Table view"
              className={cn(
                'rounded-lg p-1 text-xs transition-colors cursor-pointer',
                viewMode === 'table'
                  ? 'bg-bg-elevated text-primary-coral shadow-xs'
                  : 'text-text-tertiary hover:text-text-primary',
              )}
            >
              <LayoutList className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              aria-label="Cards view"
              className={cn(
                'rounded-lg p-1 text-xs transition-colors cursor-pointer',
                viewMode === 'cards'
                  ? 'bg-bg-elevated text-primary-coral shadow-xs'
                  : 'text-text-tertiary hover:text-text-primary',
              )}
            >
              <LayoutGrid className="size-3.5" />
            </button>
          </div>

          {showCreateButton && (
            <Link to="/vaults/create" className="shrink-0">
              <SweepButton className="h-8 text-xs whitespace-nowrap">Create Vault</SweepButton>
            </Link>
          )}
        </div>
      }
    >
      {isLoading ? (
        viewMode === 'table' ? (
          <Table className="min-w-[720px]" containerClassName="min-h-[480px]">
            <VaultTableHeader sortBy={activeSortBy} sortOrder={activeSortOrder} onSort={handleSort} />
            <TableBody>
              <TableRowSkeleton
                columns={8}
                rows={7}
                cellAligns={['left', 'left', 'left', 'left', 'left', 'left', 'left', 'right']}
                cellWidths={['w-36', 'w-16', 'w-24', 'w-16', 'w-12', 'w-16', 'w-20', 'w-16']}
              />
            </TableBody>
          </Table>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 min-h-[400px]">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-56 rounded-2xl border border-white/10 bg-bg-elevated/20 animate-pulse p-5" />
            ))}
          </div>
        )
      ) : allVaults.length === 0 ? (
        <Table className="min-w-[720px]" containerClassName="min-h-[400px]">
          <VaultTableHeader sortBy={activeSortBy} sortOrder={activeSortOrder} onSort={handleSort} />
          <TableBody>
            <TableEmpty
              colSpan={8}
              title="No vaults found"
              description={
                activeSearch
                  ? `No vaults matching "${activeSearch}"`
                  : activeStatus === 'All'
                    ? (managerOnly ? 'Create your first Solana investment vault to get started' : 'No Solana investment vaults found')
                    : `No vaults found with status "${activeStatus}"`
              }
              minHeight="min-h-[360px]"
            />
          </TableBody>
        </Table>
      ) : viewMode === 'table' ? (
        <VaultsTable
          vaults={pagedVaults}
          sortBy={activeSortBy}
          sortOrder={activeSortOrder}
          onSort={handleSort}
          page={page}
          totalPages={totalPages}
          totalItems={allVaults.length}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize)
            setPage(1)
          }}
          isLoading={isLoading}
        />
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {pagedVaults.map((vault) => (
              <VaultCard key={vault.id} vault={vault} />
            ))}
          </div>

          {totalPages > 0 && (
            <div className="pt-4 border-t border-border-subtle/50">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={allVaults.length}
                pageSize={pageSize}
                pageSizeOptions={[5, 10, 20, 50]}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize)
                  setPage(1)
                }}
                itemLabel="vaults"
                isLoading={isLoading}
              />
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
