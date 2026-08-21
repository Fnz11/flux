import * as React from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmptyState, type EmptyStateSize } from './EmptyState'
import { Pagination, type PaginationProps } from './Pagination'

export interface TableProps extends React.HTMLAttributes<HTMLTableElement> {
  containerClassName?: string
  containerRef?: React.Ref<HTMLDivElement>
  footer?: React.ReactNode
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, containerClassName, containerRef, footer, children, ...props }, ref) => (
    <div
      className={cn(
        'relative w-full rounded-xl border border-border-subtle/60 bg-bg-inset/20 flex flex-col min-h-0 flex-1 overflow-hidden',
        containerClassName,
      )}
    >
      <div ref={containerRef} className="relative w-full overflow-auto flex-1 min-h-0">
        <table ref={ref} className={cn('w-full caption-bottom text-sm border-collapse', className)} {...props}>
          {children}
        </table>
      </div>
      {footer}
    </div>
  ),
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead
    ref={ref}
    className={cn('sticky top-0 z-10 border-b border-border-subtle/60 bg-[#16161b]', className)}
    {...props}
  />
))
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn(className)} {...props} />
))
TableBody.displayName = 'TableBody'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'transition-colors even:bg-white/[0.01] odd:bg-transparent hover:!bg-white/[0.03] data-[state=selected]:bg-bg-inset',
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn('h-10 px-4 text-left align-middle font-medium text-text-muted text-[11px] uppercase tracking-wider', className)}
    {...props}
  />
))
TableHead.displayName = 'TableHead'

interface SortIconProps {
  active?: boolean
  direction?: 'asc' | 'desc'
  className?: string
}

function SortIcon({ active, direction, className }: SortIconProps) {
  if (!active || !direction) {
    return (
      <ArrowUpDown
        aria-hidden="true"
        className={cn('ml-1 inline-block size-3.5 opacity-40 group-hover:opacity-100 transition-opacity', className)}
      />
    )
  }
  return direction === 'asc' ? (
    <ArrowUp aria-hidden="true" className={cn('ml-1 inline-block size-3.5 text-primary-coral', className)} />
  ) : (
    <ArrowDown aria-hidden="true" className={cn('ml-1 inline-block size-3.5 text-primary-coral', className)} />
  )
}

interface SortableTableHeadProps<T extends string = string>
  extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, 'onClick'> {
  column: T
  sortBy?: string
  currentSort?: string
  sortOrder?: 'asc' | 'desc'
  currentOrder?: 'asc' | 'desc'
  onSort: (column: T) => void
  align?: 'left' | 'right' | 'center'
  children: React.ReactNode
}

function SortableTableHead<T extends string = string>({
  column,
  sortBy,
  currentSort,
  sortOrder,
  currentOrder,
  onSort,
  align = 'left',
  className,
  children,
  ...props
}: SortableTableHeadProps<T>) {
  const activeSort = sortBy ?? currentSort
  const activeOrder = sortOrder ?? currentOrder
  const isSorted = activeSort === column && Boolean(activeOrder)
  const ariaSort = isSorted ? (activeOrder === 'asc' ? 'ascending' : 'descending') : undefined

  return (
    <TableHead
      aria-sort={ariaSort}
      role="columnheader"
      tabIndex={0}
      onClick={() => onSort(column)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSort(column)
        }
      }}
      className={cn(
        'group cursor-pointer select-none transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary-coral/50',
        isSorted ? 'text-primary-coral font-medium' : 'hover:text-text-primary',
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          'flex items-center gap-1.5',
          align === 'right' && 'justify-end',
          align === 'center' && 'justify-center',
        )}
      >
        <span>{children}</span>
        <SortIcon active={isSorted} direction={isSorted ? activeOrder : undefined} />
      </div>
    </TableHead>
  )
}

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn('p-3.5 align-middle text-xs', className)} {...props} />
))
TableCell.displayName = 'TableCell'

interface TableEmptyProps {
  colSpan: number
  title?: string
  description?: string
  icon?: React.ReactNode
  size?: EmptyStateSize
  minHeight?: string
  className?: string
  action?: React.ReactNode
}

function TableEmpty({
  colSpan,
  title = 'No records found',
  description,
  icon,
  size = 'md',
  minHeight = 'min-h-[380px]',
  className,
  action,
}: TableEmptyProps) {
  return (
    <TableRow className="hover:bg-transparent border-0 bg-transparent even:bg-transparent odd:bg-transparent">
      <TableCell colSpan={colSpan} className={cn('p-0 text-center', className)}>
        <div className={cn('flex flex-col h-full w-full items-center justify-center py-12 gap-3', minHeight)}>
          <EmptyState icon={icon} title={title} description={description} size={size} />
          {action && <div className="mt-1 flex justify-center">{action}</div>}
        </div>
      </TableCell>
    </TableRow>
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmpty,
  SortIcon,
  SortableTableHead,
  Pagination,
}
export type { TableEmptyProps, SortIconProps, SortableTableHeadProps, PaginationProps }
export { Pagination as TablePagination }
export type { PaginationProps as TablePaginationProps }
