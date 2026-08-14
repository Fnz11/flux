import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { cn } from '@/lib/utils'

export interface TableHeaderConfig {
  label: string
  align?: 'left' | 'right' | 'center'
  className?: string
  width?: string
}

export interface TableRowSkeletonProps {
  columns?: number
  rows?: number
  cellAligns?: ('left' | 'right' | 'center')[]
  cellWidths?: (string | undefined)[]
  rowClassName?: string
}

export function TableRowSkeleton({
  columns = 5,
  rows = 5,
  cellAligns = [],
  cellWidths = [],
  rowClassName,
}: TableRowSkeletonProps) {
  // Pre-generate varied skeleton widths for organic feel if not explicitly given
  const defaultWidths = ['w-28', 'w-16', 'w-20', 'w-24', 'w-20', 'w-16', 'w-12', 'w-20']

  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow
          key={rowIndex}
          className={cn(
            'animate-pulse hover:bg-transparent border-b border-border-subtle/40',
            rowClassName
          )}
        >
          {Array.from({ length: columns }).map((_, colIndex) => {
            const align = cellAligns[colIndex] || 'left'
            const customWidth = cellWidths[colIndex] || defaultWidths[colIndex % defaultWidths.length]

            return (
              <TableCell
                key={colIndex}
                className={cn(
                  'py-3.5 px-4',
                  align === 'right' && 'text-right',
                  align === 'center' && 'text-center',
                )}
              >
                <div
                  className={cn(
                    'flex items-center',
                    align === 'right' && 'justify-end',
                    align === 'center' && 'justify-center',
                  )}
                >
                  <div
                    className={cn(
                      'h-4 rounded-md bg-bg-inset',
                      customWidth,
                    )}
                  />
                </div>
              </TableCell>
            )
          })}
        </TableRow>
      ))}
    </>
  )
}

export interface TableSkeletonProps {
  headers?: (string | TableHeaderConfig)[]
  columns?: number
  rows?: number
  cellAligns?: ('left' | 'right' | 'center')[]
  cellWidths?: (string | undefined)[]
  className?: string
  tableClassName?: string
  containerClassName?: string
}

export function TableSkeleton({
  headers,
  columns,
  rows = 7,
  cellAligns,
  cellWidths,
  className,
  tableClassName,
  containerClassName,
}: TableSkeletonProps) {
  const colCount = headers?.length || columns || 5

  const parsedHeaders: TableHeaderConfig[] = headers
    ? headers.map((h) => (typeof h === 'string' ? { label: h } : h))
    : []

  const computedAligns: ('left' | 'right' | 'center')[] =
    cellAligns ||
    (parsedHeaders.length > 0
      ? parsedHeaders.map((h) => h.align || 'left')
      : Array(colCount).fill('left'))

  const computedWidths: (string | undefined)[] =
    cellWidths ||
    (parsedHeaders.length > 0 ? parsedHeaders.map((h) => h.width) : [])

  return (
    <Table className={tableClassName} containerClassName={cn('min-h-[480px]', containerClassName, className)}>
      {parsedHeaders.length > 0 && (
        <TableHeader>
          <TableRow className="border-b border-border-subtle/50 select-none">
            {parsedHeaders.map((h, i) => (
              <TableHead
                key={i}
                className={cn(
                  'py-3.5 px-4 text-xs font-semibold uppercase tracking-wider text-text-tertiary',
                  h.align === 'right' && 'text-right',
                  h.align === 'center' && 'text-center',
                  h.className,
                )}
              >
                {h.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        <TableRowSkeleton
          columns={colCount}
          rows={rows}
          cellAligns={computedAligns}
          cellWidths={computedWidths}
        />
      </TableBody>
    </Table>
  )
}
