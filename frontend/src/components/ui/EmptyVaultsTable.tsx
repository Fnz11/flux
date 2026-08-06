import { Table, TableHeader, TableBody, TableRow, TableHead, TableEmpty } from '@/components/ui/table'

interface EmptyVaultsTableProps {
  title?: string
  description?: string
  headers?: string[]
}

export function EmptyVaultsTable({
  title = 'No vaults available yet',
  description = 'Vaults created by managers will appear here',
  headers = ['Vault Name', 'Address', 'TVL', 'Perf. Fee', 'Status'],
}: EmptyVaultsTableProps) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated/60 backdrop-blur-2xl p-0 overflow-hidden">
      <Table>
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
          />
        </TableBody>
      </Table>
    </div>
  )
}
