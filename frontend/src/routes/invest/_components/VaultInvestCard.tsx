import { Link } from '@tanstack/react-router'
import type { Vault } from '@/types'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AddressPill } from '@/components/ui/AddressPill'

interface VaultInvestCardProps {
  vault: Vault
}

export function VaultInvestCard({ vault }: VaultInvestCardProps) {
  return (
    <div className="group rounded-2xl border border-white/12 bg-bg-elevated/3 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] p-5 transition-all hover:border-white/20 hover:shadow-[0_16px_48px_rgba(0,0,0,0.7)] flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-bold tracking-tight text-text-primary">
              {vault.metadata.displayName || vault.address.slice(0, 8) + '...'}
            </h3>
            <div className="mt-1.5">
              <AddressPill address={vault.address} />
            </div>
          </div>
          <StatusBadge status={vault.status} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle/50 pt-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">AUM</p>
            <p className="font-mono text-sm font-bold text-text-primary mt-0.5">${(vault.tvl ?? 0).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">APR</p>
            <p className="font-mono text-sm font-bold text-status-success mt-0.5">—</p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 pt-1">
        <Link
          to="/invest/vaults/$id"
          params={{ id: vault.id }}
          className="flex-1 rounded-xl bg-primary-coral px-4 py-2 text-center text-xs font-semibold text-white transition-all duration-150 hover:bg-primary-coral/90 shadow-md"
        >
          Deposit
        </Link>
        <Link
          to="/invest/vaults/$id"
          params={{ id: vault.id }}
          className="flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-center text-xs font-semibold text-text-primary transition-all duration-150 hover:bg-white/[0.08] hover:border-white/20"
        >
          Withdraw
        </Link>
      </div>
    </div>
  )
}

export { VaultInvestCardSkeleton } from './VaultInvestCardSkeleton'
