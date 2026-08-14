import { Table, TableHeader, TableBody, TableRow, TableHead, TableEmpty } from '@/components/ui/table'
import type { ReactNode } from 'react'
import type { EmptyStateSize } from './EmptyState'
import { cn } from '@/lib/utils'

interface EmptyVaultsTableProps {
  title?: string
  description?: string
  headers?: string[]
  icon?: ReactNode
  size?: EmptyStateSize
  containerClassName?: string
  action?: ReactNode
}

export function EmptyVaultsTable({
  title = 'No vaults available yet',
  description = 'Vaults created by managers will appear here',
  headers = ['Vault Name', 'Address', 'TVL', 'Perf. Fee', 'Status'],
  icon,
  size,
  containerClassName,
  action,
}: EmptyVaultsTableProps) {
  return (
    <Table className="min-w-[640px]" containerClassName={cn('min-h-[480px]', containerClassName)}>
      <TableHeader>
        <TableRow>
          {headers.map((h, i) => (
            <TableHead key={i} className={i >= 2 ? 'text-right' : undefined}>
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableEmpty
          colSpan={headers.length}
          title={title}
          description={description}
          icon={icon}
          size={size}
          action={action}
        />
      </TableBody>
    </Table>
  )
}
