import { createFileRoute, Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { InvestSummary } from './_components/InvestSummary'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableEmpty } from '@/components/ui/table'
import { EmptyVaultsTable } from '@/components/ui/EmptyVaultsTable'
import { SectionCard } from '@/components/ui/SectionCard'
import { VaultInvestCard, VaultInvestCardSkeleton } from './_components/VaultInvestCard'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { PageHeader } from '@/components/ui/PageHeader'
import { Trophy, Activity } from 'lucide-react'
import { generateMetadata } from '@/lib/metadata'

export const Route = createFileRoute('/invest/')({
  head: () => ({
    meta: generateMetadata({
      title: 'Invest in Vaults',
      description: 'Explore top-performing non-custodial Solana vaults and start earning yield.',
      path: '/invest',
      keywords: ['Solana Investment', 'DeFi Vaults', 'Yield Farming', 'Crypto Staking'],
    }),
  }),
  component: InvestPage,
})

function InvestPage() {
  useRouteWsChannel(['vaults'])
  const wallet = useWallet()
  const { data: vaults = [], isLoading: vaultsLoading, error: vaultsError } = useVaultsQuery()

  const topVaults = vaults.slice(0, 6)

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Invest"
        subtitle="Browse vaults and deposit funds."
      />

      {/* Revamped 3-Card Summary Metric Header */}
      {wallet.publicKey && <InvestSummary />}

      {/* Top Vaults Section */}
      <SectionCard
        icon={<Trophy className="size-4 text-primary-coral" />}
        title="Top Vaults"
        description="Explore top-performing non-custodial Solana vaults and start earning yield."
        rightContent={
          <Link
            to="/invest/vaults"
            className="text-xs font-semibold text-primary-coral hover:underline"
          >
            View all →
          </Link>
        }
      >
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
      </SectionCard>

      {wallet.publicKey && (
        <SectionCard
          icon={<Activity className="size-4 text-primary-coral" />}
          title="Recent Activity"
          description="Log of deposits, withdrawals, and vault transactions on Solana"
        >
          <div className="rounded-xl border border-border-subtle/60 overflow-hidden">
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
        </SectionCard>
      )}
    </div>
  )
}
