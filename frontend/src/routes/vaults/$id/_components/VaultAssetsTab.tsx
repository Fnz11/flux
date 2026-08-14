import { useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useVaultBalancesQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { AddressPill } from '@/components/ui/AddressPill'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { PieChart, ArrowRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Vault } from '@/types'

interface VaultAssetsTabProps {
  vault: Vault
}

type AssetSortColumn = 'symbol' | 'amount' | 'usdValue' | 'allocation'

export function VaultAssetsTab({ vault }: VaultAssetsTabProps) {
  const { data: rawBalances = [], isLoading } = useVaultBalancesQuery(vault.id || vault.address)
  const [sortBy, setSortBy] = useState<AssetSortColumn>('usdValue')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  const totalValue = useMemo(
    () => rawBalances.reduce((sum, b) => sum + (b.usdValue || 0), 0),
    [rawBalances]
  )

  const handleSort = (column: AssetSortColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

  const sortedBalances = useMemo(() => {
    return [...rawBalances].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortBy) {
        case 'symbol':
          aVal = (a.symbol || '').toLowerCase()
          bVal = (b.symbol || '').toLowerCase()
          break
        case 'amount':
          aVal = a.amount || 0
          bVal = b.amount || 0
          break
        case 'usdValue':
          aVal = a.usdValue || 0
          bVal = b.usdValue || 0
          break
        case 'allocation':
          aVal = totalValue > 0 ? (a.usdValue / totalValue) * 100 : 0
          bVal = totalValue > 0 ? (b.usdValue / totalValue) * 100 : 0
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [rawBalances, sortBy, sortOrder, totalValue])

  const renderSortIcon = (column: AssetSortColumn) => {
    if (sortBy !== column) {
      return <ArrowUpDown className="ml-1 inline-block size-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="ml-1 inline-block size-3.5 text-primary-coral" />
    ) : (
      <ArrowDown className="ml-1 inline-block size-3.5 text-primary-coral" />
    )
  }

  return (
    <SectionCard
      icon={<PieChart className="size-4 text-primary-gold" />}
      title="Asset Holdings & Allocations"
      description="On-chain non-custodial token balances and weight breakdown."
      rightContent={
        <Link to="/trade" search={{ vaultId: vault.id }}>
          <SweepButton className="h-8 text-xs">
            <span className="flex items-center gap-1.5">
              Trade & Rebalance <ArrowRight className="size-3" />
            </span>
          </SweepButton>
        </Link>
      }
    >
      <div className="space-y-6">
        {/* Allocation Multi-Progress Bar */}
        {rawBalances.length > 0 && totalValue > 0 && (
          <div className="space-y-2.5">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-bg-inset border border-border-subtle/50">
              {rawBalances.map((b, idx) => {
                const pct = (b.usdValue / totalValue) * 100
                if (pct <= 0) return null
                const colors = ['bg-primary-coral', 'bg-primary-gold', 'bg-status-success', 'bg-status-info', 'bg-primary-amber']
                const colorClass = colors[idx % colors.length]
                return (
                  <div
                    key={b.mint || b.symbol}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                    className={`${colorClass} transition-all`}
                    title={`${b.symbol}: ${pct.toFixed(1)}%`}
                  />
                )
              })}
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-text-tertiary">
              {rawBalances.map((b, idx) => {
                const pct = (b.usdValue / totalValue) * 100
                const colors = ['text-primary-coral', 'text-primary-gold', 'text-status-success', 'text-status-info', 'text-primary-amber']
                return (
                  <div key={b.mint || b.symbol} className="flex items-center gap-1.5 font-mono">
                    <span className={`inline-block size-2 rounded-full ${colors[idx % colors.length].replace('text-', 'bg-')}`} />
                    <span className="font-medium text-text-primary">{b.symbol}</span>
                    <span>({pct.toFixed(1)}%)</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Token Balances Table with Sortable Headers */}
        <div className="overflow-hidden rounded-xl border border-white/8 bg-bg-surface/40">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-border-subtle/50 bg-bg-inset/60 select-none">
                <TableHead
                  onClick={() => handleSort('symbol')}
                  className={cn(
                    'group cursor-pointer py-3.5 px-4 text-xs font-semibold transition-colors',
                    sortBy === 'symbol' ? 'text-primary-coral' : 'hover:text-text-primary'
                  )}
                >
                  <div className="flex items-center">
                    ASSET {renderSortIcon('symbol')}
                  </div>
                </TableHead>

                <TableHead
                  onClick={() => handleSort('amount')}
                  className={cn(
                    'group cursor-pointer py-3.5 px-4 text-right text-xs font-semibold transition-colors',
                    sortBy === 'amount' ? 'text-primary-coral' : 'hover:text-text-primary'
                  )}
                >
                  <div className="flex items-center justify-end">
                    HOLDINGS {renderSortIcon('amount')}
                  </div>
                </TableHead>

                <TableHead
                  onClick={() => handleSort('usdValue')}
                  className={cn(
                    'group cursor-pointer py-3.5 px-4 text-right text-xs font-semibold transition-colors',
                    sortBy === 'usdValue' ? 'text-primary-coral' : 'hover:text-text-primary'
                  )}
                >
                  <div className="flex items-center justify-end">
                    USD VALUE {renderSortIcon('usdValue')}
                  </div>
                </TableHead>

                <TableHead
                  onClick={() => handleSort('allocation')}
                  className={cn(
                    'group cursor-pointer py-3.5 px-4 text-right text-xs font-semibold transition-colors',
                    sortBy === 'allocation' ? 'text-primary-coral' : 'hover:text-text-primary'
                  )}
                >
                  <div className="flex items-center justify-end">
                    ALLOCATION {renderSortIcon('allocation')}
                  </div>
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading ? (
                <TableRowSkeleton
                  columns={4}
                  rows={4}
                  cellAligns={['left', 'right', 'right', 'right']}
                  cellWidths={['w-28', 'w-24', 'w-24', 'w-16']}
                />
              ) : sortedBalances.length === 0 ? (
                <TableEmpty
                  colSpan={4}
                  title="No asset holdings recorded"
                  description="On-chain token balances held by this vault will appear here in real-time."
                />
              ) : (
                sortedBalances.map((b) => {
                  const pct = totalValue > 0 ? (b.usdValue / totalValue) * 100 : 0
                  return (
                    <TableRow key={b.mint || b.symbol} className="border-b border-border-subtle/40 hover:bg-bg-inset/30 transition-colors">
                      <TableCell className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <TokenIcon symbol={b.symbol} className="size-5" />
                          <div>
                            <span className="font-semibold text-text-primary">{b.symbol}</span>
                            {b.mint && (
                              <div className="mt-0.5">
                                <AddressPill address={b.mint} />
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-right font-mono font-medium text-text-primary">
                        {b.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-right font-mono font-semibold text-text-primary">
                        ${b.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </TableCell>
                      <TableCell className="py-3.5 px-4 text-right font-mono font-medium text-text-secondary">
                        {pct.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </SectionCard>
  )
}
