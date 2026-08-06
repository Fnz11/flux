import * as React from 'react'
import { cn } from '@/lib/utils'

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative w-full overflow-auto rounded-xl border border-border-subtle bg-bg-elevated/40">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('border-b border-border-subtle bg-bg-inset/40', className)} {...props} />
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
      className={cn('border-b border-border-subtle transition-colors hover:bg-bg-inset/50 data-[state=selected]:bg-bg-inset', className)}
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
  minHeight?: string
}

function TableEmpty({ colSpan, title = 'No records found', description, minHeight = 'h-[200px]' }: TableEmptyProps) {
  return (
    <TableRow className="hover:bg-transparent border-0">
      <TableCell colSpan={colSpan} className={cn('text-center py-12', minHeight)}>
        <div className="flex flex-col items-center justify-center space-y-1">
          <p className="text-sm font-medium text-text-secondary">{title}</p>
          {description && <p className="text-xs text-text-muted">{description}</p>}
        </div>
      </TableCell>
    </TableRow>
  )
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty }
