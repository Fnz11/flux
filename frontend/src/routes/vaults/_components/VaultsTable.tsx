import type { Vault } from '@/types'
import { Table, TableBody } from '@/components/ui/table'
import { VaultRow } from './VaultRow'
import { VaultTableHeader } from './VaultTableHeader'

export type SortColumn = 'displayName' | 'pnl' | 'created_at' | 'min_raise_amount' | 'investors' | 'tvl'

export interface VaultsTableProps {
  vaults: Vault[]
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  onSort: (column: SortColumn) => void
}

export function VaultsTable({ vaults, sortBy, sortOrder, onSort }: VaultsTableProps) {
  return (
    <Table className="min-w-[720px]">
      <VaultTableHeader sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
      <TableBody>
        {vaults.map((vault) => (
          <VaultRow key={vault.id} vault={vault} sortBy={sortBy} />
        ))}
      </TableBody>
    </Table>
  )
}
