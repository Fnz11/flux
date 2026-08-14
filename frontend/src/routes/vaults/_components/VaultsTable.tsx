import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
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
  const tableContainerRef = useRef<HTMLDivElement>(null)

  const rowVirtualizer = useVirtualizer({
    count: vaults.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 72,
    overscan: 5,
    initialRect: { width: 1000, height: 800 },
  })

  const virtualItems = rowVirtualizer.getVirtualItems()
  const totalSize = rowVirtualizer.getTotalSize()

  const itemsToRender =
    virtualItems.length > 0
      ? virtualItems
      : vaults.map((_, index) => ({ index, start: index * 72, size: 72, key: index }))

  const paddingTop = virtualItems.length > 0 && virtualItems[0] ? virtualItems[0].start : 0
  const paddingBottom =
    virtualItems.length > 0 && virtualItems[virtualItems.length - 1]
      ? totalSize - (virtualItems[virtualItems.length - 1].start + virtualItems[virtualItems.length - 1].size)
      : 0

  return (
    <Table containerRef={tableContainerRef} className="min-w-[720px]" containerClassName="min-h-[480px]">
      <VaultTableHeader sortBy={sortBy} sortOrder={sortOrder} onSort={onSort} />
      <TableBody>
        {paddingTop > 0 && (
          <tr style={{ height: `${paddingTop}px` }} aria-hidden="true">
            <td colSpan={8} />
          </tr>
        )}
        {itemsToRender.map((virtualRow) => {
          const vault = vaults[virtualRow.index]
          if (!vault) return null
          return <VaultRow key={vault.id} vault={vault} sortBy={sortBy} />
        })}
        {paddingBottom > 0 && (
          <tr style={{ height: `${paddingBottom}px` }} aria-hidden="true">
            <td colSpan={8} />
          </tr>
        )}
      </TableBody>
    </Table>
  )
}
