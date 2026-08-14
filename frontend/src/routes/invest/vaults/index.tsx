import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { SectionCard } from '@/components/ui/SectionCard'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableEmpty } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { VaultInvestCard } from '../_components/VaultInvestCard'
import { VaultInvestCardSkeleton } from '../_components/VaultInvestCardSkeleton'
import { VirtualizedList } from '@/components/ui/VirtualizedList'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { FOCUS_ASSETS } from '@/constants/vault'
import { generateMetadata } from '@/lib/metadata'
import { Search, Layers } from 'lucide-react'

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
  const { data: vaults = [], isLoading, error: vaultsError } = useVaultsQuery()

  const [search, setSearch] = useState('')
  const [focusFilter, setFocusFilter] = useState('All')

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
    return (vaults || []).filter((v) => {
      const displayName = v?.metadata?.displayName || ''
      const address = v?.address || ''
      const matchSearch =
        !search ||
        displayName.toLowerCase().includes(search.toLowerCase()) ||
        address.toLowerCase().includes(search.toLowerCase())
      const focusAssets = v?.metadata?.focusAssets || []
      const matchFocus =
        focusFilter === 'All' || focusAssets.includes(focusFilter)
      return matchSearch && matchFocus
    })
  }, [vaults, search, focusFilter])

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl text-text-primary">Vaults</h1>
        <p className="text-text-secondary text-sm">Browse and invest in Solana vaults.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-xs">
          <Label htmlFor="search-vaults" className="sr-only">Search vaults</Label>
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
          <Input
            id="search-vaults"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vaults..."
            className="pl-9 text-xs rounded-xl bg-bg-inset border-border-subtle focus:border-primary-coral focus:ring-0"
          />
        </div>

        <ToggleGroup
          options={focusOptions}
          value={focusFilter}
          onChange={setFocusFilter}
          size="sm"
        />
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
                description={vaultsError ? "Please try again later." : "Try adjusting your search keywords or focus asset filters"}
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
