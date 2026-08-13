import { Link } from '@tanstack/react-router'
import type { Vault } from '@/types'
import { Badge } from '@/components/ui/badge'

interface VaultInvestCardProps {
  vault: Vault
}

export function VaultInvestCard({ vault }: VaultInvestCardProps) {
  const badgeVariant = {
    Fundraising: 'warning',
    Active: 'success',
    Dormant: 'secondary',
  }[vault.status] as 'warning' | 'success' | 'secondary'

  return (
    <div className="group rounded-xl border border-border-subtle bg-bg-elevated p-6 transition-colors hover:border-border-medium hover:bg-bg-elevated/80">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-text-primary">
            {vault.metadata.displayName || vault.address.slice(0, 8) + '...'}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted font-mono">
            {vault.address.slice(0, 4)}...{vault.address.slice(-4)}
          </p>
        </div>
        <Badge variant={badgeVariant} className="shrink-0">
          {vault.status}
        </Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-text-muted">AUM</p>
          <p className="text-sm font-semibold text-text-primary">${(vault.tvl ?? 0).toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-text-muted">APR</p>
          <p className="text-sm font-semibold text-status-success">—</p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link
          to="/invest/vaults/$id"
          params={{ id: vault.id }}
          className="flex-1 rounded-xl bg-primary-coral px-4 py-2 text-center text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Deposit
        </Link>
        <Link
          to="/invest/vaults/$id"
          params={{ id: vault.id }}
          className="flex-1 rounded-xl border border-border-medium px-4 py-2 text-center text-sm font-medium text-text-primary transition-colors hover:bg-bg-inset"
        >
          Withdraw
        </Link>
      </div>
    </div>
  )
}

export { VaultInvestCardSkeleton } from './VaultInvestCardSkeleton'
