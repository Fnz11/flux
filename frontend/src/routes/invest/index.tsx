import { createFileRoute, Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { StatCard } from '@/components/ui/stat-card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableEmpty } from '@/components/ui/table'
import { EmptyVaultsTable } from '@/components/ui/EmptyVaultsTable'
import { VaultInvestCard, VaultInvestCardSkeleton } from './_components/VaultInvestCard'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { PageHeader } from '@/components/ui/PageHeader'

export const Route = createFileRoute('/invest/')({ component: InvestPage })

function InvestPage() {
  useRouteWsChannel(['vaults'])
  const wallet = useWallet()
  const { data: vaults = [], isLoading: vaultsLoading, error: vaultsError } = useVaultsQuery()
  const { totalInvested, totalValue, totalPnl } = usePortfolioPnl(wallet.publicKey?.toBase58())

  const topVaults = vaults.slice(0, 6)
  const pnlAccent = totalPnl >= 0 ? 'green' : 'red'
  const pnlPrefix = totalPnl >= 0 ? '+' : ''

  return (
    <div className="space-y-8">
      <PageHeader 
        title="Invest"
        subtitle="Browse vaults and deposit funds."
        action={
          wallet.publicKey ? (
            <div className="rounded-lg bg-bg-inset px-4 py-2 text-sm font-mono text-text-secondary border border-border-subtle/50">
              {wallet.publicKey.toBase58().slice(0, 4)}...{wallet.publicKey.toBase58().slice(-4)}
            </div>
          ) : undefined
        }
      />

      {wallet.publicKey && (
        <div className="grid grid-cols-3 gap-4">
          <StatCard title="Invested" value={`$${totalInvested.toLocaleString()}`} accent="coral" />
          <StatCard title="Value" value={`$${totalValue.toLocaleString()}`} accent="gold" />
          <StatCard title="PnL" value={`${pnlPrefix}$${totalPnl.toLocaleString()}`} accent={pnlAccent} />
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-text-primary">Top Vaults</h2>
          <Link
            to="/invest/vaults"
            className="text-sm font-medium text-primary-coral hover:underline"
          >
            View all →
          </Link>
        </div>

        {vaultsLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <VaultInvestCardSkeleton key={i} />)}
          </div>
        ) : vaultsError || topVaults.length === 0 ? (
          <EmptyVaultsTable
            title={vaultsError ? "Error loading vaults" : "No vaults available for investment yet"}
            description={vaultsError ? "Please try again later." : "Vaults created by managers will appear here"}
            headers={['Vault', 'Focus Assets', 'TVL', 'Perf. Fee', 'Status']}
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topVaults.map((vault) => <VaultInvestCard key={vault.id} vault={vault} />)}
          </div>
        )}
      </div>

      {wallet.publicKey && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold text-text-primary">Recent Activity</h2>
          <div className="rounded-xl border border-border-subtle bg-bg-elevated/60 backdrop-blur-2xl p-0 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Vault</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableEmpty
                  colSpan={5}
                  title="No recent activity recorded"
                  description="Deposits, withdrawals, and vault transactions will be logged here"
                />
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
