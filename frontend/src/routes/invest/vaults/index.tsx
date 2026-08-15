import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableEmpty } from '@/components/ui/table'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { VaultInvestCard } from '../_components/VaultInvestCard'
import { VaultInvestCardSkeleton } from '../_components/VaultInvestCardSkeleton'
import { VirtualizedList } from '@/components/ui/VirtualizedList'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { FOCUS_ASSETS, STATUS_TABS, type StatusTab } from '@/constants/vault'
import { generateMetadata } from '@/lib/metadata'
import { Search, Layers, X, ArrowUpDown } from 'lucide-react'

export const Route = createFileRoute('/invest/vaults/')({
  head: () => ({
    meta: generateMetadata({
      title: 'Browse Vaults',
      description: 'Filter and discover non-custodial Solana vaults by asset focus, TVL, and performance fee.',
      path: '/invest/vaults',
    }),
  }),
  component: VaultInvestListPage,
})

export function VaultInvestListPage() {
  const [statusFilter, setStatusFilter] = useState<StatusTab>('All')
  const [search, setSearch] = useState('')
  const [focusFilter, setFocusFilter] = useState('All')
  const [sortBy, setSortBy] = useState<'tvl' | 'created_at' | 'displayName' | 'min_raise_amount'>('tvl')
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')

  const { data: vaults = [], isLoading, error: vaultsError } = useVaultsQuery({
    status: statusFilter === 'All' ? undefined : statusFilter,
    sortBy,
    sortOrder,
  })

  const focusOptions = useMemo(
    () =>
      FOCUS_ASSETS.map((a) => ({
        label: a,
        value: a,
        icon: a !== 'All' ? <TokenIcon symbol={a} className="size-3.5" /> : undefined,
      })),
    [],
  )

  const filtered = useMemo(() => {
    return (vaults || [])
      .filter((v) => {
        const matchStatus =
          statusFilter === 'All' ||
          (v.status && v.status.toLowerCase() === statusFilter.toLowerCase())
        const displayName = v?.metadata?.displayName || ''
        const address = v?.address || ''
        const matchSearch =
          !search ||
          displayName.toLowerCase().includes(search.toLowerCase()) ||
          address.toLowerCase().includes(search.toLowerCase())
        const focusAssets = v?.metadata?.focusAssets || []
        const matchFocus =
          focusFilter === 'All' || focusAssets.includes(focusFilter)
        return matchStatus && matchSearch && matchFocus
      })
      .sort((a, b) => {
        let valA: string | number = 0
        let valB: string | number = 0

        if (sortBy === 'tvl') {
          valA = a.tvl ?? 0
          valB = b.tvl ?? 0
        } else if (sortBy === 'created_at') {
          valA = new Date(a.createdAt || 0).getTime()
          valB = new Date(b.createdAt || 0).getTime()
        } else if (sortBy === 'min_raise_amount') {
          valA = a.minRaiseAmount ?? 0
          valB = b.minRaiseAmount ?? 0
        } else if (sortBy === 'displayName') {
          const nameA = (a.metadata?.displayName || a.address).toLowerCase()
          const nameB = (b.metadata?.displayName || b.address).toLowerCase()
          return sortOrder === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA)
        }

        if (sortOrder === 'asc') {
          return (valA as number) - (valB as number)
        }
        return (valB as number) - (valA as number)
      })
  }, [vaults, statusFilter, search, focusFilter, sortBy, sortOrder])

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vaults"
        subtitle="Browse and invest in Solana vaults."
      />

      {/* Filter and Control Bar */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Status Tabs */}
          <SegmentedControl
            options={STATUS_TABS}
            value={statusFilter}
            onChange={(tab) => setStatusFilter(tab as StatusTab)}
            className="bg-bg-inset border-0 shrink-0"
          />

          {/* Sort Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <ArrowUpDown className="size-3.5" />
              <span className="hidden sm:inline">Sort:</span>
            </div>
            <Select value={sortBy} onValueChange={(val) => setSortBy(val as typeof sortBy)}>
              <SelectTrigger aria-label="Sort by field" className="h-8 w-32 rounded-xl border border-border-subtle bg-bg-inset px-2.5 text-xs font-medium text-text-primary hover:border-primary-coral/40 cursor-pointer">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="tvl">AUM / TVL</SelectItem>
                <SelectItem value="created_at">Date Created</SelectItem>
                <SelectItem value="displayName">Vault Name</SelectItem>
                <SelectItem value="min_raise_amount">Min Raise</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortOrder} onValueChange={(val) => setSortOrder(val as 'asc' | 'desc')}>
              <SelectTrigger aria-label="Sort order direction" className="h-8 w-24 rounded-xl border border-border-subtle bg-bg-inset px-2.5 text-xs font-medium text-text-primary hover:border-primary-coral/40 cursor-pointer">
                <SelectValue placeholder="Order" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="desc">Desc (High-Low)</SelectItem>
                <SelectItem value="asc">Asc (Low-High)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-text-tertiary pointer-events-none" />
            <input
              type="text"
              aria-label="Search vaults"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vaults..."
              className="w-full h-8 pl-8 pr-7 text-xs rounded-xl bg-bg-inset border border-border-medium text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-primary-coral/50 transition-colors font-mono"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-text-tertiary hover:text-text-primary transition-colors cursor-pointer"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>

          {/* Focus Assets Filter */}
          <ToggleGroup
            options={focusOptions}
            value={focusFilter}
            onChange={setFocusFilter}
            size="sm"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <VaultInvestCardSkeleton key={i} />)}
        </div>
      ) : filtered.length === 0 ? (
        <SectionCard
          icon={<Layers className="size-4 text-primary-coral" />}
          title="Vault Explorer"
          description="Explore available investment vaults."
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vault Name</TableHead>
                <TableHead>Focus Assets</TableHead>
                <TableHead className="text-right">TVL</TableHead>
                <TableHead className="text-right">Perf. Fee</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableEmpty
                colSpan={5}
                title={vaultsError ? "Error loading vaults" : "No matching vaults found"}
                description={vaultsError ? "Please try again later." : "Try adjusting your search keywords, status, or focus asset filters"}
              />
            </TableBody>
          </Table>
        </SectionCard>
      ) : (
        <VirtualizedList
          items={filtered}
          pageSize={9}
          keyExtractor={(v, i) => v.id || v.address || String(i)}
          renderItem={(vault) => <VaultInvestCard vault={vault} />}
        />
      )}
    </div>
  )
}
