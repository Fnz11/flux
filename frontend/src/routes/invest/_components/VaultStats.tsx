import type { Vault } from '@/types'

interface VaultStatsProps {
  vault: Vault
}

export function VaultStats({ vault }: VaultStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">AUM</p>
        <p className="mt-1.5 text-2xl font-semibold text-text-primary tracking-tight">
          ${(vault.tvl ?? 0).toLocaleString()}
        </p>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Perf. Fee</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary">
          {vault.performanceFeeBps > 0
            ? `${(vault.performanceFeeBps / 100).toFixed(1)}%`
            : '—'}
        </p>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Investors</p>
        <p className="mt-1.5 text-2xl font-semibold text-text-primary tracking-tight">—</p>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Lockup</p>
        <p className="mt-1.5 text-2xl font-semibold text-text-primary tracking-tight">None</p>
      </div>
    </div>
  )
}

export { VaultStatsSkeleton } from './VaultStatsSkeleton'
