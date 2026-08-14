import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useVaultBalancesQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { AddressPill } from '@/components/ui/AddressPill'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableEmpty, SortableTableHead } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { useTableSort } from '@/hooks/useTableSort'
import { PieChart, ArrowRight } from 'lucide-react'
import type { Vault } from '@/types'

export interface VaultAssetsTabProps {
  vault: Vault
  isManager?: boolean
}

type AssetSortColumn = 'symbol' | 'amount' | 'usdValue' | 'allocation'

export function VaultAssetsTab({ vault, isManager }: VaultAssetsTabProps) {
  const { data: rawBalances = [], isLoading } = useVaultBalancesQuery(vault.id || vault.address)
  const { sortBy, sortOrder, handleSort } = useTableSort<AssetSortColumn>({
    sortBy: 'usdValue',
    defaultOrder: 'desc',
    allowClear: false,
  })

  const totalValue = useMemo(
    () => rawBalances.reduce((sum, b) => sum + (b.usdValue || 0), 0),
    [rawBalances],
  )

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

  return (
    <SectionCard
      icon={<PieChart className="size-4 text-primary-gold" />}
      title="Asset Holdings & Allocations"
      description="On-chain non-custodial token balances and weight breakdown."
      rightContent={
        isManager ? (
          <Link to="/trade" search={{ vaultId: vault.id }}>
            <SweepButton className="h-8 text-xs font-semibold">
              <span>Execute Swap</span>
              <ArrowRight className="ml-1.5 size-3.5" />
            </SweepButton>
          </Link>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* Allocation Visual Bar */}
        {totalValue > 0 && (
          <div className="space-y-2">
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-bg-inset border border-white/8">
              {rawBalances.map((b, idx) => {
                const pct = totalValue > 0 ? (b.usdValue / totalValue) * 100 : 0
                if (pct <= 0) return null
                const colors = ['bg-primary-coral', 'bg-primary-gold', 'bg-status-success', 'bg-status-info', 'bg-purple-500']
                return (
                  <div
                    key={b.mint || idx}
                    style={{ width: `${pct}%` }}
                    className={`${colors[idx % colors.length]} transition-all duration-300`}
                    title={`${b.symbol}: ${pct.toFixed(1)}%`}
                  />
                )
              })}
            </div>

            <div className="flex flex-wrap gap-4 text-xs">
              {rawBalances.map((b, idx) => {
                const pct = totalValue > 0 ? (b.usdValue / totalValue) * 100 : 0
                if (pct <= 0) return null
                const dotColors = ['bg-primary-coral', 'bg-primary-gold', 'bg-status-success', 'bg-status-info', 'bg-purple-500']
                return (
                  <div key={b.mint || idx} className="flex items-center gap-1.5">
                    <span className={`size-2 rounded-full ${dotColors[idx % dotColors.length]}`} />
                    <span className="font-medium text-text-primary">{b.symbol}</span>
                    <span className="font-mono text-text-tertiary">{pct.toFixed(1)}%</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Assets Table */}
        <Table className="min-w-[600px]">
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="symbol"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
                className="py-3 px-4"
              >
                ASSET
              </SortableTableHead>
              <SortableTableHead
                column="amount"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-3 px-4"
              >
                HOLDINGS
              </SortableTableHead>
              <SortableTableHead
                column="usdValue"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-3 px-4"
              >
                USD VALUE
              </SortableTableHead>
              <SortableTableHead
                column="allocation"
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-3 px-4"
              >
                ALLOCATION
              </SortableTableHead>
              <TableHead className="py-3 px-4 text-right">MINT ADDRESS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRowSkeleton key={i} columns={5} />
              ))
            ) : sortedBalances.length === 0 ? (
              <TableEmpty
                colSpan={5}
                icon={<PieChart className="size-5" />}
                title="No Token Balances Found"
                description="This vault does not hold any on-chain tokens yet."
                minHeight="min-h-[200px]"
              />
            ) : (
              sortedBalances.map((b) => {
                const allocation = totalValue > 0 ? (b.usdValue / totalValue) * 100 : 0
                return (
                  <TableRow key={b.mint} className="hover:bg-white/[0.02]">
                    <TableCell className="py-3.5 px-4 font-medium">
                      <div className="flex items-center gap-2.5">
                        <TokenIcon symbol={b.symbol} className="size-6" />
                        <div>
                          <span className="font-bold text-text-primary text-xs">{b.symbol}</span>
                          <p className="text-[10px] text-text-tertiary">{b.name || b.symbol}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-right font-mono text-xs font-semibold text-text-primary">
                      {b.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-right font-mono text-xs font-semibold text-text-primary">
                      ${b.usdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-right font-mono text-xs font-semibold text-primary-gold">
                      {allocation.toFixed(2)}%
                    </TableCell>
                    <TableCell className="py-3.5 px-4 text-right">
                      <AddressPill address={b.mint} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>
    </SectionCard>
  )
}
