import { Link } from '@tanstack/react-router'
import type { Vault } from '@/types'

interface VaultInvestCardProps {
  vault: Vault
}

export function VaultInvestCard({ vault }: VaultInvestCardProps) {
  const statusColor = {
    Fundraising: 'text-status-warn',
    Active: 'text-status-success',
    Dormant: 'text-text-muted',
  }[vault.status]

  return (
    <div className="group rounded-2xl border border-border-subtle bg-bg-elevated p-6 transition-colors hover:border-border-medium hover:bg-bg-elevated/80">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold text-text-primary">
            {vault.metadata.displayName || vault.address.slice(0, 8) + '...'}
          </h3>
          <p className="mt-0.5 text-xs text-text-muted font-mono">
            {vault.address.slice(0, 4)}...{vault.address.slice(-4)}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor} bg-bg-inset`}>
          {vault.status}
        </span>
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
          className="flex-1 rounded-lg bg-primary-coral px-4 py-2 text-center text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Deposit
        </Link>
        <Link
          to="/invest/vaults/$id"
          params={{ id: vault.id }}
          className="flex-1 rounded-lg border border-border-medium px-4 py-2 text-center text-sm font-medium text-text-primary transition-colors hover:bg-bg-inset"
        >
          Withdraw
        </Link>
      </div>
    </div>
  )
}

export function VaultInvestCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-border-subtle bg-bg-elevated p-6">
      <div className="flex items-start justify-between">
        <div className="h-5 w-36 rounded bg-bg-inset" />
        <div className="h-5 w-20 rounded-full bg-bg-inset" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="h-4 w-20 rounded bg-bg-inset" />
        <div className="h-4 w-20 rounded bg-bg-inset" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-10 flex-1 rounded-lg bg-bg-inset" />
        <div className="h-10 flex-1 rounded-lg bg-bg-inset" />
      </div>
    </div>
  )
}
