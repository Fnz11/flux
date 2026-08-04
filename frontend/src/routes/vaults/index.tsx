import { createFileRoute, Link } from '@tanstack/react-router'

export const Route = createFileRoute('/vaults/')({ component: VaultsListPage })

function VaultsListPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Vaults</h1>
          <p className="mt-2 text-text-secondary">Create and manage Solana investment vaults.</p>
        </div>
        <Link
          to="/vaults/create"
          className="rounded-lg bg-primary-coral px-4 py-2 text-sm font-medium text-black transition-opacity hover:opacity-90"
        >
          Create Vault
        </Link>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-12 text-center">
        <p className="text-text-tertiary">No vaults yet. Create your first vault to get started.</p>
      </div>
    </div>
  )
}
