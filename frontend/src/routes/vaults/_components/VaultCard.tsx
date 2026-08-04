import { Link } from '@tanstack/react-router'
import { AddressPill } from '@/components/ui/AddressPill'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TokenAmount } from '@/components/ui/TokenAmount'
import type { Vault } from '@/types'

interface VaultCardProps {
  vault: Vault
}

export function VaultCard({ vault }: VaultCardProps) {
  const totalFeesBps = vault.performanceFeeBps + vault.managementFeeBps

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5 transition-colors hover:border-border-medium">
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text-primary">
              {vault.metadata.displayName || `Vault ${vault.id.slice(0, 8)}`}
            </h3>
            <StatusBadge status={vault.status} />
          </div>
          <AddressPill address={vault.address} />
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-text-tertiary">AUM</p>
          <TokenAmount amount={vault.tvl} symbol="USD" compact />
        </div>
        <div>
          <p className="text-xs text-text-tertiary">Perf Fee</p>
          <p className="font-mono text-sm text-text-primary">{vault.performanceFeeBps} BPS</p>
        </div>
        <div>
          <p className="text-xs text-text-tertiary">Total Fees</p>
          <p className="font-mono text-sm text-text-primary">{totalFeesBps} BPS</p>
        </div>
      </div>

      <div className="mt-4 flex gap-2">
        <Link
          to="/vaults/$id/edit"
          params={{ id: vault.id }}
          className="rounded-lg border border-border-medium px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-inset"
        >
          Edit
        </Link>
        <Link
          to="/trade"
          search={{ vaultId: vault.id }}
          className="rounded-lg border border-border-medium px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-inset"
        >
          Trade
        </Link>
        <Link
          to="/vaults/$id"
          params={{ id: vault.id }}
          className="ml-auto rounded-lg bg-primary-coral px-3 py-1.5 text-xs font-medium text-black transition-colors hover:bg-primary-coral/90"
        >
          View
        </Link>
      </div>
    </div>
  )
}
