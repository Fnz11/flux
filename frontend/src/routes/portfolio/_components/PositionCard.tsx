import { Link } from '@tanstack/react-router'
import type { PortfolioPosition } from '@/types'
import { AddressPill } from '@/components/ui/AddressPill'

interface PositionCardProps {
  position: PortfolioPosition & { shareOfPortfolio?: number }
}

export function PositionCard({ position }: PositionCardProps) {
  const pnlColor = position.pnl >= 0 ? 'text-status-success' : 'text-status-error'

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5 transition-colors hover:border-border-medium">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-text-primary">{position.vaultName}</h3>
            <AddressPill address={position.vaultAddress} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div>
          <p className="text-xs text-text-muted">Invested</p>
          <p className="text-sm font-semibold text-text-primary">${position.totalInvested.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">Value</p>
          <p className="text-sm font-semibold text-text-primary">${position.currentValue.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">PnL</p>
          <p className={`text-sm font-semibold ${pnlColor}`}>
            ${position.pnl.toLocaleString()} ({position.pnlPercent.toFixed(2)}%)
          </p>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <span>Share of vault</span>
          <span>{position.shareOfPortfolio?.toFixed(1) ?? 0}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg-inset">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-coral to-primary-gold"
            style={{ width: `${Math.min(position.shareOfPortfolio ?? 0, 100)}%` }}
          />
        </div>
      </div>

      <Link
        to="/invest/vaults/$id"
        params={{ id: position.vaultId }}
        className="mt-4 block rounded-lg border border-border-medium px-3 py-2 text-center text-xs font-medium text-text-tertiary transition-colors hover:border-primary-coral hover:text-primary-coral"
      >
        View Details →
      </Link>
    </div>
  )
}
