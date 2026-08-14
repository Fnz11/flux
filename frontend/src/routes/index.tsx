import { useEffect } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAppStore, usePortfolioStore } from '@/stores'
import { useVaultsQuery, usePortfolioQuery } from '@/services/hooks'
import { PortfolioSummary } from './portfolio/_components/PortfolioSummary'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/card'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { ManagerVaultsList } from './_components/ManagerVaultsList'
import { InvestorVaultsList } from './_components/InvestorVaultsList'
import { Shield, Layers, Coins, Sparkles, PlusCircle } from 'lucide-react'
import { SweepButton } from '@/components/ui/SweepButton'
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
  useRouteWsChannel(['dashboard', 'global:activity', 'global:leaderboard'])

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

  // Real aggregate calculations from domain model
  const totalTVL = vaults.reduce((sum, v) => sum + (v.tvl || 0), 0)
  const activeVaultCount = vaults.filter((v) => v.status === 'Active').length
  const managerVaultCount = walletAddress
    ? vaults.filter((v) => v.managerAddress.toLowerCase() === walletAddress.toLowerCase()).length
    : 0

  return (
    <div className="space-y-6">
      <PageHeader
        title={!walletAddress ? 'Welcome to Flux' : isManager ? 'Manager Dashboard' : 'Dashboard'}
        subtitle={
          !walletAddress
            ? 'Connect your Solana wallet to manage vaults and track investments.'
            : isManager
              ? 'Hey Manager, Welcome back!'
              : 'Hey Investor, Welcome back!'
        }
      />

      {!walletAddress ? (
        <div className="space-y-6">
          {/* Platform KPI Aggregates */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            <Card className="relative flex flex-col justify-between overflow-hidden p-5 border-border-subtle bg-bg-elevated">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-primary-gold" />
                  <span>Total Value Locked</span>
                </div>
                <span className="text-[10px] text-text-muted">Ecosystem</span>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold tracking-tight text-text-primary">
                  {vaultsLoading ? '...' : `$${totalTVL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
                <p className="mt-1 text-xs text-text-tertiary">Across all active Solana vaults</p>
              </div>
            </Card>

            <Card className="relative flex flex-col justify-between overflow-hidden p-5 border-border-subtle bg-bg-elevated">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary-coral" />
                  <span>Active Vaults</span>
                </div>
                <span className="text-[10px] text-text-muted">Live</span>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold tracking-tight text-text-primary">
                  {vaultsLoading ? '...' : `${activeVaultCount} / ${vaults.length}`}
                </div>
                <p className="mt-1 text-xs text-text-tertiary">Non-custodial strategies available</p>
              </div>
            </Card>

            <Card className="relative flex flex-col justify-between overflow-hidden p-5 border-border-subtle bg-bg-elevated">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-400" />
                  <span>Pyth Oracle AMM</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-bold">Online</span>
              </div>
              <div className="mt-4">
                <div className="text-3xl font-bold tracking-tight text-text-primary">
                  Sub-second
                </div>
                <p className="mt-1 text-xs text-text-tertiary">Live Devnet low-slippage trade execution</p>
              </div>
            </Card>
          </div>

          <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-border-subtle bg-bg-elevated/70 text-center p-6">
            <div className="mb-3 rounded-full bg-bg-inset p-3">
              <Shield className="size-7 text-primary-coral" />
            </div>
            <h3 className="text-base font-semibold text-text-primary">Connect your wallet to get started</h3>
            <p className="mt-1 max-w-sm text-xs text-text-secondary">
              Deposit into high-performing vaults or launch your own fund on Solana.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Link to="/vaults">
                <SweepButton className="h-8 text-xs">Explore Vaults</SweepButton>
              </Link>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Platform / Manager KPI cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 items-stretch">
            <Card className="relative flex flex-col justify-between overflow-hidden p-5 border-border-subtle">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <div className="flex items-center gap-2">
                  <Coins className="size-4 text-primary-gold" />
                  <span>{isManager ? 'Managed TVL' : 'Total Platform TVL'}</span>
                </div>
                <span className="text-[10px] text-text-muted">Live</span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-bold tracking-tight text-text-primary">
                  {vaultsLoading ? '...' : `$${totalTVL.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </div>
                <p className="mt-1 text-xs text-text-tertiary">
                  {isManager ? `${managerVaultCount} vault(s) under management` : 'Across all Solana vaults'}
                </p>
              </div>
            </Card>

            <Card className="relative flex flex-col justify-between overflow-hidden p-5 border-border-subtle">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <div className="flex items-center gap-2">
                  <Layers className="size-4 text-primary-coral" />
                  <span>{isManager ? 'Your Vaults' : 'Available Vaults'}</span>
                </div>
                {isManager && (
                  <Link to="/vaults/create">
                    <button type="button" className="inline-flex items-center gap-1 text-[11px] font-bold text-primary-coral hover:underline cursor-pointer">
                      <PlusCircle className="size-3" /> New
                    </button>
                  </Link>
                )}
              </div>
              <div className="mt-3">
                <div className="text-3xl font-bold tracking-tight text-text-primary">
                  {vaultsLoading ? '...' : isManager ? managerVaultCount : activeVaultCount}
                </div>
                <p className="mt-1 text-xs text-text-tertiary">
                  {isManager ? 'Vaults under your authority' : 'Active vaults ready for deposits'}
                </p>
              </div>
            </Card>

            <Card className="relative flex flex-col justify-between overflow-hidden p-5 border-border-subtle">
              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-emerald-400" />
                  <span>Ecosystem Status</span>
                </div>
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Operational
                </span>
              </div>
              <div className="mt-3">
                <div className="text-3xl font-bold tracking-tight text-text-primary">
                  Pyth Devnet
                </div>
                <p className="mt-1 text-xs text-text-tertiary">Low-latency oracle updates enabled</p>
              </div>
            </Card>
          </div>

          {/* Mode-Aware Vault List */}
          {isManager ? (
            <ManagerVaultsList walletAddress={walletAddress} />
          ) : (
            <InvestorVaultsList walletAddress={walletAddress} />
          )}

          {/* Portfolio Aggregates in Investor Mode */}
          {!isManager && wallet.publicKey && (
            <div className="space-y-4 pt-2">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-text-primary">Your Investment Portfolio</h2>
                <Link to="/portfolio" className="text-xs text-primary-coral hover:underline font-semibold">
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
