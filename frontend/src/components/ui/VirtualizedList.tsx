import React, { useState, useMemo } from 'react'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface VirtualizedListProps<T> {
  items: T[]
  pageSize?: number
  renderItem: (item: T, index: number) => React.ReactNode
  keyExtractor: (item: T, index: number) => string
  emptyState?: React.ReactNode
  className?: string
  gridClassName?: string
  virtualizeThreshold?: number
}

export function VirtualizedList<T>({
  items,
  pageSize = 9,
  renderItem,
  keyExtractor,
  emptyState,
  className,
  gridClassName = 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3',
  virtualizeThreshold = 50,
}: VirtualizedListProps<T>) {
  const [currentPage, setCurrentPage] = useState(0)

  const totalPages = Math.max(1, Math.ceil((items?.length || 0) / Math.max(1, pageSize)))

  // Ensure current page stays within valid range when items filter changes
  const safePage = Math.max(0, Math.min(currentPage, totalPages - 1))

  const paginatedItems = useMemo(() => {
    const start = safePage * pageSize
    return (items || []).slice(start, start + pageSize)
  }, [items, safePage, pageSize])

  const isVirtualized = items.length >= virtualizeThreshold

  if (items.length === 0) {
    return <>{emptyState ?? null}</>
  }

  return (
    <div className={cn('space-y-4', className)}>
      {isVirtualized && (
        <div className="flex items-center justify-between rounded-xl bg-bg-elevated px-4 py-2 text-xs text-text-secondary border border-border-subtle">
          <span>Virtualized list enabled ({items.length} items)</span>
          <span>
            Showing {safePage * pageSize + 1} - {Math.min((safePage + 1) * pageSize, items.length)} of {items.length}
          </span>
        </div>
      )}

      <div className={gridClassName}>
        {paginatedItems.map((item, idx) => {
          const absoluteIndex = safePage * pageSize + idx
          return (
            <React.Fragment key={keyExtractor(item, absoluteIndex)}>
              {renderItem(item, absoluteIndex)}
            </React.Fragment>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between rounded-xl border border-border-subtle bg-bg-elevated p-3">
          <div className="text-xs text-text-muted">
            Page <span className="font-semibold text-text-primary">{safePage + 1}</span> of{' '}
            <span className="font-semibold text-text-primary">{totalPages}</span> ({items.length} total)
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
            >
              Previous
            </Button>

            <div className="hidden sm:flex gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i)}
                  className={cn(
                    'size-8 rounded-xl text-xs font-medium transition-colors',
                    i === safePage
                      ? 'bg-primary-coral text-black font-semibold'
                      : 'bg-bg-inset text-text-secondary hover:text-text-primary',
                  )}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={safePage >= totalPages - 1}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
