import * as React from 'react'
import { cn } from '@/lib/utils'
import { EmptyState, type EmptyStateSize } from './EmptyState'

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-xl border border-border-subtle/60 bg-bg-inset/20">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('border-b border-border-subtle/60 bg-bg-inset/60', className)} {...props} />
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
      className={cn('border-b border-border-subtle/40 transition-colors hover:bg-bg-inset/50 data-[state=selected]:bg-bg-inset', className)}
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
}

function TableEmpty({ colSpan, title = 'No records found', description, icon, size = 'md', minHeight = 'h-[200px]' }: TableEmptyProps) {
  return (
    <TableRow className="hover:bg-transparent border-0">
      <TableCell colSpan={colSpan} className={cn('text-center', minHeight)}>
        <div className="flex h-full w-full items-center justify-center">
          <EmptyState icon={icon} title={title} description={description} size={size} />
        </div>
      </TableCell>
    </TableRow>
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty }
