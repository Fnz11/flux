import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultDetailQuery, usePortfolioQuery } from '@/services/hooks'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
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
import { VaultOverview } from './VaultOverview'
import { getWithdrawEligibility } from '@/lib/eligibility'
import { VaultPerformanceSection } from './VaultPerformanceSection'
import { VaultAssetsTab } from './VaultAssetsTab'
import { VaultTradesTab } from './VaultTradesTab'
import { VaultFeesTab } from './VaultFeesTab'
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
  Tag,
  Lock,
  Unlock,
  TrendingUp,
} from 'lucide-react'

export const VAULT_DETAIL_TABS = ['Overview', 'Performance', 'Holdings', 'Trades', 'Fees'] as const
export type VaultDetailTab = (typeof VAULT_DETAIL_TABS)[number]

export interface VaultDetailViewProps {
  id: string
  backTo?: string
  defaultTab?: VaultDetailTab
  isInvestorView?: boolean
}

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

const DEFAULT_VAULT_BANNER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240" viewBox="0 0 800 240"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2313141c"/><stop offset="50%" stop-color="%231f1826"/><stop offset="100%" stop-color="%230e0f14"/></linearGradient><linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="%23FF5733"/><stop offset="100%" stop-color="%23FFC300"/></linearGradient></defs><rect width="800" height="240" fill="url(%23bg)"/><circle cx="120" cy="120" r="80" fill="none" stroke="url(%23acc)" stroke-width="2" opacity="0.25"/><circle cx="680" cy="120" r="100" fill="none" stroke="url(%23acc)" stroke-width="1.5" opacity="0.15"/><path d="M0,180 Q200,120 400,160 T800,140 L800,240 L0,240 Z" fill="url(%23acc)" opacity="0.08"/><text x="400" y="110" text-anchor="middle" fill="%23FFFFFF" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" letter-spacing="1">FLUX VAULT PROTOCOL</text><text x="400" y="145" text-anchor="middle" fill="%23FF5733" font-family="monospace" font-size="13" font-weight="600" letter-spacing="2">AUTOMATED SOLANA EXECUTION</text></svg>'

export function VaultDetailView({
  id,
  backTo = '/vaults',
  defaultTab = 'Overview',
  isInvestorView = false,
}: VaultDetailViewProps) {
  useRouteWsChannel([id ? `vault:${id}` : null, 'vaults'])

  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  const { data: vault, isLoading, isError } = useVaultDetailQuery(id)
  const { data: positions = [] } = usePortfolioQuery(walletAddress)
  const position = useMemo(
    () =>
      positions.find(
        (p) =>
          (p.vaultId && id && p.vaultId.toLowerCase() === id.toLowerCase()) ||
          (p.vaultAddress && id && p.vaultAddress.toLowerCase() === id.toLowerCase()) ||
          (vault?.address && p.vaultAddress && p.vaultAddress.toLowerCase() === vault.address.toLowerCase()) ||
          (vault?.id && p.vaultId && p.vaultId.toLowerCase() === vault.id.toLowerCase()),
      ),
    [positions, id, vault?.address, vault?.id],
  )

  const withdrawEligibility = useMemo(
    () => getWithdrawEligibility(vault, position, wallet.connected),
    [vault, position, wallet.connected],
  )

  const [activeTab, setActiveTab] = useState<VaultDetailTab>(defaultTab)
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
          backTo={backTo}
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
            <Link to={backTo as never}>
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="size-4" /> Back to Vaults
              </Button>
            </Link>
          </div>
        </SectionCard>
      </div>
    )
  }

  const focusAssets = vault.metadata?.focusAssets || []
  const tags = vault.metadata?.tags && vault.metadata.tags.length > 0 ? vault.metadata.tags : ['Solana', 'Vault', 'Alpha']
  const coverImageUrl = vault.metadata?.coverImageUrl || DEFAULT_VAULT_BANNER
  const isManager = Boolean(
    walletAddress &&
    vault.managerAddress &&
    walletAddress.toLowerCase() === vault.managerAddress.toLowerCase(),
  )
  const showManagerControls = !isInvestorView && isManager
  const displayName = vault.metadata?.displayName || `Vault ${id.slice(0, 8)}`

  return (
    <div className="space-y-6 relative">
      <HeroAmbient />

      {/* Reusable PageHeader Container */}
      <PageHeader
        title={displayName}
        subtitle={vault.metadata?.description || 'Non-custodial Solana automated vault portfolio & execution console.'}
        backTo={backTo}
        action={
          <div className="flex items-center gap-2">
            {showManagerControls && (
              <>
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
              </>
            )}
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
        icon={
          <img
            src={coverImageUrl}
            alt={displayName}
            className="size-11 sm:size-12 rounded-xl object-cover border border-white/15 shadow-md bg-bg-inset shrink-0"
          />
        }
        iconWrapperClassName="size-11 sm:size-12 rounded-xl p-0 border-0 overflow-hidden shrink-0 bg-transparent"
        title={
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-base font-bold tracking-tight text-text-primary">
              {displayName}
            </span>
            <StatusBadge status={vault.status} />
            <span className="inline-flex items-center gap-1 rounded-full border border-border-subtle bg-bg-inset/80 px-2.5 py-0.5 text-xs font-medium text-text-secondary">
              {vault.vaultType === 'closed' ? (
                <>
                  <Lock className="size-3 text-primary-amber" /> Closed Vault
                </>
              ) : (
                <>
                  <Unlock className="size-3 text-status-success" /> Open Vault
                </>
              )}
            </span>
            {showManagerControls && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary-coral/25 bg-primary-coral/15 px-2.5 py-0.5 text-xs font-semibold font-sans text-primary-coral shrink-0">
                <Shield className="size-3.5" /> Manager
              </span>
            )}
          </div>
        }
        description={
          <div className="flex flex-col gap-1.5 pt-1">
            {vault.metadata?.description && (
              <p className="text-xs text-text-secondary line-clamp-1 leading-relaxed">
                {vault.metadata.description}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2">
              <AddressPill address={vault.address} />
              {vault.managerAddress && (
                <span className="inline-flex items-center gap-1 text-[11px] text-text-tertiary">
                  <span>Manager:</span>
                  <AddressPill address={vault.managerAddress} />
                </span>
              )}
            </div>
            {/* Tags Badge List */}
            {tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] border border-white/10 px-2 py-0.5 text-[11px] font-mono text-text-secondary hover:text-text-primary hover:border-primary-coral/30 transition-colors"
                  >
                    <Tag className="size-2.5 text-primary-coral" />
                    <span>#{tag.replace(/^#/, '')}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        }
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
              disabled={!withdrawEligibility.canExecute}
              title={withdrawEligibility.reason ?? 'Withdraw shares from this vault'}
              className="h-8 text-xs disabled:cursor-not-allowed"
            >
              Withdraw
            </Button>
          </div>
        }
      >
        {/* Top Info Banner / Avatar & Metrics */}
        <div className="space-y-4">
          {/* 5-Card Top Metrics Grid */}
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-xs font-medium">AUM (TVL)</span>
                <DollarSign className="size-3.5 text-primary-coral" />
              </div>
              <p className="mt-2 font-mono text-xl sm:text-2xl font-bold text-text-primary">
                ${(vault.tvl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">Total vault liquidity</p>
            </Card>

            <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-xs font-medium">Min Raise Amount</span>
                <TrendingUp className="size-3.5 text-primary-amber" />
              </div>
              <p className="mt-2 font-mono text-xl sm:text-2xl font-bold text-text-primary">
                ${(vault.minRaiseAmount ?? 10).toLocaleString()} <span className="text-xs font-normal text-text-tertiary">USD</span>
              </p>
              <p className="mt-1 text-[11px] text-text-muted">Minimum funding threshold</p>
            </Card>

            <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-xs font-medium">Fee Rates</span>
                <Percent className="size-3.5 text-primary-gold" />
              </div>
              <p className="mt-2 font-mono text-xl sm:text-2xl font-bold text-text-primary">
                {bpsToPercent(vault.performanceFeeBps)}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                {bpsToPercent(vault.managementFeeBps)} Mgmt / {vault.performanceFeeBps} BPS Perf
              </p>
            </Card>

            <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-xs font-medium">Active Depositors</span>
                <Users className="size-3.5 text-status-success" />
              </div>
              <p className="mt-2 font-mono text-xl sm:text-2xl font-bold text-text-primary">
                {vault.investorCount ?? 0}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">Unique investor accounts</p>
            </Card>

            <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md sm:col-span-2 lg:col-span-1">
              <div className="flex items-center justify-between text-text-tertiary">
                <span className="text-xs font-medium">Withdrawal Lockup</span>
                <Clock className="size-3.5 text-status-info" />
              </div>
              <p className="mt-2 font-mono text-xl sm:text-2xl font-bold text-text-primary">
                {formatLockupPeriod(vault.lockupPeriod)}
              </p>
              <p className="mt-1 text-[11px] text-text-muted">
                {vault.vaultType === 'closed' ? 'Closed execution vault' : 'Open participation'}
              </p>
            </Card>
          </div>
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
              disabled={!withdrawEligibility.canExecute}
              title={withdrawEligibility.reason ?? 'Withdraw shares from this vault'}
              className="h-8 text-xs disabled:cursor-not-allowed"
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
          options={VAULT_DETAIL_TABS}
          value={activeTab}
          onChange={(tab) => setActiveTab(tab as VaultDetailTab)}
          className="w-full sm:w-auto"
        />
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {activeTab === 'Overview' && <VaultOverview vault={vault} isManager={showManagerControls} />}
        {activeTab === 'Performance' && <VaultPerformanceSection vault={vault} />}
        {activeTab === 'Holdings' && <VaultAssetsTab vault={vault} isManager={showManagerControls} />}
        {activeTab === 'Trades' && <VaultTradesTab vaultId={vault.id} isManager={showManagerControls} />}
        {activeTab === 'Fees' && <VaultFeesTab vault={vault} isManager={showManagerControls} />}
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

export function VaultDetailSkeleton() {
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
          {VAULT_DETAIL_TABS.map((tab) => (
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
