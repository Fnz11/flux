import { useEffect, useState, useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { useWebSocketStore } from '@/stores'
import * as tradeService from '@/services/apis/rest-api/trade.service'
import type { ApiTrade, WsTradeConfirmedData } from '@/types'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { ArrowUpDown, ArrowUp, ArrowDown, ArrowRight, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VaultTradesTabProps {
  vaultId: string
}

type TradeSortColumn = 'executed_at' | 'trade_type' | 'amount_in' | 'amount_out' | 'price_at_execution'

export function VaultTradesTab({ vaultId }: VaultTradesTabProps) {
  const [trades, setTrades] = useState<ApiTrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortBy, setSortBy] = useState<TradeSortColumn>('executed_at')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

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
      if ((msg.type as string) === 'trade_confirmed' || msg.type === 'TRADE_EXECUTED') {
        const msgObj = msg as unknown as { data?: WsTradeConfirmedData; vault_id?: string; vaultId?: string }
        const data = msgObj?.data ?? msgObj
        if (data?.vault_id === vaultId || (data as { vaultId?: string })?.vaultId === vaultId) {
          tradeService.getHistory(vaultId).then((res) => setTrades(res.trades || []))
        }
      }
    })

    return () => {
      unsub()
      unsubscribe(`vault:${vaultId}`)
    }
  }, [vaultId, subscribe, unsubscribe, onMessage])

  const handleSort = (column: TradeSortColumn) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortBy(column)
      setSortOrder('desc')
    }
  }

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
          aVal = (a.trade_type || '').toLowerCase()
          bVal = (b.trade_type || '').toLowerCase()
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

  const renderSortIcon = (column: TradeSortColumn) => {
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
      icon={<ArrowUpDown className="size-4 text-primary-coral" />}
      title={
        <div className="flex items-center gap-2">
          <span>Executed Trades & Swaps</span>
          <span className="flex items-center gap-1 rounded-full bg-status-success/10 px-2 py-0.5 text-[10px] font-medium text-status-success border border-status-success/20">
            <Radio className="size-2.5" />
            Live Feed
          </span>
        </div>
      }
      description="Real-time on-chain DEX swaps and trade execution log via Pyth Oracle."
      rightContent={
        <Link to="/trade" search={{ vaultId }}>
          <SweepButton className="h-8 text-xs">
            <span className="flex items-center gap-1.5">
              Open Trade Console <ArrowRight className="size-3" />
            </span>
          </SweepButton>
        </Link>
      }
    >
      <div className="overflow-hidden rounded-xl border border-white/8 bg-bg-surface/40">
        <Table>
          <TableHeader>
            <TableRow className="border-b border-border-subtle/50 bg-bg-inset/60 select-none">
              <TableHead
                onClick={() => handleSort('executed_at')}
                className={cn(
                  'group cursor-pointer py-3.5 px-4 text-xs font-semibold transition-colors',
                  sortBy === 'executed_at' ? 'text-primary-coral' : 'hover:text-text-primary'
                )}
              >
                <div className="flex items-center">
                  DATE {renderSortIcon('executed_at')}
                </div>
              </TableHead>

              <TableHead
                onClick={() => handleSort('trade_type')}
                className={cn(
                  'group cursor-pointer py-3.5 px-4 text-xs font-semibold transition-colors',
                  sortBy === 'trade_type' ? 'text-primary-coral' : 'hover:text-text-primary'
                )}
              >
                <div className="flex items-center">
                  TYPE {renderSortIcon('trade_type')}
                </div>
              </TableHead>

              <TableHead
                onClick={() => handleSort('amount_in')}
                className={cn(
                  'group cursor-pointer py-3.5 px-4 text-xs font-semibold transition-colors',
                  sortBy === 'amount_in' ? 'text-primary-coral' : 'hover:text-text-primary'
                )}
              >
                <div className="flex items-center">
                  INPUT {renderSortIcon('amount_in')}
                </div>
              </TableHead>

              <TableHead
                onClick={() => handleSort('amount_out')}
                className={cn(
                  'group cursor-pointer py-3.5 px-4 text-xs font-semibold transition-colors',
                  sortBy === 'amount_out' ? 'text-primary-coral' : 'hover:text-text-primary'
                )}
              >
                <div className="flex items-center">
                  OUTPUT {renderSortIcon('amount_out')}
                </div>
              </TableHead>

              <TableHead
                onClick={() => handleSort('price_at_execution')}
                className={cn(
                  'group cursor-pointer py-3.5 px-4 text-right text-xs font-semibold transition-colors',
                  sortBy === 'price_at_execution' ? 'text-primary-coral' : 'hover:text-text-primary'
                )}
              >
                <div className="flex items-center justify-end">
                  PRICE {renderSortIcon('price_at_execution')}
                </div>
              </TableHead>

              <TableHead className="py-3.5 px-4 text-right text-xs font-semibold select-none">
                EXPLORER
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRowSkeleton
                columns={6}
                rows={5}
                cellAligns={['left', 'left', 'left', 'left', 'right', 'right']}
                cellWidths={['w-24', 'w-14', 'w-24', 'w-24', 'w-16', 'w-14']}
              />
            ) : sortedTrades.length === 0 ? (
              <TableEmpty
                colSpan={6}
                title="No trades recorded yet"
                description="Trades executed on this vault via Pyth AMM will appear here in real-time."
              />
            ) : (
              sortedTrades.map((t) => {
                const isBuy = t.trade_type === 'Buy' || t.trade_type === 'Deposit'
                return (
                  <TableRow key={t.id} className="border-b border-border-subtle/40 hover:bg-bg-inset/30 transition-colors">
                    <TableCell className="whitespace-nowrap font-mono text-xs text-text-tertiary py-3.5 px-4">
                      {new Date(t.executed_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </TableCell>
                    <TableCell className="py-3.5 px-4">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold border',
                          isBuy
                            ? 'bg-status-success/10 text-status-success border-status-success/20'
                            : 'bg-status-error/10 text-status-error border-status-error/20'
                        )}
                      >
                        {t.trade_type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <TokenIcon symbol={t.input_token} className="size-3.5" />
                        <span className="font-medium text-text-primary">
                          {t.amount_in} {t.input_token}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs py-3.5 px-4">
                      <span className="inline-flex items-center gap-1.5">
                        <TokenIcon symbol={t.output_token} className="size-3.5" />
                        <span className="font-medium text-text-primary">
                          {t.amount_out.toFixed(4)} {t.output_token}
                        </span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-text-primary py-3.5 px-4">
                      ${t.price_at_execution.toFixed(4)}
                    </TableCell>
                    <TableCell className="text-right py-3.5 px-4">
                      <SolscanLink signature={t.transaction_signature} />
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
