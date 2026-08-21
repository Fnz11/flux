import { useEffect, useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, SortableTableHead, Pagination } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { useWebSocketStore } from '@/stores'
import { useTableSort } from '@/hooks/useTableSort'
import * as tradeService from '@/services/apis/rest-api/trade.service'
import type { ApiTrade } from '@/types'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { ArrowUpDown, ArrowRight, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDateTime } from '@/lib/format'

export interface VaultTradesTabProps {
  vaultId: string
  isManager?: boolean
}

type TradeSortColumn = 'executed_at' | 'trade_type' | 'amount_in' | 'amount_out' | 'price_at_execution'

export function VaultTradesTab({ vaultId, isManager }: VaultTradesTabProps) {
  const [trades, setTrades] = useState<ApiTrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const { sortBy, sortOrder, handleSort } = useTableSort<TradeSortColumn>({
    sortBy: 'executed_at',
    defaultOrder: 'desc',
    allowClear: true,
  })

  const subscribe = useWebSocketStore((s) => s.subscribe)
  const unsubscribe = useWebSocketStore((s) => s.unsubscribe)
  const onMessage = useWebSocketStore((s) => s.onMessage)

  useEffect(() => {
    setIsLoading(true)
    tradeService
      .getHistory(vaultId)
      .then((res) => setTrades(res.trades || []))
      .catch(() => setTrades([]))
      .finally(() => setIsLoading(false))

    subscribe(`vault:${vaultId}`)

    const unsub = onMessage((msg) => {
      if (!msg) return
      const raw = msg as unknown as Record<string, unknown>
      const eventType = String(raw.type || raw.event || '')
      if (
        eventType === 'trade_confirmed' ||
        eventType === 'TRADE_EXECUTED' ||
        eventType === 'trade_created' ||
        eventType === 'TRADE_CONFIRMED'
      ) {
        const payload = (raw.data || raw.payload || raw) as Record<string, unknown>
        const targetVaultId = payload.vault_id || payload.vaultId || raw.vault_id || raw.vaultId
        if (!targetVaultId || targetVaultId === vaultId) {
          tradeService
            .getHistory(vaultId)
            .then((res) => {
              if (res?.trades) setTrades(res.trades)
            })
            .catch(() => {})
        }
      }
    })

    return () => {
      unsub()
      unsubscribe(`vault:${vaultId}`)
    }
  }, [vaultId, subscribe, unsubscribe, onMessage])

  const sortedTrades = useMemo(() => {
    return [...trades].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortBy) {
        case 'executed_at':
          aVal = new Date(a.executed_at).getTime()
          bVal = new Date(b.executed_at).getTime()
          break
        case 'trade_type':
          aVal = a.trade_type || ''
          bVal = b.trade_type || ''
          break
        case 'amount_in':
          aVal = a.amount_in || 0
          bVal = b.amount_in || 0
          break
        case 'amount_out':
          aVal = a.amount_out || 0
          bVal = b.amount_out || 0
          break
        case 'price_at_execution':
          aVal = a.price_at_execution || 0
          bVal = b.price_at_execution || 0
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [trades, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(sortedTrades.length / pageSize))
  const pagedTrades = sortedTrades.slice((page - 1) * pageSize, page * pageSize)

  return (
    <SectionCard
      icon={<ArrowUpDown className="size-4 text-primary-coral" />}
      title={
        <div className="flex items-center gap-2">
          <span>Executed Strategy Trades</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-status-success/15 px-2 py-0.5 text-[10px] font-medium text-status-success">
            <Radio className="size-2.5 animate-pulse" /> Live Feed
          </span>
        </div>
      }
      description="On-chain DEX swaps and rebalances recorded on Solana."
      rightContent={
        isManager ? (
          <Link to="/trade" search={{ vaultId }}>
            <SweepButton className="h-8 text-xs font-semibold">
              <span>Execute New Trade</span>
              <ArrowRight className="ml-1.5 size-3.5" />
            </SweepButton>
          </Link>
        ) : null
      }
    >
        <Table
          className="min-w-[700px]"
          footer={
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={sortedTrades.length}
              pageSize={pageSize}
              pageSizeOptions={[5, 10, 20, 50]}
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
                currentSort={sortBy}
                currentOrder={sortOrder}
                onSort={handleSort}
                className="py-3 px-4"
              >
                Date & Time
              </SortableTableHead>
              <SortableTableHead
                column="trade_type"
                currentSort={sortBy as any}
                currentOrder={sortOrder}
                onSort={handleSort}
                className="py-3 px-4"
              >
                Type
              </SortableTableHead>
              <TableHead className="py-3 px-4">Pair</TableHead>
              <SortableTableHead
                column="amount_in"
                currentSort={sortBy as any}
                currentOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-3 px-4"
              >
                In Amount
              </SortableTableHead>
              <SortableTableHead
                column="amount_out"
                currentSort={sortBy as any}
                currentOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-3 px-4"
              >
                Out Amount
              </SortableTableHead>
              <SortableTableHead
                column="price_at_execution"
                currentSort={sortBy as any}
                currentOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-3 px-4"
              >
                Price
              </SortableTableHead>
              <TableHead className="py-3 px-4 text-right">Transaction</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRowSkeleton
                  key={i}
                  columns={7}
                  rows={1}
                  cellAligns={['left', 'left', 'left', 'right', 'right', 'right', 'right']}
                  cellWidths={['w-28', 'w-12', 'w-24', 'w-16', 'w-16', 'w-16', 'w-12']}
                />
              ))
            ) : pagedTrades.length === 0 ? (
              <TableEmpty
                colSpan={7}
                icon={<ArrowUpDown className="size-5" />}
                title="No trades recorded yet"
                description="Automated and manual trades executed by the manager will be recorded here in real-time."
                minHeight="min-h-[200px]"
              />
            ) : (
              pagedTrades.map((t) => {
                const typeLower = t.trade_type?.toLowerCase()
                const isBuy = typeLower === 'buy'
                const isSell = typeLower === 'sell'
                const isDeposit = typeLower === 'deposit'
                const isWithdraw = typeLower === 'withdraw'

                const actionColor = isBuy
                  ? 'text-status-success'
                  : isSell
                    ? 'text-status-error'
                    : isDeposit
                      ? 'text-status-info'
                      : isWithdraw
                        ? 'text-status-purple'
                        : 'text-text-primary'

                const badgeClass = isBuy
                  ? 'bg-status-success/15 text-status-success border border-status-success/25'
                  : isSell
                    ? 'bg-status-error/15 text-status-error border border-status-error/25'
                    : isDeposit
                      ? 'bg-status-info/15 text-status-info border border-status-info/25'
                      : isWithdraw
                        ? 'bg-status-purple/15 text-status-purple border border-status-purple/25'
                        : 'bg-bg-inset text-text-secondary'

                const dateStr = formatDateTime(t.executed_at)
                const tokenIn = (t as any).token_in_symbol || t.input_token || ''
                const tokenOut = (t as any).token_out_symbol || t.output_token || ''
                const signature = (t as any).tx_signature || t.transaction_signature || ''
                return (
                  <TableRow key={t.id} className="hover:bg-white/[0.02]">
                    <TableCell className="py-3 px-4 font-mono text-xs whitespace-nowrap text-text-secondary">
                      {dateStr}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <span
                        className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold',
                          badgeClass,
                        )}
                      >
                        {t.trade_type}
                      </span>
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex items-center gap-1.5">
                        <TokenIcon symbol={tokenIn} className="size-4" />
                        <span className="font-mono text-xs font-semibold text-text-primary">
                          {tokenIn}
                        </span>
                        <span className="text-text-muted text-xs">→</span>
                        <TokenIcon symbol={tokenOut} className="size-4" />
                        <span className="font-mono text-xs font-semibold text-text-primary">
                          {tokenOut}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className={cn('py-3 px-4 text-right font-mono text-xs font-medium', actionColor)}>
                      {t.amount_in} {tokenIn}
                    </TableCell>
                    <TableCell className={cn('py-3 px-4 text-right font-mono text-xs font-semibold', actionColor)}>
                      {Number(t.amount_out || 0).toFixed(4)} {tokenOut}
                    </TableCell>
                    <TableCell className={cn('py-3 px-4 text-right font-mono text-xs font-medium', actionColor)}>
                      ${Number(t.price_at_execution || 0).toFixed(4)}
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <SolscanLink signature={signature} />
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
