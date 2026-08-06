import { createFileRoute } from '@tanstack/react-router'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'

export const Route = createFileRoute('/vaults/$id/')({ component: VaultDetailPage })

function VaultDetailPage() {
  const { id } = Route.useParams()
  useRouteWsChannel([id ? `vault:${id}` : null])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Vault {id}</h1>
        <p className="mt-2 text-text-secondary">View vault details, deposits, and performance.</p>
      </div>

      <div className="grid gap-6 sm:grid-cols-3">
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-6">
          <p className="text-sm text-text-tertiary">TVL</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">$0.00</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-6">
          <p className="text-sm text-text-tertiary">APY</p>
          <p className="mt-2 text-2xl font-semibold text-status-success">0.00%</p>
        </div>
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-6">
          <p className="text-sm text-text-tertiary">Depositors</p>
          <p className="mt-2 text-2xl font-semibold text-text-primary">0</p>
        </div>
      </div>
    </div>
  )
}
