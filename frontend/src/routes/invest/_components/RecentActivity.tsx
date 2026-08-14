import { useEffect, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useGlobalTransactionsQuery } from '@/services/hooks/useQuery/useGlobalTransactionsQuery'
import type { GlobalTransactionAction } from '@/services/apis/rest-api/transactions.service'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { cn } from '@/lib/utils'
import { useWebSocketStore } from '@/stores'

interface RecentActivityProps {
  wallet: string
}

const ACTION_META: Record<GlobalTransactionAction, { label: string; className: string }> = {
  deposit: { label: 'Deposit', className: 'bg-status-success/15 text-status-success border border-status-success/25' },
  withdraw: { label: 'Withdraw', className: 'bg-status-warn/15 text-status-warn border border-status-warn/25' },
  swap: { label: 'Swap', className: 'bg-status-info/15 text-status-info border border-status-info/25' },
}

const SKELETON_ROWS = 5

export function RecentActivity({ wallet }: RecentActivityProps) {
  const queryClient = useQueryClient()
  const onMessage = useWebSocketStore((s) => s.onMessage)
  const { data, isLoading, error } = useGlobalTransactionsQuery({ wallet })

  useEffect(() => {
    const unsubscribe = onMessage((msg) => {
      if (msg.type === 'trade_confirmed') {
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
      }
    })
    return unsubscribe
  }, [onMessage, queryClient])

  let content: ReactNode
  if (isLoading) {
    content = (
      <TableRowSkeleton
        columns={5}
        rows={SKELETON_ROWS}
        cellAligns={['left', 'left', 'left', 'right', 'right']}
        cellWidths={['w-28', 'w-16', 'w-24', 'w-20', 'w-12']}
      />
    )
  } else if (error) {
    content = (
      <TableRow className="hover:bg-transparent border-0">
        <TableCell colSpan={5} className="text-center py-8 text-status-error">
          Could not load recent activity. Please try again later.
        </TableCell>
      </TableRow>
    )
  } else if (!data || data.items.length === 0) {
    content = (
      <TableEmpty
        colSpan={5}
        title="No recent activity recorded"
        description="Deposits, withdrawals, and vault transactions will be logged here"
      />
    )
  } else {
    content = data.items.map((item) => {
      const meta = ACTION_META[item.action]
      return (
        <TableRow key={item.id}>
          <TableCell className="whitespace-nowrap text-text-tertiary">
            {new Date(item.executedAt).toLocaleString('en-US', { timeZone: 'UTC' })}
          </TableCell>
          <TableCell>
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                meta.className,
              )}
            >
              {meta.label}
            </span>
          </TableCell>
          <TableCell className="font-medium">{item.vaultName}</TableCell>
          <TableCell className="whitespace-nowrap text-right font-mono">
            ${item.amount.toLocaleString()} {item.symbol}
          </TableCell>
          <TableCell className="text-right">
            <SolscanLink signature={item.transactionSignature} />
          </TableCell>
        </TableRow>
      )
    })
  }

  return (
    <div className="rounded-xl border border-border-subtle/60 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Timestamp</TableHead>
            <TableHead>Action</TableHead>
            <TableHead>Vault</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead className="text-right">Tx</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{content}</TableBody>
      </Table>
    </div>
  )
}