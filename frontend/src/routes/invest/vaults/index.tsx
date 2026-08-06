import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableEmpty } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { VaultInvestCard, VaultInvestCardSkeleton } from '../_components/VaultInvestCard'
import { VirtualizedList } from '@/components/ui/VirtualizedList'

export const Route = createFileRoute('/invest/vaults/')({ component: VaultInvestListPage })

const FOCUS_ASSETS = ['All', 'SOL', 'USDC', 'BTC', 'ETH']

function VaultInvestListPage() {
  const { data: vaults = [], isLoading, error: vaultsError } = useVaultsQuery()

  const [search, setSearch] = useState('')
  const [focusFilter, setFocusFilter] = useState('All')

  const filtered = useMemo(() => {
    return vaults.filter((v) => {
      const matchSearch =
        !search ||
        v.metadata.displayName.toLowerCase().includes(search.toLowerCase()) ||
        v.address.toLowerCase().includes(search.toLowerCase())
      const matchFocus =
        focusFilter === 'All' || v.metadata.focusAssets?.includes(focusFilter)
      return matchSearch && matchFocus
    })
  }, [vaults, search, focusFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Vaults</h1>
        <p className="mt-2 text-text-secondary">Browse and invest in Solana vaults.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Label htmlFor="search-vaults" className="sr-only">Search vaults</Label>
        <Input
          id="search-vaults"
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search vaults..."
          className="sm:w-72"
        />

        <ToggleGroup
          options={FOCUS_ASSETS.map((a) => ({ label: a, value: a }))}
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
      ) : (
        <VirtualizedList
          items={filtered}
          pageSize={9}
          keyExtractor={(v) => v.id}
          renderItem={(vault) => <VaultInvestCard vault={vault} />}
        />
      )}
    </div>
  )
}
