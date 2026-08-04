import { createFileRoute, Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultStore } from '@/stores'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { StatCard } from '@/components/ui/stat-card'
import { VaultInvestCard, VaultInvestCardSkeleton } from './_components/VaultInvestCard'

export const Route = createFileRoute('/invest/')({ component: InvestPage })

function InvestPage() {
  const wallet = useWallet()
  const vaults = useVaultStore((s) => s.vaults)
  const vaultsLoading = useVaultStore((s) => s.isLoading)
  const { totalInvested, totalValue, totalPnl } = usePortfolioPnl()

  const topVaults = vaults.slice(0, 6)
  const pnlAccent = totalPnl >= 0 ? 'green' : 'red'
  const pnlPrefix = totalPnl >= 0 ? '+' : ''

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Invest</h1>
          <p className="mt-2 text-text-secondary">Browse vaults and deposit funds.</p>
        </div>

        {!wallet.publicKey && (
          <div className="rounded-lg bg-bg-inset px-4 py-2 text-sm text-text-muted">
            Connect wallet to invest
          </div>
        )}
        {wallet.publicKey && (
          <div className="rounded-lg bg-bg-inset px-4 py-2 text-sm font-mono text-text-secondary">
            {wallet.publicKey.toBase58().slice(0, 4)}...{wallet.publicKey.toBase58().slice(-4)}
          </div>
        )}
      </div>

      {wallet.publicKey && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Invested" value={`$${totalInvested.toLocaleString()}`} accent="coral" />
          <StatCard title="Value" value={`$${totalValue.toLocaleString()}`} accent="gold" />
          <StatCard title="PnL" value={`${pnlPrefix}$${totalPnl.toLocaleString()}`} accent={pnlAccent} />
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">Top Vaults</h2>
          <Link
            to="/invest/vaults"
            className="text-sm font-medium text-primary-coral hover:underline"
          >
            View all →
          </Link>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vaultsLoading
            ? Array.from({ length: 6 }).map((_, i) => <VaultInvestCardSkeleton key={i} />)
            : topVaults.length > 0
              ? topVaults.map((vault) => <VaultInvestCard key={vault.id} vault={vault} />)
              : (
                <div className="col-span-full rounded-2xl border border-border-subtle bg-bg-elevated p-12 text-center">
                  <p className="text-text-tertiary">No vaults available for investment yet.</p>
                </div>
              )}
        </div>
      </div>

      {wallet.publicKey && (
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
          <h2 className="text-base font-semibold text-text-primary">Recent Activity</h2>
          <p className="mt-4 text-sm text-text-muted">No recent activity</p>
        </div>
      )}
    </div>
  )
}
