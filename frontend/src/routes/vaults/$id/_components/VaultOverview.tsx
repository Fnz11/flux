import { Link } from '@tanstack/react-router'
import { AddressPill } from '@/components/ui/AddressPill'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TokenAmount } from '@/components/ui/TokenAmount'
import type { Vault } from '@/types'

interface VaultOverviewProps {
  vault: Vault
}

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

export function VaultOverview({ vault }: VaultOverviewProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-text-primary">
                {vault.metadata.displayName || `Vault ${vault.id.slice(0, 8)}`}
              </h2>
              <StatusBadge status={vault.status} />
            </div>
            <AddressPill address={vault.address} />
          </div>
          <Link
            to="/vaults/$id/edit"
            params={{ id: vault.id }}
            className="rounded-lg border border-border-medium px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-bg-inset"
          >
            Edit
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="AUM" value={<TokenAmount amount={vault.tvl} symbol="USD" compact />} />
        <MetricCard label="Performance Fee" value={`${bpsToPercent(vault.performanceFeeBps)} (${vault.performanceFeeBps} BPS)`} />
        <MetricCard label="Management Fee" value={`${bpsToPercent(vault.managementFeeBps)} (${vault.managementFeeBps} BPS)`} />
        <MetricCard label="Lockup Period" value="N/A" />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
        <h3 className="mb-4 text-sm font-medium text-text-secondary">Focus Assets</h3>
        {vault.metadata.focusAssets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {vault.metadata.focusAssets.map((asset) => (
              <span
                key={asset}
                className="rounded-full bg-bg-inset px-3 py-1 font-mono text-xs text-text-primary"
              >
                {asset}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No focus assets configured.</p>
        )}
      </div>

      {vault.metadata.description && (
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
          <h3 className="mb-2 text-sm font-medium text-text-secondary">Description</h3>
          <p className="text-sm text-text-primary">{vault.metadata.description}</p>
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <p className="text-xs text-text-tertiary">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  )
}
