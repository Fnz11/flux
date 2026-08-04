import { createFileRoute } from '@tanstack/react-router'
import { usePortfolioStore } from '@/stores'
import { usePortfolioView } from './_hooks/usePortfolioView'
import { Button } from '@/components/ui/button'
import { PortfolioSummary } from './_components/PortfolioSummary'
import { PositionCard } from './_components/PositionCard'
import { PnLTicker } from './_components/PnLTicker'
import { TradeHistory } from './_components/TradeHistory'
import { PerformanceChart } from './_components/PerformanceChart'
import { AllocationChart } from './_components/AllocationChart'
import { EmptyState } from '@/components/ui/EmptyState'

export const Route = createFileRoute('/portfolio/')({ component: PortfolioPage })

type SortKey = 'value' | 'pnl' | 'name'

function PortfolioPage() {
  const isLoading = usePortfolioStore((s) => s.isLoading)
  const { sortedPositions, sortBy, toggleSort, sortAsc, performanceData, allocationData } = usePortfolioView()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Portfolio</h1>
        <p className="mt-2 text-text-secondary">Track your investments and portfolio performance.</p>
      </div>

      <PortfolioSummary />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <PerformanceChart data={performanceData} isLoading={isLoading} />
        </div>
        <div>
          <AllocationChart data={allocationData} isLoading={isLoading} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-2xl border border-border-subtle bg-bg-elevated p-5">
                  <div className="h-4 w-32 rounded bg-bg-inset" />
                  <div className="mt-4 space-y-2">
                    <div className="h-3 w-20 rounded bg-bg-inset" />
                    <div className="h-3 w-20 rounded bg-bg-inset" />
                    <div className="h-3 w-20 rounded bg-bg-inset" />
                  </div>
                </div>
              ))}
            </div>
          ) : sortedPositions.length === 0 ? (
            <EmptyState
              title="No positions yet"
              description="Deposit into a vault to start building your portfolio."
            />
          ) : (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-text-primary">Positions</h2>
                <div className="flex gap-1 rounded-lg bg-bg-inset p-0.5">
                  {(['value', 'pnl', 'name'] as SortKey[]).map((key) => (
                    <Button
                      key={key}
                      variant={sortBy === key ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => toggleSort(key)}
                    >
                      {key === 'value' ? 'Value' : key === 'pnl' ? 'PnL' : 'Name'}
                      {sortBy === key && (sortAsc ? ' ↑' : ' ↓')}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                {sortedPositions.map((pos) => (
                  <PositionCard key={pos.vaultId} position={pos} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="space-y-4">
          <PnLTicker />
          <TradeHistory trades={[]} />
        </div>
      </div>
    </div>
  )
}
