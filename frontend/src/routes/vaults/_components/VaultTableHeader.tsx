import { TableHeader, TableRow, TableHead, SortableTableHead } from '@/components/ui/table'
import type { SortColumn } from './VaultsTable'

export interface VaultTableHeaderProps {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort: (column: SortColumn) => void
}

export function VaultTableHeader({ sortBy, sortOrder, onSort }: VaultTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        <SortableTableHead
          column="displayName"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
          className="py-4 px-6"
        >
          VAULT
        </SortableTableHead>
        <SortableTableHead
          column="pnl"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
          className="py-4 px-4"
        >
          PNL
        </SortableTableHead>
        <SortableTableHead
          column="created_at"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
          className="py-4 px-4"
        >
          CREATED
        </SortableTableHead>
        <SortableTableHead
          column="min_raise_amount"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
          className="py-4 px-4"
        >
          MIN
        </SortableTableHead>
        <SortableTableHead
          column="investors"
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSort={onSort}
          className="py-4 px-4"
        >
          INVESTORS
        </SortableTableHead>
        <TableHead className="py-4 px-4 select-none">ASSET</TableHead>
        <TableHead className="py-4 px-4 select-none">PERFORMANCE</TableHead>
        <TableHead className="py-4 px-6 text-right select-none">ACTION</TableHead>
      </TableRow>
    </TableHeader>
  )
}

