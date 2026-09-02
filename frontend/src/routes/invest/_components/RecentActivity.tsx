import { useState, useMemo, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useGlobalTransactionsQuery } from '@/services/hooks/useQuery/useGlobalTransactionsQuery'
import type { GlobalTransactionAction, GlobalTransaction, GlobalTransactionsResponse } from '@/services/apis/rest-api/transactions.service'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, SortableTableHead, Pagination } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { SolscanLink } from '@/components/ui/SolscanLink'
import { cn } from '@/lib/utils'
import { formatDateTime, formatNumber } from '@/lib/format'
import { useTableSort } from '@/hooks/useTableSort'
import { useRealtimeSync } from '@/hooks/useRealtimeSync'
import { activityHandler } from '@/services/ws/handlers/activityHandler'

interface RecentActivityProps {
  wallet: string
}

type ActivitySortColumn = 'executedAt' | 'action' | 'vaultName' | 'amount'

const ACTION_META: Record<GlobalTransactionAction, { label: string; className: string }> = {
  deposit: { label: 'Deposit', className: 'bg-status-info/15 text-status-info border border-status-info/25' },
  withdraw: { label: 'Withdraw', className: 'bg-status-purple/15 text-status-purple border border-status-purple/25' },
  swap: { label: 'Swap', className: 'bg-status-warn/15 text-status-warn border border-status-warn/25' },
}

const SKELETON_ROWS = 5

export function RecentActivity({ wallet }: RecentActivityProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(8)

  const { sortBy, sortOrder, handleSort } = useTableSort<ActivitySortColumn>({
    sortBy: 'executedAt',
    defaultOrder: 'desc',
    allowClear: true,
  })

  const { data, isLoading, error } = useGlobalTransactionsQuery({
    page,
    limit: pageSize,
    wallet,
  })

  // 200ms modular realtime batch sync
  useRealtimeSync({
    handlers: [activityHandler],
    walletAddress: wallet,
  })

  const sortedItems = useMemo(() => {
    const items = data?.items || []
    if (!sortBy || !sortOrder) return items

    return [...items].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortBy) {
        case 'executedAt': {
          const timeA = new Date(a.executedAt || 0).getTime()
          const timeB = new Date(b.executedAt || 0).getTime()
          aVal = isNaN(timeA) ? 0 : timeA
          bVal = isNaN(timeB) ? 0 : timeB
          break
        }
        case 'action':
          aVal = a.action.toLowerCase()
          bVal = b.action.toLowerCase()
          break
        case 'vaultName':
          aVal = (a.vaultName || '').toLowerCase()
          bVal = (b.vaultName || '').toLowerCase()
          break
        case 'amount':
          aVal = Number(a.amount || 0)
          bVal = Number(b.amount || 0)
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [data?.items, sortBy, sortOrder])

  const totalItems = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const displayedItems = sortedItems.slice(0, pageSize)

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
  } else if (!data || displayedItems.length === 0) {
    content = (
      <TableEmpty
        colSpan={5}
        title="No recent activity recorded"
        description="Deposits, withdrawals, and vault transactions will be logged here"
      />
    )
  } else {
    content = displayedItems.map((item) => {
      const meta = ACTION_META[item.action]
      const actionColor = item.action === 'deposit'
        ? 'text-status-info'
        : item.action === 'withdraw'
          ? 'text-status-purple'
          : 'text-status-warn'

      return (
        <TableRow key={item.id}>
          <TableCell className="whitespace-nowrap font-mono text-xs text-text-tertiary">
            {formatDateTime(item.executedAt, { utc: true })}
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
          <TableCell className="font-medium text-xs text-text-primary">{item.vaultName}</TableCell>
          <TableCell className={cn('whitespace-nowrap text-right font-mono font-medium', actionColor)}>
            ${formatNumber(item.amount)} {item.symbol}
          </TableCell>
          <TableCell className="text-right">
            <SolscanLink signature={item.transactionSignature} />
          </TableCell>
        </TableRow>
      )
    })
  }

  return (
    <Table
      containerClassName="min-h-[380px] max-h-[440px]"
      footer={
        <Pagination
          page={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          pageSizeOptions={[5, 8, 15, 30]}
          onPageChange={setPage}
          onPageSizeChange={(newSize: number) => {
            setPageSize(newSize)
            setPage(1)
          }}
          itemLabel="transactions"
          isLoading={isLoading}
        />
      }
    >
      <TableHeader>
        <TableRow>
          <SortableTableHead
            column="executedAt"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          >
            TIMESTAMP
          </SortableTableHead>
          <SortableTableHead
            column="action"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          >
            ACTION
          </SortableTableHead>
          <SortableTableHead
            column="vaultName"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          >
            VAULT
          </SortableTableHead>
          <SortableTableHead
            column="amount"
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            align="right"
          >
            AMOUNT
          </SortableTableHead>
          <TableHead className="text-right select-none">TX</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>{content}</TableBody>
    </Table>
  )
}