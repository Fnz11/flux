import { useEffect, useState } from 'react'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { useWebSocketStore } from '@/stores'
import * as tradeService from '@/services/apis/rest-api/trade.service'
import type { ApiTrade, WsTradeConfirmedData } from '@/types'
import { cn } from '@/lib/utils'

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

    subscribe(`vault:${vaultId}`)

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
      unsubscribe(`vault:${vaultId}`)
    }
  }, [vaultId, subscribe, unsubscribe, onMessage])

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated/40">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Input</TableHead>
            <TableHead>Output</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead>Tx</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={6}>
                  <div className="h-5 w-full animate-pulse rounded bg-bg-inset" />
                </TableCell>
              </TableRow>
            ))
          ) : trades.length === 0 ? (
            <TableEmpty
              colSpan={6}
              title="No trades recorded yet"
              description="Trades executed on this vault will appear here in real-time"
            />
          ) : (
            trades.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="whitespace-nowrap text-text-tertiary">
                  {new Date(t.executed_at).toLocaleDateString()}
                </TableCell>
                <TableCell className={cn('font-medium', t.trade_type === 'Buy' ? 'text-status-success' : 'text-status-error')}>
                  {t.trade_type}
                </TableCell>
                <TableCell className="font-mono text-xs">{t.amount_in} {t.input_token}</TableCell>
                <TableCell className="font-mono text-xs">{t.amount_out.toFixed(4)} {t.output_token}</TableCell>
                <TableCell className="text-right font-mono text-xs">${t.price_at_execution.toFixed(4)}</TableCell>
                <TableCell>
                  <SolscanLink signature={t.transaction_signature} />
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
