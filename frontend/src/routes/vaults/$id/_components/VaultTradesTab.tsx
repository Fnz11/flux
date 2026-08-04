import { useEffect, useState } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { useWebSocketStore } from '@/stores'
import * as tradeService from '@/services/apis/rest-api/trade.service'
import type { ApiTrade, WsTradeConfirmedData } from '@/types'

interface VaultTradesTabProps {
  vaultId: string
}

export function VaultTradesTab({ vaultId }: VaultTradesTabProps) {
  const [trades, setTrades] = useState<ApiTrade[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const subscribe = useWebSocketStore((s) => s.subscribe)
  const unsubscribe = useWebSocketStore((s) => s.unsubscribe)
  const onMessage = useWebSocketStore((s) => s.onMessage)

  useEffect(() => {
    setIsLoading(true)
    tradeService
      .getHistory(vaultId)
      .then((res) => setTrades(res.trades))
      .catch(() => setTrades([]))
      .finally(() => setIsLoading(false))

    subscribe(vaultId)

    const unsub = onMessage((msg) => {
      if ((msg.type as string) === 'trade_confirmed' || msg.type === 'TRADE_EXECUTED') {
        const data = (msg as unknown as { data: WsTradeConfirmedData }).data
        if (data.vault_id === vaultId) {
          tradeService.getHistory(vaultId).then((res) => setTrades(res.trades))
        }
      }
    })

    return () => {
      unsub()
      unsubscribe(vaultId)
    }
  }, [vaultId, subscribe, unsubscribe, onMessage])

  if (isLoading) return <LoadingSkeleton lines={5} />

  if (trades.length === 0) {
    return <EmptyState title="No trades yet" description="Trades will appear here once executed." />
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-elevated">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Price</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>TX</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {trades.map((trade) => {
            const typeColor =
              trade.trade_type === 'Buy'
                ? 'text-status-success'
                : trade.trade_type === 'Sell'
                  ? 'text-status-error'
                  : 'text-text-primary'
            return (
              <TableRow key={trade.id}>
                <TableCell>{new Date(trade.executed_at).toLocaleDateString()}</TableCell>
                <TableCell>
                  <span className={`font-medium ${typeColor}`}>
                    {trade.trade_type}
                  </span>
                </TableCell>
                <TableCell className="font-mono text-xs">{trade.input_token}/{trade.output_token}</TableCell>
                <TableCell className="font-mono">{trade.amount_in.toFixed(4)}</TableCell>
                <TableCell className="font-mono">${trade.price_at_execution.toFixed(6)}</TableCell>
                <TableCell>
                  <StatusBadge status="success" />
                </TableCell>
                <TableCell>
                  <SolscanLink signature={trade.transaction_signature} />
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
