import { useEffect, useState, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableHeader, TableBody, TableRow, TableCell, TableEmpty, SortableTableHead, Pagination } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { cn } from '@/lib/utils'
import { useLeaderboardQuery } from '@/services/hooks/useQuery/useLeaderboardQuery'
import type { LeaderboardType } from '@/services/apis/rest-api/market.service'
import { useWebSocketStore } from '@/stores'
import { useTableSort } from '@/hooks/useTableSort'

function toNum(value: string): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatVolume(value: string): string {
  const n = toNum(value)
  if (n === null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatChange(value: number | null): string {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

type TokenSortColumn = 'name' | 'volume' | 'change'

export function LeaderboardWidget() {
  const [tab, setTab] = useState<LeaderboardType>('trending')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(5)

  const { sortBy, sortOrder, handleSort } = useTableSort<TokenSortColumn>({
    allowClear: true,
  })

  const queryClient = useQueryClient()
  const onMessage = useWebSocketStore((s) => s.onMessage)
  const { data: items = [], isLoading, isError } = useLeaderboardQuery(tab)

  useEffect(() => {
    const unsubscribe = onMessage((msg) => {
      if (msg.type === 'leaderboard_update') {
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
      }
    })
    return unsubscribe
  }, [onMessage, queryClient])

  const sortedItems = useMemo(() => {
    if (!sortBy || !sortOrder) return items

    return [...items].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortBy) {
        case 'name':
          aVal = (a.name || a.symbol || '').toLowerCase()
          bVal = (b.name || b.symbol || '').toLowerCase()
          break
        case 'volume':
          aVal = toNum(String(a.volume ?? '')) || 0
          bVal = toNum(String(b.volume ?? '')) || 0
          break
        case 'change':
          aVal = toNum(String(a.change ?? '')) || 0
          bVal = toNum(String(b.change ?? '')) || 0
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [items, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(sortedItems.length / pageSize))
  const pagedItems = sortedItems.slice((page - 1) * pageSize, page * pageSize)

  return (
    <SectionCard
      icon={<Trophy className="size-4 text-primary-gold" />}
      title="Top Tokens"
      description="Ranked volume and 24h gainers across ecosystem"
      className="h-full flex flex-col justify-between"
      rightContent={<span className="size-2 rounded-full bg-emerald-400 animate-pulse" />}
    >
      <div className="flex flex-col flex-1 min-h-0 gap-3">
        {/* Tab pills */}
        <div className="flex items-center gap-1 rounded-xl bg-bg-inset p-1 text-[11px] shrink-0">
          <button
            type="button"
            onClick={() => {
              setTab('trending')
              setPage(1)
            }}
            className={cn(
              'flex-1 rounded-lg py-1 font-medium transition-all cursor-pointer text-center',
              tab === 'trending' ? 'bg-bg-elevated text-text-primary shadow-xs font-semibold' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            Trending
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('gainers')
              setPage(1)
            }}
            className={cn(
              'flex-1 rounded-lg py-1 font-medium transition-all cursor-pointer text-center',
              tab === 'gainers' ? 'bg-bg-elevated text-text-primary shadow-xs font-semibold' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            Gainers
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('new')
              setPage(1)
            }}
            className={cn(
              'flex-1 rounded-lg py-1 font-medium transition-all cursor-pointer text-center',
              tab === 'new' ? 'bg-bg-elevated text-text-primary shadow-xs font-semibold' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            New
          </button>
        </div>

        {/* Unified Table with attached Footer Pagination */}
        <Table
          containerClassName="min-h-[260px] flex-1"
          footer={
            <Pagination
              page={page}
              totalPages={totalPages}
              totalItems={sortedItems.length}
              pageSize={pageSize}
              pageSizeOptions={[5, 10, 20]}
              onPageChange={setPage}
              onPageSizeChange={(newSize: number) => {
                setPageSize(newSize)
                setPage(1)
              }}
              itemLabel="tokens"
              isLoading={isLoading}
            />
          }
        >
          <TableHeader>
            <TableRow>
              <SortableTableHead
                column="name"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                className="py-2.5 px-3"
              >
                NAME
              </SortableTableHead>
              <SortableTableHead
                column="volume"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-2.5 px-3"
              >
                VOLUME
              </SortableTableHead>
              <SortableTableHead
                column="change"
                sortBy={sortBy}
                sortOrder={sortOrder}
                onSort={handleSort}
                align="right"
                className="py-2.5 px-3"
              >
                CHANGE
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRowSkeleton
                columns={3}
                rows={5}
                cellAligns={['left', 'right', 'right']}
                cellWidths={['w-28', 'w-16', 'w-14']}
              />
            ) : isError || sortedItems.length === 0 ? (
              <TableEmpty
                colSpan={3}
                title="No tokens found"
                description="Token data will appear here"
                minHeight="min-h-[200px]"
              />
            ) : (
              pagedItems.map((item) => {
                const changeNum = toNum(String(item.change ?? ''))
                const isPositive = changeNum !== null && changeNum >= 0
                const colorClass = changeNum === null ? 'text-text-primary' : isPositive ? 'text-status-success' : 'text-status-error'

                return (
                  <TableRow key={`${item.rank}-${item.symbol}`} className="hover:bg-white/[0.02]">
                    <TableCell className="py-2.5 px-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-6 shrink-0">
                          {item.icon ? (
                            <AvatarImage src={item.icon} alt={item.symbol} />
                          ) : null}
                          <AvatarFallback seed={item.symbol} className="text-[10px] bg-bg-inset text-text-secondary border-0">
                            {item.symbol.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-[12px] truncate text-text-primary">{item.name}</span>
                          <span className="text-[10px] text-text-tertiary">{item.tag}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="py-2.5 px-3 text-right font-mono text-xs text-text-secondary">
                      {formatVolume(String(item.volume ?? ''))}
                    </TableCell>
                    <TableCell
                      className={cn(
                        'py-2.5 px-3 text-right font-mono text-xs font-semibold',
                        colorClass,
                      )}
                    >
                      {formatChange(changeNum)}
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