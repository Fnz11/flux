import { useState } from 'react'
import type { ApiTrade, TradeType } from '@/types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionCard } from '@/components/ui/SectionCard'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { History } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'

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

const PAGE_SIZE = 10

const typeColor: Record<TradeType, string> = {
  Buy: 'text-status-success',
  Sell: 'text-status-error',
  Deposit: 'text-status-info',
  Withdraw: 'text-status-warn',
}

export function TradeHistory({ trades, isLoading }: TradeHistoryProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('All')
  const [page, setPage] = useState(0)

  const filterArr = FILTER_MAP[activeFilter]
  const filterSet = filterArr ? new Set(filterArr) : null
  const filtered = filterSet
    ? trades.filter((t) => filterSet.has(t.trade_type))
    : trades

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

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
            setPage(0)
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
      <div className="flex flex-col flex-1 justify-between gap-3">
        <Table containerClassName="min-h-[440px] flex-1">
          <TableHeader>
            <TableRow>
              <TableHead>DATE</TableHead>
              <TableHead>TYPE</TableHead>
              <TableHead>PAIR</TableHead>
              <TableHead className="text-right">AMOUNT</TableHead>
              <TableHead className="text-right">PRICE</TableHead>
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
              paged.map((trade) => (
                <TableRow key={trade.id}>
                  <TableCell className="whitespace-nowrap text-text-tertiary">
                    {formatDate(trade.executed_at, { timeZone: 'UTC' })}
                  </TableCell>
                  <TableCell className={cn('font-medium', typeColor[trade.trade_type])}>
                    {trade.trade_type}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="flex items-center -space-x-1.5">
                        <TokenIcon symbol={trade.input_token} className="size-4" />
                        <TokenIcon symbol={trade.output_token} className="size-4" />
                      </div>
                      <span>{trade.input_token}/{trade.output_token}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {trade.amount_in.toFixed(4)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    ${trade.price_at_execution.toFixed(4)}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status="success" label="Confirmed" />
                  </TableCell>
                  <TableCell className="text-right">
                    <SolscanLink signature={trade.transaction_signature} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {/* Fixed pagination footer slot */}
        <div className="h-9 flex items-center justify-center gap-2 border-t border-border-subtle/50 pt-2 shrink-0">
          {totalPages > 1 && !isLoading ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="h-7 text-xs"
              >
                Prev
              </Button>
              <span className="text-xs text-text-muted font-mono">{page + 1} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="h-7 text-xs"
              >
                Next
              </Button>
            </>
          ) : (
            <span className="text-xs text-text-muted/60 font-mono">
              {isLoading ? 'Loading records...' : `${filtered.length} total records`}
            </span>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
