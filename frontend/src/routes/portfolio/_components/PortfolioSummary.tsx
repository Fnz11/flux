import { usePortfolioStore } from '@/stores'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { StatCard } from '@/components/ui/stat-card'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'

export function PortfolioSummary() {
  const isLoading = usePortfolioStore((s) => s.isLoading)
  const { totalInvested, totalValue, totalPnl, totalPnlPercent } = usePortfolioPnl()

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
            <LoadingSkeleton className="h-3 w-16" />
            <div className="mt-3">
              <LoadingSkeleton className="h-8 w-28" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard title="Total Value" value={`$${totalValue.toLocaleString()}`} />
      <StatCard title="Total Invested" value={`$${totalInvested.toLocaleString()}`} />
      <StatCard title="PnL" value={`$${totalPnl.toLocaleString()}`} change={{ value: totalPnl, isPositive: totalPnl >= 0 }} />
      <StatCard title="PnL %" value={`${totalPnlPercent.toFixed(2)}%`} change={{ value: totalPnlPercent, isPositive: totalPnlPercent >= 0 }} />
    </div>
  )
}
