import { useState, useMemo } from 'react'
import type { ApiTrade, TradeType } from '@/types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, SortableTableHead, Pagination } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionCard } from '@/components/ui/SectionCard'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { formatTokenSymbol } from '@/constants/tokens'
import { History } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import { useTableSort } from '@/hooks/useTableSort'

interface TradeHistoryProps {
  trades: ApiTrade[]
  isLoading?: boolean
}

type FilterTab = 'All' | 'Trades' | 'Deposits' | 'Withdrawals'

const FILTER_MAP: Record<FilterTab, TradeType[] | null> = {
  All: null,
  Trades: ['Buy', 'Sell'],
  Deposits: ['Deposit'],
  Withdrawals: ['Withdraw'],
}

type TradeSortColumn = 'executed_at' | 'trade_type' | 'pair' | 'amount_in' | 'price_at_execution'

const PAGE_SIZE = 8

const typeColor: Record<TradeType, string> = {
  Buy: 'text-status-success',
  Sell: 'text-status-error',
  Deposit: 'text-status-info',
  Withdraw: 'text-status-purple',
}

export function TradeHistory({ trades, isLoading }: TradeHistoryProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(PAGE_SIZE)

  const filterArr = FILTER_MAP[activeFilter]
  const filterSet = filterArr ? new Set(filterArr) : null
  const filteredTrades = useMemo(() => {
    return filterSet ? trades.filter((t) => filterSet.has(t.trade_type)) : trades
  }, [trades, filterSet])

  const { sortBy, sortOrder, handleSort } = useTableSort<TradeSortColumn>({
    sortBy: 'executed_at',
    defaultOrder: 'desc',
    allowClear: true,
  })

  const sortedTrades = useMemo(() => {
    if (!sortBy || !sortOrder) return filteredTrades

    return [...filteredTrades].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortBy) {
        case 'executed_at': {
          const timeA = new Date(a.executed_at || (a as any).created_at || 0).getTime()
          const timeB = new Date(b.executed_at || (b as any).created_at || 0).getTime()
          aVal = isNaN(timeA) ? 0 : timeA
          bVal = isNaN(timeB) ? 0 : timeB
          break
        }
        case 'trade_type':
          aVal = String(a.trade_type || '').toLowerCase()
          bVal = String(b.trade_type || '').toLowerCase()
          break
        case 'pair':
          aVal = `${a.input_token}/${a.output_token}`.toLowerCase()
          bVal = `${b.input_token}/${b.output_token}`.toLowerCase()
          break
        case 'amount_in':
          aVal = Number(a.amount_in || (a as any).amount || 0)
          bVal = Number(b.amount_in || (b as any).amount || 0)
          break
        case 'price_at_execution':
          aVal = Number(a.price_at_execution || (a as any).price || 0)
          bVal = Number(b.price_at_execution || (b as any).price || 0)
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [filteredTrades, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(sortedTrades.length / pageSize))
  const paged = sortedTrades.slice((page - 1) * pageSize, page * pageSize)

  return (
    <SectionCard
      icon={<History className="size-4 text-primary-coral" />}
      title="Trade History"
      description="Real-time execution log of past vault swaps & transactions"
      className="flex-1 flex flex-col justify-between"
      rightContent={
        <Select
          value={activeFilter}
          onValueChange={(val) => {
            setActiveFilter(val as FilterTab)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-8 w-28 rounded-xl border border-border-subtle bg-bg-inset px-2.5 text-xs font-semibold text-text-primary hover:border-primary-coral/40 cursor-pointer">
            <SelectValue placeholder="All">
              {activeFilter}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end" className="min-w-[8rem] rounded-xl border-border-medium bg-bg-elevated text-text-primary shadow-xl">
            <SelectItem value="All" className="text-xs cursor-pointer">All</SelectItem>
            <SelectItem value="Trades" className="text-xs cursor-pointer">Trades</SelectItem>
            <SelectItem value="Deposits" className="text-xs cursor-pointer">Deposits</SelectItem>
            <SelectItem value="Withdrawals" className="text-xs cursor-pointer">Withdrawals</SelectItem>
          </SelectContent>
        </Select>
      }
    >
      <Table
        containerClassName="max-h-[480px] min-h-[400px] flex-1"
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={sortedTrades.length}
            pageSize={pageSize}
            pageSizeOptions={[5, 8, 15, 30]}
            onPageChange={setPage}
            onPageSizeChange={(newSize: number) => {
              setPageSize(newSize)
              setPage(1)
            }}
            itemLabel="trades"
            isLoading={isLoading}
          />
        }
      >
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="executed_at"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            >
              DATE
            </SortableTableHead>
            <SortableTableHead
              column="trade_type"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            >
              TYPE
            </SortableTableHead>
            <SortableTableHead
              column="pair"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            >
              PAIR
            </SortableTableHead>
            <SortableTableHead
              column="amount_in"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              align="right"
            >
              AMOUNT
            </SortableTableHead>
            <SortableTableHead
              column="price_at_execution"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              align="right"
            >
              PRICE
            </SortableTableHead>
            <TableHead>STATUS</TableHead>
            <TableHead className="text-right">TX</TableHead>
          </TableRow>
        </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRowSkeleton
                columns={7}
                rows={6}
                cellAligns={['left', 'left', 'left', 'right', 'right', 'left', 'right']}
                cellWidths={['w-20', 'w-14', 'w-24', 'w-16', 'w-16', 'w-18', 'w-12']}
              />
            ) : paged.length === 0 ? (
              <TableEmpty
                colSpan={7}
                title="No trades recorded yet"
                description="Trades executed on vaults will appear here"
                minHeight="min-h-[360px]"
              />
            ) : (
              paged.map((trade) => {
                const actionColor = typeColor[trade.trade_type] || 'text-text-primary'
                const inputSym = formatTokenSymbol(trade.input_token, trade.trade_type === 'Withdraw' ? 'SHARES' : undefined)
                const outputSym = formatTokenSymbol(trade.output_token, trade.trade_type === 'Deposit' ? 'SHARES' : undefined)

                return (
                  <TableRow key={trade.id}>
                    <TableCell className="whitespace-nowrap font-mono text-xs text-text-tertiary">
                      {formatDate(trade.executed_at, { timeZone: 'UTC' })}
                    </TableCell>
                    <TableCell className={cn('font-semibold', actionColor)}>
                      {trade.trade_type}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-center -space-x-1.5">
                          <TokenIcon symbol={trade.input_token} className="size-4" />
                          <TokenIcon symbol={trade.output_token} className="size-4" />
                        </div>
                        <span className="font-medium text-text-primary">{inputSym}/{outputSym}</span>
                      </div>
                    </TableCell>
                    <TableCell className={cn('text-right font-mono font-medium', actionColor)}>
                      {Number(trade.amount_in || 0).toFixed(4)}
                    </TableCell>
                    <TableCell className={cn('text-right font-mono font-medium', actionColor)}>
                      ${Number(trade.price_at_execution || 0).toFixed(4)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status="success" label="Confirmed" />
                    </TableCell>
                    <TableCell className="text-right">
                      <SolscanLink signature={trade.transaction_signature} />
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
    </SectionCard>
  )
}
