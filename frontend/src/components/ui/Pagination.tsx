import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

export interface PaginationProps {
  /** 1-indexed current page number */
  page: number
  /** Total number of pages */
  totalPages: number
  /** Total number of records/items */
  totalItems?: number
  /** Number of items displayed per page */
  pageSize?: number
  /** Available page size options in the dropdown */
  pageSizeOptions?: number[]
  /** Callback fired when page number changes (1-indexed) */
  onPageChange: (newPage: number) => void
  /** Callback fired when page size changes */
  onPageSizeChange?: (newPageSize: number) => void
  /** Label describing item type (e.g., 'records', 'trades', 'vaults') */
  itemLabel?: string
  className?: string
  /** Whether data is currently loading */
  isLoading?: boolean
}

/**
 * Generates an array of page numbers and ellipsis indicators for pagination UI.
 * Example: [1, 2, 3, 4, '...', 99] or [1, '...', 4, 5, 6, '...', 99]
 */
function getPaginationRange(currentPage: number, totalPages: number, siblingCount = 1): (number | string)[] {
  const totalPageNumbers = siblingCount + 5 // siblings + first + last + current + 2 ellipses

  // If total pages is less than page numbers we want to show, display all
  if (totalPages <= totalPageNumbers) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages)

  const shouldShowLeftDots = leftSiblingIndex > 2
  const shouldShowRightDots = rightSiblingIndex < totalPages - 2

  const firstPageIndex = 1
  const lastPageIndex = totalPages

  // Case 1: No left dots to show, but right dots to be shown
  if (!shouldShowLeftDots && shouldShowRightDots) {
    const leftItemCount = 3 + 2 * siblingCount
    const leftRange = Array.from({ length: leftItemCount }, (_, i) => i + 1)
    return [...leftRange, '...', totalPages]
  }

  // Case 2: No right dots to show, but left dots to be shown
  if (shouldShowLeftDots && !shouldShowRightDots) {
    const rightItemCount = 3 + 2 * siblingCount
    const rightRange = Array.from(
      { length: rightItemCount },
      (_, i) => totalPages - rightItemCount + i + 1
    )
    return [firstPageIndex, '...', ...rightRange]
  }

  // Case 3: Both left and right dots to be shown
  if (shouldShowLeftDots && shouldShowRightDots) {
    const middleRange = Array.from(
      { length: rightSiblingIndex - leftSiblingIndex + 1 },
      (_, i) => leftSiblingIndex + i
    )
    return [firstPageIndex, '...', ...middleRange, '...', lastPageIndex]
  }

  return Array.from({ length: totalPages }, (_, i) => i + 1)
}

export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize = 10,
  pageSizeOptions = [5, 8, 15, 30],
  onPageChange,
  onPageSizeChange,
  itemLabel = 'records',
  className,
  isLoading = false,
}: PaginationProps) {
  // If no items and totalPages <= 1, show compact state
  if (totalPages <= 1 && (!totalItems || totalItems === 0)) {
    return null
  }

  // Calculate record display range (e.g. 1-10 of 99)
  const startItem = totalItems && totalItems > 0 ? (page - 1) * pageSize + 1 : 0
  const endItem = totalItems ? Math.min(page * pageSize, totalItems) : 0

  const paginationRange = getPaginationRange(page, totalPages)

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-3 w-full px-3.5 py-2.5 border-t border-border-subtle/60 bg-[#16161b]/95 backdrop-blur-md text-xs text-text-secondary select-none shrink-0',
        className
      )}
    >
      {/* Left side: Page size dropdown selector + Record counts */}
      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
        {onPageSizeChange && pageSizeOptions.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-text-muted text-[11px] font-medium tracking-wider">SHOW</span>
            <Select
              value={String(pageSize)}
              onValueChange={(val) => onPageSizeChange(Number(val))}
              disabled={isLoading}
            >
              <SelectTrigger className="h-7.5 w-16 px-2 py-0.5 rounded-lg border border-white/10 bg-bg-inset/90 text-text-primary text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary-coral hover:border-white/20 cursor-pointer shadow-xs">
                <SelectValue placeholder={String(pageSize)} />
              </SelectTrigger>
              <SelectContent
                align="start"
                className="min-w-[4.5rem] rounded-xl border border-white/12 bg-bg-elevated/98 p-1 text-text-primary shadow-2xl backdrop-blur-xl"
              >
                {pageSizeOptions.map((opt) => (
                  <SelectItem
                    key={opt}
                    value={String(opt)}
                    className="rounded-lg text-xs font-mono cursor-pointer py-1 pl-6 pr-2 focus:bg-primary-coral/15 focus:text-primary-coral"
                  >
                    {opt}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {totalItems !== undefined && (
          <div className="text-text-muted font-mono text-[11px]">
            {totalItems > 0 ? (
              <span>
                Showing <span className="text-text-primary">{startItem}–{endItem}</span> of{' '}
                <span className="text-text-primary">{totalItems}</span> {itemLabel}
              </span>
            ) : (
              <span>0 {itemLabel}</span>
            )}
          </div>
        )}
      </div>

      {/* Right side: [ < ] [ 1 ] [ 2 ] ... [ 99 ] [ > ] */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5 w-full sm:w-auto justify-center sm:justify-end overflow-x-auto no-scrollbar">
          {/* Prev icon button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1 || isLoading}
            aria-label="Previous page"
            className="size-7.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] hover:text-text-primary text-text-secondary disabled:opacity-25 disabled:hover:bg-white/[0.02] transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <ChevronLeft className="size-4" />
          </button>

          {/* Numbered page pills */}
          <div className="flex items-center gap-1.5 mx-0.5">
            {paginationRange.map((pageNumber, idx) => {
              if (pageNumber === '...') {
                return (
                  <span
                    key={`dots-${idx}`}
                    className="w-5 text-center text-text-muted font-mono text-xs select-none"
                  >
                    &#8230;
                  </span>
                )
              }

              const isCurrent = pageNumber === page
              return (
                <button
                  key={`page-${pageNumber}`}
                  type="button"
                  onClick={() => onPageChange(Number(pageNumber))}
                  disabled={isLoading || isCurrent}
                  className={cn(
                    'size-7.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center justify-center cursor-pointer shrink-0',
                    isCurrent
                      ? 'bg-primary-coral text-white font-bold shadow-[0_0_12px_rgba(255,107,74,0.35)] border border-primary-coral'
                      : 'border border-white/8 bg-white/[0.02] text-text-secondary hover:bg-white/[0.08] hover:text-text-primary hover:border-white/15'
                  )}
                >
                  {pageNumber}
                </button>
              )
            })}
          </div>

          {/* Next icon button */}
          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages || isLoading}
            aria-label="Next page"
            className="size-7.5 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.08] hover:text-text-primary text-text-secondary disabled:opacity-25 disabled:hover:bg-white/[0.02] transition-all flex items-center justify-center cursor-pointer disabled:cursor-not-allowed shrink-0"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
