import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { TableHeader, TableRow, TableHead } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import type { SortColumn } from './VaultsTable'
import { handleSortKeyDown } from './vaultTableUtils'

export interface VaultTableHeaderProps {
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort: (column: SortColumn) => void
}

function renderSortIcon(column: SortColumn, sortBy?: string, sortOrder?: 'asc' | 'desc') {
  if (sortBy !== column) {
    return <ArrowUpDown className="ml-1 inline-block h-3.5 w-3.5 opacity-40 group-hover:opacity-100 transition-opacity" />
  }
  return sortOrder === 'asc' ? (
    <ArrowUp className="ml-1 inline-block h-3.5 w-3.5 text-primary-coral" />
  ) : (
    <ArrowDown className="ml-1 inline-block h-3.5 w-3.5 text-primary-coral" />
  )
}

export function VaultTableHeader({ sortBy, sortOrder, onSort }: VaultTableHeaderProps) {
  return (
    <TableHeader>
      <TableRow>
        <TableHead
          aria-sort={sortBy === 'displayName' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
          onClick={() => onSort('displayName')}
          onKeyDown={(e) => handleSortKeyDown(e, () => onSort('displayName'))}
          className="group cursor-pointer py-4 px-6 select-none hover:text-text-primary transition-colors"
        >
          <div className="flex items-center">
            VAULT {renderSortIcon('displayName', sortBy, sortOrder)}
          </div>
        </TableHead>
        <TableHead
          aria-sort={sortBy === 'pnl' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
          onClick={() => onSort('pnl')}
          onKeyDown={(e) => handleSortKeyDown(e, () => onSort('pnl'))}
          className={cn(
            'group cursor-pointer py-4 px-4 select-none transition-colors',
            sortBy === 'pnl' ? 'text-primary-coral font-bold' : 'hover:text-text-primary'
          )}
        >
          <div className="flex items-center">
            PNL {renderSortIcon('pnl', sortBy, sortOrder)}
          </div>
        </TableHead>
        <TableHead
          aria-sort={sortBy === 'created_at' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
          onClick={() => onSort('created_at')}
          onKeyDown={(e) => handleSortKeyDown(e, () => onSort('created_at'))}
          className="group cursor-pointer py-4 px-4 select-none hover:text-text-primary transition-colors"
        >
          <div className="flex items-center">
            CREATED {renderSortIcon('created_at', sortBy, sortOrder)}
          </div>
        </TableHead>
        <TableHead
          aria-sort={sortBy === 'min_raise_amount' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
          onClick={() => onSort('min_raise_amount')}
          onKeyDown={(e) => handleSortKeyDown(e, () => onSort('min_raise_amount'))}
          className="group cursor-pointer py-4 px-4 select-none hover:text-text-primary transition-colors"
        >
          <div className="flex items-center">
            MIN {renderSortIcon('min_raise_amount', sortBy, sortOrder)}
          </div>
        </TableHead>
        <TableHead
          aria-sort={sortBy === 'investors' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : undefined}
          onClick={() => onSort('investors')}
          onKeyDown={(e) => handleSortKeyDown(e, () => onSort('investors'))}
          className="group cursor-pointer py-4 px-4 select-none hover:text-text-primary transition-colors"
        >
          <div className="flex items-center">
            INVESTORS {renderSortIcon('investors', sortBy, sortOrder)}
          </div>
        </TableHead>
        <TableHead className="py-4 px-4 select-none">ASSET</TableHead>
        <TableHead className="py-4 px-4 select-none">PERFORMANCE</TableHead>
        <TableHead className="py-4 px-6 text-right select-none">ACTION</TableHead>
      </TableRow>
    </TableHeader>
  )
}
