import type { Vault } from '@/types'

interface VaultStatsProps {
  vault: Vault
}

export function VaultStats({ vault }: VaultStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">AUM</p>
        <p className="mt-1.5 text-2xl font-semibold text-text-primary tracking-tight">
          ${(vault.tvl ?? 0).toLocaleString()}
        </p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">APR</p>
        <p className="mt-1.5 text-2xl font-semibold tracking-tight text-status-success">
          +12.4%
        </p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Investors</p>
        <p className="mt-1.5 text-2xl font-semibold text-text-primary tracking-tight">—</p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Lockup</p>
        <p className="mt-1.5 text-2xl font-semibold text-text-primary tracking-tight">None</p>
      </div>
    </div>
  )
}

export function VaultStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-2xl border border-border-subtle bg-bg-elevated p-5">
          <div className="h-3 w-12 rounded bg-bg-inset" />
          <div className="mt-3 h-8 w-24 rounded bg-bg-inset" />
        </div>
      ))}
    </div>
  )
}
