import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { cn } from '@/lib/utils'

export function PortfolioSummary() {
  const { totalInvested, totalValue, totalPnl, totalPnlPercent } = usePortfolioPnl()

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="rounded-xl border border-border-subtle bg-bg-elevated/60 backdrop-blur-2xl p-5 border-l-[3px] border-l-primary-coral">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Invested</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary font-mono">
          ${totalInvested.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
      </div>
      <div className="rounded-xl border border-border-subtle bg-bg-elevated/60 backdrop-blur-2xl p-5 border-l-[3px] border-l-primary-gold">
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Value</p>
        <p className="mt-2 text-3xl font-semibold text-text-primary font-mono">
          ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
      </div>
      <div className={cn("rounded-xl border border-border-subtle bg-bg-elevated/60 backdrop-blur-2xl p-5 border-l-[3px]", totalPnl >= 0 ? "border-l-status-success" : "border-l-status-error")}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">PNL</p>
        <p className={cn('mt-2 text-3xl font-semibold font-mono', totalPnl >= 0 ? 'text-status-success' : 'text-status-error')}>
          {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
        </p>
      </div>
      <div className={cn("rounded-xl border border-border-subtle bg-bg-elevated/60 backdrop-blur-2xl p-5 border-l-[3px]", totalPnlPercent >= 0 ? "border-l-status-success" : "border-l-status-error")}>
        <p className="text-[10px] font-bold uppercase tracking-widest text-text-tertiary">Return</p>
        <p className={cn('mt-2 text-3xl font-semibold font-mono', totalPnlPercent >= 0 ? 'text-status-success' : 'text-status-error')}>
          {totalPnlPercent >= 0 ? '+' : ''}{totalPnlPercent.toFixed(2)}%
        </p>
      </div>
    </div>
  )
}
