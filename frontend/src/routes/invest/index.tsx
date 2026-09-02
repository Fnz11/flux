import { useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { InvestSummary } from './_components/InvestSummary'
import { EmptyVaultsTable } from '@/components/ui/EmptyVaultsTable'
import { SectionCard } from '@/components/ui/SectionCard'
import { VaultInvestCard } from './_components/VaultInvestCard'
import { VaultInvestCardSkeleton } from './_components/VaultInvestCardSkeleton'
import { useVisibleVaultsWs } from '@/hooks/useVisibleVaultsWs'
import { usePortfolioWs } from '@/hooks/usePortfolioWs'
import { useActivityWs } from '@/hooks/useActivityWs'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { vaultHandler } from '@/services/ws/handlers/vaultHandler'
import { portfolioHandler } from '@/services/ws/handlers/portfolioHandler'
import { portfolioSummaryHandler } from '@/services/ws/handlers/portfolioSummaryHandler'
import { PageHeader } from '@/components/ui/PageHeader'
import { Trophy, Activity } from 'lucide-react'
import { generateMetadata } from '@/lib/metadata'
import { RecentActivity } from './_components/RecentActivity'

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
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58()

  const { data: vaults = [], isLoading: vaultsLoading, error: vaultsError } = useVaultsQuery({
    sortBy: 'tvl',
    sortOrder: 'desc',
    limit: 6,
  })

  const topVaults = useMemo(
    () => vaults.filter((v) => v.status === 'Active' || v.status === 'Fundraising'),
    [vaults]
  )

  // Senior pattern: Batch subscribe to visible vaults + portfolio + activity in 1 frame
  useVisibleVaultsWs(topVaults, walletAddress)
  usePortfolioWs(walletAddress)
  useActivityWs(walletAddress)

  // Modular Realtime Query Sync: Mounts handlers relevant to this page
  useRealtimeSync({
    handlers: [vaultHandler, portfolioHandler, portfolioSummaryHandler],
    walletAddress,
  })

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
          <RecentActivity wallet={wallet.publicKey.toBase58()} />
        </SectionCard>
      )}
    </div>
  )
}
