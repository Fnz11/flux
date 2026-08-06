import { useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery, usePortfolioQuery } from '@/services/hooks'
import { useTradeHistory } from '@/hooks/useTradeHistory'
import { usePortfolioView } from './_hooks/usePortfolioView'
import { Button } from '@/components/ui/button'
import { PortfolioSummary } from './_components/PortfolioSummary'
import { PnLTicker } from './_components/PnLTicker'
import { TradeHistory } from './_components/TradeHistory'
import { PerformanceChart } from './_components/PerformanceChart'
import { AllocationChart } from './_components/AllocationChart'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table'
import { PageHeader } from '@/components/ui/PageHeader'

import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'

export const Route = createFileRoute('/portfolio/')({ component: PortfolioPage })

type SortKey = 'value' | 'pnl' | 'name'

function PortfolioPage() {
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  useRouteWsChannel([walletAddress ? `portfolio:${walletAddress}` : null])

  const { data: portfolioPositions = [], isLoading } = usePortfolioQuery(walletAddress)
  useVaultsQuery()

  const { sortedPositions, sortBy, toggleSort, sortAsc, performanceData, allocationData } = usePortfolioView(portfolioPositions)

  const positionVaultIds = useMemo(() => sortedPositions.map((p) => p.vaultId), [sortedPositions])
  const { trades, isLoading: tradesLoading } = useTradeHistory(positionVaultIds)

  return (
    <div className="space-y-4">
      <PageHeader 
        title="Portfolio"
        subtitle="Track your investments and portfolio performance."
      />

      <PortfolioSummary />

      <div className="grid gap-4 lg:grid-cols-3 items-stretch">
        <div className="lg:col-span-2 flex flex-col">
          <PerformanceChart data={performanceData} isLoading={isLoading} />
        </div>
        <div className="flex flex-col">
          <AllocationChart data={allocationData} isLoading={isLoading} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-text-primary">Positions</h2>
              {sortedPositions.length > 0 && (
                <div className="flex gap-1 rounded-xl bg-bg-inset p-0.5">
                  {(['value', 'pnl', 'name'] as SortKey[]).map((key) => (
                    <Button
                      key={key}
                      variant={sortBy === key ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => toggleSort(key)}
                    >
                      {key === 'value' ? 'Value' : key === 'pnl' ? 'PnL' : 'Name'}
                      {sortBy === key && (sortAsc ? ' ↑' : ' ↓')}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="rounded-xl border border-border-subtle bg-bg-elevated/60 backdrop-blur-2xl overflow-hidden p-0">

            {isLoading ? (
              <div className="space-y-3 min-h-[200px]">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-xl bg-bg-inset/60" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vault Name</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Invested</TableHead>
                    <TableHead className="text-right">Current Value</TableHead>
                    <TableHead className="text-right">Net PnL</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedPositions.length === 0 ? (
                    <TableEmpty
                      colSpan={5}
                      title="No positions yet"
                      description="Deposit into a vault to start building your portfolio"
                    />
                  ) : (
                    sortedPositions.map((pos) => (
                      <TableRow key={pos.vaultId}>
                        <TableCell className="font-medium text-text-primary">{pos.vaultName}</TableCell>
                        <TableCell className="text-right font-mono">{pos.sharesOwned.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono">${pos.totalInvested.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">${pos.currentValue.toFixed(2)}</TableCell>
                        <TableCell className="text-right font-mono font-semibold">
                          <span className={pos.pnl >= 0 ? 'text-status-success' : 'text-status-error'}>
                            {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toFixed(2)} ({pos.pnlPercent.toFixed(2)}%)
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <PnLTicker />
          <TradeHistory trades={trades} isLoading={tradesLoading} />
        </div>
      </div>
    </div>
  )
}
