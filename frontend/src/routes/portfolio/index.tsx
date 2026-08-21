import { useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery, usePortfolioQuery } from '@/services/hooks'
import { useTradeHistory } from '@/hooks/useTradeHistory'
import { usePortfolioView } from './_hooks/usePortfolioView'
import { PortfolioSummary } from './_components/PortfolioSummary'
import { TradeHistory } from './_components/TradeHistory'
import { PerformanceChart, type Timeframe, TIMEFRAME_MAP } from './_components/PerformanceChart'
import { AllocationChart } from './_components/AllocationChart'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, SortableTableHead, Pagination } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sparkles, ShieldCheck, ChevronRight } from 'lucide-react'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { generateMetadata } from '@/lib/metadata'
import { cn, formatDate } from '@/lib/utils'

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
const POSITIONS_PAGE_SIZE = 8

export function PortfolioPage() {
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  useRouteWsChannel([walletAddress ? `portfolio:${walletAddress}` : null, 'global:leaderboard'])

  const { data: portfolioPositions = [], isLoading } = usePortfolioQuery(walletAddress)
  useVaultsQuery()

  const [timeframe, setTimeframe] = useState<Timeframe>('1M')
  const historyRange = TIMEFRAME_MAP[timeframe] || '30d'
  const { sortedPositions, sortBy, toggleSort, sortAsc, performanceData, allocationData } = usePortfolioView(walletAddress || portfolioPositions, historyRange)
  const [positionsPage, setPositionsPage] = useState(1)
  const [positionsPageSize, setPositionsPageSize] = useState(POSITIONS_PAGE_SIZE)

  const totalPositionsPages = Math.max(1, Math.ceil(sortedPositions.length / positionsPageSize))
  const pagedPositions = sortedPositions.slice(
    (positionsPage - 1) * positionsPageSize,
    positionsPage * positionsPageSize
  )

  const positionVaultIds = useMemo(() => sortedPositions.map((p) => p.vaultId), [sortedPositions])
  const { trades, isLoading: tradesLoading } = useTradeHistory(positionVaultIds)

  return (
    <div className="space-y-5">
      <PageHeader 
        title="Portfolio"
        subtitle={walletAddress ? `Hey ${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}, Welcome back!` : 'Track your investments and portfolio performance.'}
      />

      {!walletAddress ? (
        <div className="flex h-64 flex-col items-center justify-center rounded-2xl border border-border-subtle text-center backdrop-blur-sm">
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

          {/* Row 1: Performance Chart (Left 50%) & Invested Vault Allocation Donut (Right 50%) */}
          <div className="grid gap-5 lg:grid-cols-2 items-stretch">
            <div className="flex flex-col">
              <PerformanceChart
                data={performanceData}
                isLoading={isLoading}
                timeframe={timeframe}
                onTimeframeChange={setTimeframe}
              />
            </div>
            <div className="flex flex-col">
              <AllocationChart
                data={allocationData}
                isLoading={isLoading}
              />
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
              >
                <Table
                  containerClassName="max-h-[480px] min-h-[400px] flex-1"
                  footer={
                    <Pagination
                      page={positionsPage}
                      totalPages={totalPositionsPages}
                      totalItems={sortedPositions.length}
                      pageSize={positionsPageSize}
                      pageSizeOptions={[5, 8, 15, 30]}
                      onPageChange={setPositionsPage}
                      onPageSizeChange={(newSize: number) => {
                        setPositionsPageSize(newSize)
                        setPositionsPage(1)
                      }}
                      itemLabel="positions"
                      isLoading={isLoading}
                    />
                  }
                >
                  <TableHeader>
                    <TableRow>
                      <SortableTableHead
                        column="name"
                        sortBy={sortBy}
                        sortOrder={sortBy === 'name' ? (sortAsc ? 'asc' : 'desc') : undefined}
                        onSort={(col) => toggleSort(col as SortKey)}
                        className="py-3 px-6 whitespace-nowrap"
                      >
                        ASSET / VAULT
                      </SortableTableHead>
                      <TableHead className="py-3 px-4 text-right">SHARES</TableHead>
                      <TableHead className="py-3 px-4 text-right">INVESTED</TableHead>
                      <SortableTableHead
                        column="value"
                        sortBy={sortBy}
                        sortOrder={sortBy === 'value' ? (sortAsc ? 'asc' : 'desc') : undefined}
                        onSort={(col) => toggleSort(col as SortKey)}
                        align="right"
                        className="py-3 px-4"
                      >
                        CURRENT VALUE
                      </SortableTableHead>
                      <SortableTableHead
                        column="pnl"
                        sortBy={sortBy}
                        sortOrder={sortBy === 'pnl' ? (sortAsc ? 'asc' : 'desc') : undefined}
                        onSort={(col) => toggleSort(col as SortKey)}
                        align="right"
                        className="py-3 px-4"
                      >
                        NET PNL
                      </SortableTableHead>
                      <TableHead className="py-3 px-6 text-right">ACTION</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoading ? (
                      <TableRowSkeleton
                        columns={6}
                        rows={6}
                        cellAligns={['left', 'right', 'right', 'right', 'right', 'right']}
                        cellWidths={['w-32', 'w-16', 'w-16', 'w-20', 'w-24', 'w-6']}
                      />
                    ) : sortedPositions.length === 0 ? (
                      <TableEmpty
                        colSpan={6}
                        title="No active positions yet"
                        description="Deposit into a vault to start building your portfolio"
                        minHeight="min-h-[360px]"
                      />
                    ) : (
                      pagedPositions.map((pos) => {
                        const isPositive = pos.pnl >= 0
                        const colorClass = isPositive ? 'text-status-success' : 'text-status-error'
                        const initials = pos.vaultName
                          .split(' ')
                          .map((n) => n[0])
                          .join('')
                          .toUpperCase()
                          .slice(0, 2)

                        return (
                          <TableRow key={pos.vaultId} className="group hover:bg-bg-elevated/80 transition-colors">
                            <TableCell className="py-4 px-6 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 shrink-0">
                                  <AvatarFallback seed={pos.vaultId || pos.vaultName}>{initials}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="font-semibold text-sm flex items-center gap-2 text-text-primary">
                                    <span>{pos.vaultName}</span>
                                  </div>
                                  <div className="mt-0.5">
                                    <span className="text-xs text-text-tertiary font-mono">
                                      {pos.investedAt || pos.createdAt
                                        ? `Invested on ${formatDate(pos.investedAt || pos.createdAt)}`
                                        : 'Active Vault'}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className={cn('py-4 px-4 text-right font-mono text-xs font-medium whitespace-nowrap', colorClass)}>
                              {pos.sharesOwned.toFixed(2)}
                            </TableCell>
                            <TableCell className={cn('py-4 px-4 text-right font-mono text-xs font-medium whitespace-nowrap', colorClass)}>
                              ${pos.totalInvested.toFixed(2)}
                            </TableCell>
                            <TableCell className={cn('py-4 px-4 text-right font-mono text-xs font-semibold whitespace-nowrap', colorClass)}>
                              ${pos.currentValue.toFixed(2)}
                            </TableCell>
                            <TableCell className={cn('py-4 px-4 text-right font-mono text-xs font-semibold whitespace-nowrap', colorClass)}>
                              {isPositive ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pnlPercent.toFixed(2)}%)
                            </TableCell>
                            <TableCell className="py-4 px-6 whitespace-nowrap text-right">
                              <Link
                                to="/invest/vaults/$id"
                                params={{ id: pos.vaultId }}
                                className="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-primary-coral hover:bg-primary-coral/10 transition-colors"
                              >
                                View
                                <ChevronRight className="size-3.5" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
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
