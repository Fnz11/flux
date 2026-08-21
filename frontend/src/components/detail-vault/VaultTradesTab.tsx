import { useEffect, useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, SortableTableHead } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { useWebSocketStore } from '@/stores'
import { useTableSort } from '@/hooks/useTableSort'
import * as tradeService from '@/services/apis/rest-api/trade.service'
import type { ApiTrade, WsTradeConfirmedData } from '@/types'
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
  const { sortBy, sortOrder, handleSort } = useTableSort<TradeSortColumn>({
    sortBy: 'executed_at',
    defaultOrder: 'desc',
    allowClear: false,
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
      const raw = msg as Record<string, unknown>
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
      <Table className="min-w-[700px]">
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="executed_at"
              currentSort={sortBy}
              currentOrder={sortOrder}
              onSort={handleSort}
              className="py-3 px-4"
            >
              TIMESTAMP
            </SortableTableHead>
            <SortableTableHead
              column="trade_type"
              currentSort={sortBy as any}
              currentOrder={sortOrder}
              onSort={handleSort}
              className="py-3 px-4"
            >
              TYPE
            </SortableTableHead>
            <TableHead className="py-3 px-4">PAIR</TableHead>
            <SortableTableHead
              column="amount_in"
              currentSort={sortBy as any}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
              className="py-3 px-4"
            >
              AMOUNT IN
            </SortableTableHead>
            <SortableTableHead
              column="amount_out"
              currentSort={sortBy as any}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
              className="py-3 px-4"
            >
              AMOUNT OUT
            </SortableTableHead>
            <SortableTableHead
              column="price_at_execution"
              currentSort={sortBy as any}
              currentOrder={sortOrder}
              onSort={handleSort}
              align="right"
              className="py-3 px-4"
            >
              PRICE
            </SortableTableHead>
            <TableHead className="py-3 px-4 text-right">TX DETAILS</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <TableRowSkeleton key={i} columns={7} />
            ))
          ) : sortedTrades.length === 0 ? (
            <TableEmpty
              colSpan={7}
              icon={<ArrowUpDown className="size-5" />}
              title="No trades recorded yet"
              description="Automated and manual trades executed by the manager will be recorded here in real-time."
              minHeight="min-h-[200px]"
            />
          ) : (
            sortedTrades.map((t) => {
              const isBuy = t.trade_type?.toLowerCase() === 'buy'
              const dateStr = formatDateTime(t.executed_at)
              const tokenIn = (t as any).token_in_symbol || t.input_token || ''
              const tokenOut = (t as any).token_out_symbol || t.output_token || ''
              const signature = (t as any).tx_signature || t.transaction_signature || ''
              return (
                <TableRow key={t.id} className="hover:bg-white/[0.02]">
                  <TableCell className="py-3 px-4 font-mono text-xs text-text-secondary whitespace-nowrap">
                    {dateStr}
                  </TableCell>
                  <TableCell className="py-3 px-4">
                    <span
                      className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold',
                        isBuy ? 'bg-status-success/15 text-status-success' : 'bg-primary-coral/15 text-primary-coral',
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
                  <TableCell className="py-3 px-4 text-right font-mono text-xs text-text-secondary font-medium">
                    {t.amount_in} {tokenIn}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-right font-mono text-xs font-semibold text-text-primary">
                    {Number(t.amount_out.toFixed(4))} {tokenOut}
                  </TableCell>
                  <TableCell className="py-3 px-4 text-right font-mono text-xs text-text-tertiary">
                    ${Number(t.price_at_execution.toFixed(4))}
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
