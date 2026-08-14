import { useState, useMemo } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultDetailQuery, usePortfolioQuery } from '@/services/hooks'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { generateMetadata } from '@/lib/metadata'
import { AddressPill } from '@/components/ui/AddressPill'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { SweepButton } from '@/components/ui/SweepButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { TableSkeleton } from '@/components/ui/TableSkeleton'
import { HeroAmbient } from '@/components/ui/HeroAmbient'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { DepositModal } from '@/routes/invest/_components/DepositModal'
import { WithdrawModal } from '@/routes/invest/_components/WithdrawModal'
import { VaultOverview } from './_components/VaultOverview'
import { VaultPerformanceSection } from './_components/VaultPerformanceSection'
import { VaultAssetsTab } from './_components/VaultAssetsTab'
import { VaultTradesTab } from './_components/VaultTradesTab'
import { VaultFeesTab } from './_components/VaultFeesTab'
import {
  ArrowLeft,
  Edit3,
  DollarSign,
  Users,
  Percent,
  Layers,
  Wallet,
  ArrowUpRight,
  Shield,
  Clock,
  Sparkles,
  PieChart,
} from 'lucide-react'

export const Route = createFileRoute('/vaults/$id/')({
  head: ({ params }) => ({
    meta: generateMetadata({
      title: `Vault ${params.id}`,
      description: 'Explore strategy parameters, on-chain holdings, and trade history for this automated Solana vault.',
    }),
  }),
  component: VaultDetailPage,
})

const TABS = ['Overview', 'Performance', 'Holdings', 'Trades', 'Fees'] as const
type VaultTab = (typeof TABS)[number]

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

function formatLockupPeriod(lockup?: number): string {
  if (!lockup) return 'None'
  if (lockup >= 86400) {
    const days = Math.round(lockup / 86400)
    return `${days} Day${days === 1 ? '' : 's'}`
  }
  if (lockup >= 3600) {
    const hours = Math.round(lockup / 3600)
    return `${hours} Hour${hours === 1 ? '' : 's'}`
  }
  return `${lockup} Day${lockup === 1 ? '' : 's'}`
}

export function VaultDetailPage() {
  const { id } = Route.useParams()
  useRouteWsChannel([id ? `vault:${id}` : null, 'vaults'])

  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  const { data: vault, isLoading, isError } = useVaultDetailQuery(id)
  const { data: positions = [] } = usePortfolioQuery(walletAddress)
  const position = useMemo(
    () => positions.find((p) => p.vaultId === id || p.vaultAddress === vault?.address),
    [positions, id, vault?.address]
  )

  const [activeTab, setActiveTab] = useState<VaultTab>('Overview')
  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  if (isLoading) {
    return <VaultDetailSkeleton />
  }

  if (isError || !vault || !vault.id) {
    return (
      <div className="space-y-6 relative">
        <HeroAmbient />
        <PageHeader
          title="Vault Not Found"
          subtitle={`The vault ${id} could not be loaded.`}
          backTo="/vaults"
        />
        <SectionCard
          icon={<Layers className="size-4 text-primary-coral" />}
          title="Vault Unavailable"
          description="The requested vault does not exist or network connection is offline."
        >
          <div className="flex h-64 flex-col items-center justify-center text-center space-y-4 p-8">
            <div className="rounded-full bg-bg-inset p-4 border border-border-subtle">
              <Layers className="size-8 text-primary-coral" />
            </div>
            <p className="text-sm text-text-secondary max-w-md">
              Vault identifier <span className="font-mono text-text-primary">{id}</span> is not present on Solana mainnet.
            </p>
            <Link to="/vaults">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="size-4" /> Back to All Vaults
              </Button>
            </Link>
          </div>
        </SectionCard>
      </div>
    )
  }

  const focusAssets = vault.metadata?.focusAssets || []
  const isManager = Boolean(
    walletAddress &&
    vault.managerAddress &&
    walletAddress.toLowerCase() === vault.managerAddress.toLowerCase()
  )

  const displayName = vault.metadata?.displayName || `Vault ${id.slice(0, 8)}`

  return (
    <div className="space-y-6 relative">
      <HeroAmbient />

      {/* Reusable PageHeader Container */}
      <PageHeader
        title={displayName}
        subtitle={vault.metadata?.description || 'Non-custodial Solana automated vault portfolio & execution console.'}
        backTo="/vaults"
        action={
          <div className="flex items-center gap-2">
            <Link to="/vaults/$id/edit" params={{ id: vault.id }}>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <Edit3 className="size-3.5" />
                <span>Edit</span>
              </Button>
            </Link>
            <Link to="/trade" search={{ vaultId: vault.id }}>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <ArrowUpRight className="size-3.5 text-primary-coral" />
                <span>Trade</span>
              </Button>
            </Link>
            <SweepButton
              onClick={() => setDepositOpen(true)}
              className="h-8 text-xs font-semibold"
            >
              Deposit
            </SweepButton>
          </div>
        }
      />

      {/* Main Cockpit SectionCard */}
      <SectionCard
        icon={<Sparkles className="size-4 text-primary-coral" />}
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-base font-bold tracking-tight text-text-primary heading-playfair">
              {displayName}
            </span>
            <StatusBadge status={vault.status} />
            {isManager && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-coral/25 bg-primary-coral/15 px-2.5 py-0.5 text-xs font-semibold font-sans text-primary-coral shrink-0">
                <Shield className="size-3.5" /> Manager
              </span>
            )}
          </div>
        }
        description={<AddressPill address={vault.address} />}
        rightContent={
          <div className="flex flex-wrap items-center gap-2">
            {focusAssets.length > 0 && (
              <div className="flex items-center gap-1.5 mr-1">
                {focusAssets.map((asset) => (
                  <span
                    key={asset}
                    className="inline-flex items-center gap-1 rounded-full bg-bg-inset/80 px-2.5 py-0.5 text-xs font-mono text-text-secondary border border-border-subtle"
                  >
                    <TokenIcon symbol={asset} className="size-3" />
                    <span>{asset}</span>
                  </span>
                ))}
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setWithdrawOpen(true)}
              disabled={!position || position.sharesOwned <= 0}
              className="h-8 text-xs"
            >
              Withdraw
            </Button>
          </div>
        }
      >
        {/* 4-Card Top Metrics Grid matching app Card theme */}
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
            <div className="flex items-center justify-between text-text-tertiary">
              <span className="text-xs font-medium">Assets Under Management (TVL)</span>
              <DollarSign className="size-3.5 text-primary-coral" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
              ${(vault.tvl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-[11px] text-text-muted">Total vault deposits & liquidity</p>
          </Card>

          <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
            <div className="flex items-center justify-between text-text-tertiary">
              <span className="text-xs font-medium">Fee Rates</span>
              <Percent className="size-3.5 text-primary-gold" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
              {bpsToPercent(vault.performanceFeeBps)}
            </p>
            <p className="mt-1 text-[11px] text-text-muted">
              {bpsToPercent(vault.managementFeeBps)} Management / {vault.performanceFeeBps} BPS Perf
            </p>
          </Card>

          <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
            <div className="flex items-center justify-between text-text-tertiary">
              <span className="text-xs font-medium">Active Depositors</span>
              <Users className="size-3.5 text-status-success" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
              {vault.investorCount ?? 0}
            </p>
            <p className="mt-1 text-[11px] text-text-muted">Unique investor portfolios</p>
          </Card>

          <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
            <div className="flex items-center justify-between text-text-tertiary">
              <span className="text-xs font-medium">Terms & Lockup</span>
              <Clock className="size-3.5 text-status-info" />
            </div>
            <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
              {formatLockupPeriod(vault.lockupPeriod)}
            </p>
            <p className="mt-1 text-[11px] text-text-muted">
              Min deposit ${(vault.minRaiseAmount ?? 10).toLocaleString()} USD
            </p>
          </Card>
        </div>
      </SectionCard>

      {/* Connected Investor Position Container */}
      {position && position.sharesOwned > 0 && (
        <SectionCard
          icon={<Wallet className="size-4 text-primary-coral" />}
          title="Your Connected Position"
          description="Current portfolio holdings and unrealized PnL in this vault."
          rightContent={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWithdrawOpen(true)}
              className="h-8 text-xs"
            >
              Withdraw Shares
            </Button>
          }
        >
          <div className="grid gap-3.5 sm:grid-cols-3">
            <Card className="p-3.5 border-white/8 bg-bg-inset/30">
              <p className="text-xs text-text-tertiary">Shares Owned</p>
              <p className="mt-1 font-mono text-lg font-bold text-text-primary">
                {position.sharesOwned.toLocaleString()}
              </p>
              <p className="text-[11px] text-text-muted">
                Avg Entry: ${position.averageEntryPrice?.toFixed(2) ?? '0.00'}
              </p>
            </Card>

            <Card className="p-3.5 border-white/8 bg-bg-inset/30">
              <p className="text-xs text-text-tertiary">Current Valuation</p>
              <p className="mt-1 font-mono text-lg font-bold text-text-primary">
                ${position.currentValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[11px] text-text-muted">
                Cost Basis: ${position.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </Card>

            <Card className="p-3.5 border-white/8 bg-bg-inset/30">
              <p className="text-xs text-text-tertiary">Unrealized PnL</p>
              <p
                className={`mt-1 font-mono text-lg font-bold ${
                  position.pnl >= 0 ? 'text-status-success' : 'text-status-error'
                }`}
              >
                {position.pnl >= 0 ? '+' : ''}${position.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} (
                {position.pnlPercent >= 0 ? '+' : ''}
                {position.pnlPercent.toFixed(2)}%)
              </p>
              <p className="text-[11px] text-text-muted">Net returns</p>
            </Card>
          </div>
        </SectionCard>
      )}

      {/* Tabs Navigation Control */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <SegmentedControl
          options={TABS}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab as VaultTab)}
          className="w-full sm:w-auto"
        />
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {activeTab === 'Overview' && <VaultOverview vault={vault} />}
        {activeTab === 'Performance' && <VaultPerformanceSection vault={vault} />}
        {activeTab === 'Holdings' && <VaultAssetsTab vault={vault} />}
        {activeTab === 'Trades' && <VaultTradesTab vaultId={vault.id} />}
        {activeTab === 'Fees' && <VaultFeesTab vault={vault} />}
      </div>

      {/* Deposit & Withdraw Modals */}
      <DepositModal
        open={depositOpen}
        onClose={() => setDepositOpen(false)}
        vaultId={vault.id}
      />
      <WithdrawModal
        open={withdrawOpen}
        onClose={() => setWithdrawOpen(false)}
        vaultId={vault.id}
      />
    </div>
  )
}

function VaultDetailSkeleton() {
  return (
    <div className="space-y-6 relative">
      <HeroAmbient />

      {/* PageHeader Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-9 w-64 rounded-md" />
          <Skeleton className="h-4 w-96 rounded-md" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-8 w-16 rounded-xl" />
          <Skeleton className="h-8 w-18 rounded-xl" />
          <Skeleton className="h-8 w-20 rounded-xl" />
        </div>
      </div>

      {/* Cockpit SectionCard Skeleton */}
      <SectionCard
        icon={<Sparkles className="size-4 text-primary-coral" />}
        title={
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-5 w-44 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        }
        description={<Skeleton className="h-4 w-32 rounded-full" />}
        rightContent={
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-8 w-20 rounded-xl" />
          </div>
        }
      >
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md space-y-3">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28 rounded" />
                <Skeleton className="size-3.5 rounded-full" />
              </div>
              <Skeleton className="h-8 w-32 rounded-md" />
              <Skeleton className="h-2.5 w-36 rounded" />
            </Card>
          ))}
        </div>
      </SectionCard>

      {/* Tabs Bar Skeleton */}
      <div className="flex items-center gap-2 pt-2">
        <div className="flex items-center gap-1 rounded-xl bg-bg-inset p-1">
          {TABS.map((tab) => (
            <Skeleton key={tab} className="h-7 w-20 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Tab Panel Skeleton (Table / Chart) */}
      <SectionCard
        icon={<PieChart className="size-4 text-primary-gold" />}
        title="Asset Holdings & Allocations"
        description="On-chain non-custodial token balances and weight breakdown."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="flex gap-4">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          </div>
          <TableSkeleton
            headers={[
              { label: 'ASSET', align: 'left', width: 'w-24' },
              { label: 'HOLDINGS', align: 'right', width: 'w-20' },
              { label: 'USD VALUE', align: 'right', width: 'w-24' },
              { label: 'ALLOCATION', align: 'right', width: 'w-16' },
            ]}
            rows={4}
          />
        </div>
      </SectionCard>
    </div>
  )
}
