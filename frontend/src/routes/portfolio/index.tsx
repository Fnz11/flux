import { useMemo, useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery, usePortfolioQuery } from '@/services/hooks'
import { useTradeHistory } from '@/hooks/useTradeHistory'
import { usePortfolioView } from './_hooks/usePortfolioView'
import { PortfolioSummary } from './_components/PortfolioSummary'
import { TradeHistory } from './_components/TradeHistory'
import { PerformanceChart } from './_components/PerformanceChart'
import { LeaderboardWidget } from './_components/LeaderboardWidget'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Plus, Sparkles, ShieldCheck } from 'lucide-react'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { generateMetadata } from '@/lib/metadata'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/portfolio/')({
  head: () => ({
    meta: generateMetadata({
      title: 'Portfolio',
      description: 'Track your invested Solana vaults, PnL performance, trade history, and asset allocations.',
      path: '/portfolio',
      noIndex: true,
    }),
  }),
  component: PortfolioPage,
})

type SortKey = 'value' | 'pnl' | 'name'

const TOKEN_ICONS: Record<string, string> = {
  SOL: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  USDC: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  USDT: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png',
  JUP: 'https://static.jup.ag/jup/icon.png',
  PYTH: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png',
}

export function PortfolioPage() {
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  useRouteWsChannel([walletAddress ? `portfolio:${walletAddress}` : null])

  const { data: portfolioPositions = [], isLoading } = usePortfolioQuery(walletAddress)
  useVaultsQuery()

  const { sortedPositions, sortBy, toggleSort, sortAsc, performanceData } = usePortfolioView(portfolioPositions)

  const positionVaultIds = useMemo(() => sortedPositions.map((p) => p.vaultId), [sortedPositions])
  const { trades, isLoading: tradesLoading } = useTradeHistory(positionVaultIds)

  return (
    <div className="space-y-5">
      <PageHeader 
        title="Dashboard"
        subtitle={walletAddress ? `Hey ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}, Welcome back!` : 'Track your investments and portfolio performance.'}
      />

      {!walletAddress ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-border-subtle bg-bg-elevated/70 text-center">
          <div className="mb-4 rounded-full bg-bg-inset p-3">
            <ShieldCheck className="size-8 text-primary-coral" />
          </div>
          <h3 className="mb-2 text-lg font-semibold text-text-primary">Connect your wallet</h3>
          <p className="text-sm text-text-secondary">Please connect your wallet to view your portfolio.</p>
        </div>
      ) : (
        <>
          {/* Top 3-Card Header Summary */}
          <PortfolioSummary />

          {/* Row 1: Performance Chart (Left 50%) & Top Tokens (Right 50%) */}
          <div className="grid gap-5 lg:grid-cols-2 items-stretch">
            <div className="flex flex-col">
              <PerformanceChart data={performanceData} isLoading={isLoading} />
            </div>
            <div className="flex flex-col">
              <LeaderboardWidget />
            </div>
          </div>

          {/* Row 2: Vault Assets & Positions (Left 50%) & Trade History (Right 50%) */}
          <div className="grid gap-5 lg:grid-cols-2 items-stretch">
            {/* Left 50%: Positions Table */}
            <div id="positions" className="flex flex-col h-full">
              <SectionCard
                icon={<Sparkles className="size-4 text-primary-coral" />}
                title="Vault Assets & Positions"
                description="Active vault shares, net PnL, and lock period status"
                className="flex-1 flex flex-col justify-between"
                rightContent={
                  sortedPositions.length > 0 && (
                    <div className="flex gap-1 rounded-xl bg-bg-inset p-1 text-xs">
                      {(['value', 'pnl', 'name'] as SortKey[]).map((key) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => toggleSort(key)}
                          className={cn(
                            'rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer',
                            sortBy === key ? 'bg-bg-elevated text-text-primary shadow-xs font-semibold' : 'text-text-tertiary hover:text-text-secondary',
                          )}
                        >
                          {key === 'value' ? 'Value' : key === 'pnl' ? 'PnL' : 'Name'}
                          {sortBy === key && (sortAsc ? ' ↑' : ' ↓')}
                        </button>
                      ))}
                    </div>
                  )
                }
              >
                <div className="rounded-xl border border-border-subtle/60 overflow-hidden">
                  {isLoading ? (
                    <div className="p-5 space-y-3 min-h-[200px]">
                      {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} className="h-10 animate-pulse rounded-xl bg-bg-inset/60" />
                      ))}
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="whitespace-nowrap">ASSET / VAULT</TableHead>
                          <TableHead className="text-right">SHARES</TableHead>
                          <TableHead className="text-right">INVESTED</TableHead>
                          <TableHead className="text-right">CURRENT VALUE</TableHead>
                          <TableHead className="text-right">NET PNL</TableHead>
                          <TableHead className="text-right">LOCK PERIOD</TableHead>
                          <TableHead className="text-right">ACTION</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPositions.length === 0 ? (
                          <TableEmpty
                            colSpan={7}
                            title="No active positions yet"
                            description="Deposit into a vault to start building your portfolio"
                          />
                        ) : (
                          sortedPositions.map((pos, idx) => {
                            const iconUrl = TOKEN_ICONS[pos.vaultName.split(' ')[0]] || TOKEN_ICONS.SOL
                            return (
                              <TableRow key={pos.vaultId} className="hover:bg-bg-inset/50 transition-colors">
                                <TableCell className="font-semibold text-text-primary">
                                  <div className="flex items-center gap-2.5">
                                    <img src={iconUrl} alt={pos.vaultName} className="size-6 rounded-full object-cover shrink-0" />
                                    <div className="flex flex-col">
                                      <span className="text-xs font-bold text-text-primary">{pos.vaultName}</span>
                                      <span className="text-[10px] text-text-tertiary">Active Vault</span>
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-text-secondary">
                                  {pos.sharesOwned.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-text-secondary">
                                  ${pos.totalInvested.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-semibold text-text-primary">
                                  ${pos.currentValue.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs font-semibold">
                                  <span className={pos.pnl >= 0 ? 'text-status-success' : 'text-status-error'}>
                                    {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pnlPercent.toFixed(2)}%)
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-bg-inset">
                                      <div className="h-full bg-gradient-to-r from-primary-coral to-primary-gold rounded-full" style={{ width: `${Math.min(100, (idx + 1) * 30)}%` }} />
                                    </div>
                                    <span className="text-[10px] font-mono text-text-tertiary">30d</span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-right">
                                  <button
                                    type="button"
                                    title="Add Stake"
                                    className="inline-flex size-6 items-center justify-center rounded-lg border border-border-medium bg-bg-inset hover:bg-bg-surface hover:border-primary-coral transition-colors text-text-primary cursor-pointer"
                                  >
                                    <Plus className="size-3.5" />
                                  </button>
                                </TableCell>
                              </TableRow>
                            )
                          })
                        )}
                      </TableBody>
                    </Table>
                  )}
                </div>
              </SectionCard>
            </div>

            {/* Right 50%: Trade History */}
            <div className="flex flex-col h-full">
              <TradeHistory trades={trades} isLoading={tradesLoading} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
