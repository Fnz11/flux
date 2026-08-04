import { useState, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useVaultStore } from '@/stores'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ToggleGroup } from '@/components/ui/toggle-group'
import { VaultInvestCard, VaultInvestCardSkeleton } from '../_components/VaultInvestCard'

export const Route = createFileRoute('/invest/vaults/')({ component: VaultInvestListPage })

const FOCUS_ASSETS = ['All', 'SOL', 'USDC', 'BTC', 'ETH']

function VaultInvestListPage() {
  const vaults = useVaultStore((s) => s.vaults)
  const isLoading = useVaultStore((s) => s.isLoading)

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
          {Array.from({ length: 6 }).map((_, i) => (
            <VaultInvestCardSkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No vaults found"
          description={search ? 'Try a different search term.' : 'No vaults available for investment yet.'}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((vault) => (
            <VaultInvestCard key={vault.id} vault={vault} />
          ))}
        </div>
      )}
    </div>
  )
}
