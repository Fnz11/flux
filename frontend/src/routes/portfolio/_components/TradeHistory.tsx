import { useState } from 'react'
import type { ApiTrade, TradeType } from '@/types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SolscanLink } from '@/components/ui/SolscanLink'

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
    <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">Trade History</h3>
        <div className="flex gap-1 rounded-lg bg-bg-inset p-0.5">
          {(['All', 'Trades', 'Deposits', 'Withdrawals'] as FilterTab[]).map((tab) => (
            <Button
              key={tab}
              variant={activeFilter === tab ? 'default' : 'ghost'}
              size="sm"
              onClick={() => { setActiveFilter(tab); setPage(0) }}
            >
              {tab}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="mt-4 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="animate-pulse h-10 rounded-lg bg-bg-inset" />
          ))}
        </div>
      ) : paged.length === 0 ? (
        <p className="mt-8 text-center text-sm text-text-muted">No trades yet</p>
      ) : (
        <>
          <div className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Tx</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((trade) => (
                  <TableRow key={trade.id}>
                    <TableCell className="whitespace-nowrap text-text-tertiary">
                      {new Date(trade.executed_at).toLocaleDateString('en-US', { timeZone: 'UTC' })}
                    </TableCell>
                    <TableCell className={`font-medium ${typeColor[trade.trade_type]}`}>
                      {trade.trade_type}
                    </TableCell>
                    <TableCell className="font-mono">
                      {trade.input_token}/{trade.output_token}
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
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
              >
                Prev
              </Button>
              <span className="text-xs text-text-muted">{page + 1} / {totalPages}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
