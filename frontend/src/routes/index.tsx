import { useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useQuery } from '@tanstack/react-query'
import { useAppStore, usePortfolioStore } from '@/stores'
import { useVaultsQuery, usePortfolioQuery } from '@/services/hooks'
import { PortfolioSummary } from './portfolio/_components/PortfolioSummary'
import { ProgressMetricCard } from '@/components/ui/progress-metric-card'
import { SweepButton } from '@/components/ui/SweepButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { getMetrics } from '@/services/apis/rest-api/metrics.service'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { ManagerVaultsList } from './_components/ManagerVaultsList'
import { InvestorVaultsList } from './_components/InvestorVaultsList'

import { generateMetadata } from '@/lib/metadata'

export const Route = createFileRoute('/')({
  head: () => ({
    meta: generateMetadata({
      title: 'Dashboard',
      description: 'Overview of your Solana vault portfolio, active investments, and performance metrics.',
      path: '/',
    }),
  }),
  component: DashboardPage,
})

function DashboardPage() {
  useRouteWsChannel(['dashboard'])

  const isManager = useAppStore((s) => s.isManager)
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  const { data: vaults = [], isLoading: vaultsLoading } = useVaultsQuery()
  const { data: portfolioPositions } = usePortfolioQuery(walletAddress)

  useEffect(() => {
    if (portfolioPositions) {
      usePortfolioStore.setState({ positions: portfolioPositions })
    }
  }, [portfolioPositions])

  const { data: metricsData = { tvl: [], invested: [], fees: [] }, isLoading: metricsLoading } = useQuery({
    queryKey: ['metrics', 'dashboard'],
    queryFn: async () => {
      const [tvl, invested, fees] = await Promise.all([
        getMetrics('tvl'),
        getMetrics('invested'),
        getMetrics('fees'),
      ])
      return { tvl, invested, fees }
    },
  })

  // Real aggregate calculations from domain model
  const totalTVL = vaults.reduce((sum, v) => sum + (v.tvl || 0), 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title={!walletAddress ? 'Welcome to Flux' : isManager ? 'Manager Dashboard' : 'Dashboard'}
        subtitle={!walletAddress ? 'Connect your wallet to get started.' : isManager ? 'Hey Manager, Welcome back!' : 'Hey Investor, Welcome back!'}
      />

      {!walletAddress ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-xl border border-border-subtle bg-bg-elevated text-center">
          <div className="mb-4 rounded-full bg-bg-inset p-3">
            <svg className="size-8 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-text-primary">Connect your wallet</h3>
          <p className="text-sm text-text-secondary">Please connect your wallet to view your dashboard.</p>
        </div>
      ) : (
        <>
          {/* Platform Aggregates */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
        <ProgressMetricCard
          title="Total Value Locked"
          total={
            vaultsLoading
              ? '...'
              : `$${totalTVL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
          deltaLabel="across all vaults"
          accent="amber"
          data={metricsData.tvl}
          loading={vaultsLoading || metricsLoading}
          size="sm"
        />
        <ProgressMetricCard
          title="Total Invested"
          total={vaultsLoading ? '...' : undefined}
          deltaLabel="historical inflow"
          accent="gold"
          data={metricsData.invested}
          loading={vaultsLoading || metricsLoading}
          size="sm"
        />
        <ProgressMetricCard
          title="Platform Fees"
          total={vaultsLoading ? '...' : undefined}
          deltaLabel="accrued fees"
          accent="emerald"
          data={metricsData.fees}
          loading={vaultsLoading || metricsLoading}
          size="sm"
        />
      </div>

      {/* Mode-Aware Vault Lists */}
      {isManager ? (
        <ManagerVaultsList walletAddress={walletAddress} />
      ) : (
        <InvestorVaultsList walletAddress={walletAddress} />
      )}

      {/* Portfolio Aggregates if Wallet Connected (Investor Mode) */}
      {!isManager && wallet.publicKey && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-text-primary">Connected Portfolio Summary</h2>
            <Link to="/portfolio" className="text-[13px] text-primary-coral hover:underline font-medium">
              View full portfolio →
            </Link>
          </div>
          <PortfolioSummary />
        </div>
      )}
        </>
      )}
    </div>
  )
}
