import { useState, useMemo } from 'react'
import type { ApiFee, Vault } from '@/types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, SortableTableHead, Pagination } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionCard } from '@/components/ui/SectionCard'
import { Receipt, Coins } from 'lucide-react'
import { useTableSort } from '@/hooks/useTableSort'

interface FeeHistoryProps {
  isLoading: boolean
  filteredFees: ApiFee[]
  vaults: Vault[]
  selectedVaultId: string
  onSelectVault: (id: string) => void
}

type FeeSortColumn = 'vault' | 'perf_fee' | 'mgmt_fee' | 'total'

export function FeeHistory({ isLoading, filteredFees, vaults, selectedVaultId, onSelectVault }: FeeHistoryProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  const { sortBy, sortOrder, handleSort } = useTableSort<FeeSortColumn>({
    sortBy: 'total',
    defaultOrder: 'desc',
    allowClear: true,
  })

  const currentVault = vaults.find((v) => v.id === selectedVaultId)
  const displayLabel = !selectedVaultId || selectedVaultId === 'ALL'
    ? 'All Vaults'
    : currentVault?.metadata.displayName || `Vault ${selectedVaultId.slice(0, 8)}`

  const sortedFees = useMemo(() => {
    if (!sortBy || !sortOrder) return filteredFees

    return [...filteredFees].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortBy) {
        case 'vault': {
          const vA = vaults.find((v) => v.id === a.vault_id)?.metadata.displayName || a.vault_id
          const vB = vaults.find((v) => v.id === b.vault_id)?.metadata.displayName || b.vault_id
          aVal = vA.toLowerCase()
          bVal = vB.toLowerCase()
          break
        }
        case 'perf_fee':
          aVal = a.accrued_performance_fee || 0
          bVal = b.accrued_performance_fee || 0
          break
        case 'mgmt_fee':
          aVal = a.accrued_management_fee || 0
          bVal = b.accrued_management_fee || 0
          break
        case 'total':
          aVal = a.total_accrued || 0
          bVal = b.total_accrued || 0
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [filteredFees, vaults, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(sortedFees.length / pageSize))
  const pagedFees = sortedFees.slice((page - 1) * pageSize, page * pageSize)

  return (
    <SectionCard
      icon={<Receipt className="size-4 text-primary-coral" />}
      title="Fee History"
      description="Track accrued performance and management fees per vault position"
      rightContent={
        <Select 
          value={selectedVaultId || 'ALL'} 
          onValueChange={(val) => {
            onSelectVault(val)
            setPage(1)
          }}
        >
          <SelectTrigger className="h-8 w-44 rounded-xl border border-border-subtle bg-bg-inset px-3 text-xs font-semibold text-text-primary hover:border-primary-coral/40 cursor-pointer">
            <SelectValue placeholder="All Vaults">
              {displayLabel}
            </SelectValue>
          </SelectTrigger>
          <SelectContent align="end" className="min-w-[10rem] rounded-xl border-border-medium bg-bg-elevated text-text-primary shadow-xl">
            <SelectItem value="ALL" className="text-xs cursor-pointer">All Vaults</SelectItem>
            {vaults.map((v) => (
              <SelectItem key={v.id} value={v.id} className="text-xs cursor-pointer">
                {v.metadata.displayName || `Vault ${v.id.slice(0, 8)}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <Table
        containerClassName="min-h-[380px]"
        footer={
          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={sortedFees.length}
            pageSize={pageSize}
            pageSizeOptions={[5, 10, 20, 50]}
            onPageChange={setPage}
            onPageSizeChange={(newSize: number) => {
              setPageSize(newSize)
              setPage(1)
            }}
            itemLabel="fees"
            isLoading={isLoading}
          />
        }
      >
        <TableHeader>
          <TableRow>
            <SortableTableHead
              column="vault"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
            >
              VAULT
            </SortableTableHead>
            <SortableTableHead
              column="perf_fee"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              align="right"
            >
              PERFORMANCE FEE
            </SortableTableHead>
            <SortableTableHead
              column="mgmt_fee"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              align="right"
            >
              MANAGEMENT FEE
            </SortableTableHead>
            <SortableTableHead
              column="total"
              sortBy={sortBy}
              sortOrder={sortOrder}
              onSort={handleSort}
              align="right"
            >
              TOTAL ACCRUED
            </SortableTableHead>
            <TableHead className="text-right">ACTION</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRowSkeleton
              columns={5}
              rows={4}
              cellAligns={['left', 'right', 'right', 'right', 'right']}
              cellWidths={['w-32', 'w-20', 'w-20', 'w-20', 'w-14']}
            />
          ) : pagedFees.length === 0 ? (
            <TableEmpty
              colSpan={5}
              title="No accrued fees recorded yet"
              description="Fees accrued on active vaults will appear here"
              minHeight="min-h-[300px]"
            />
          ) : (
              pagedFees.map((fee) => {
                const vault = vaults.find((v) => v.id === fee.vault_id)
                const vaultName = vault?.metadata.displayName || `Vault ${fee.vault_id.slice(0, 8)}`
                return (
                  <TableRow key={fee.vault_id} className="hover:bg-bg-inset/50 transition-colors">
                    <TableCell className="font-semibold text-xs text-text-primary">
                      <div className="flex items-center gap-2">
                        <Coins className="size-4 text-primary-gold shrink-0" />
                        <span>{vaultName}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-text-secondary">
                      ${fee.accrued_performance_fee.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs text-text-secondary">
                      ${fee.accrued_management_fee.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right font-mono text-xs font-semibold text-primary-coral">
                      ${fee.total_accrued.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right">
                      <button
                        type="button"
                        className="rounded-lg bg-bg-inset border border-border-medium px-2.5 py-1 text-xs font-semibold text-text-primary hover:bg-primary-coral hover:text-black hover:border-primary-coral transition-colors cursor-pointer"
                      >
                        Claim
                      </button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
        </TableBody>
      </Table>
    </SectionCard>
  )
}
