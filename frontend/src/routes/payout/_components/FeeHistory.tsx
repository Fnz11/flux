import { useState, useMemo } from 'react'
import type { ApiFee, Vault } from '@/types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty, SortableTableHead, Pagination } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionCard } from '@/components/ui/SectionCard'
import { Receipt, Check, ExternalLink } from 'lucide-react'
import { useTableSort } from '@/hooks/useTableSort'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AddressPill } from '@/components/ui/AddressPill'
import { SOLSCAN_CLUSTER } from '@/constants'

interface FeeHistoryProps {
  isLoading: boolean
  filteredFees: ApiFee[]
  vaults: Vault[]
  selectedVaultId: string
  onSelectVault: (id: string) => void
  onClaimFee?: (vault: Vault, fee: ApiFee) => void
  isClaiming?: boolean
  claimingVaultId?: string | null
  userAddress?: string
}

type FeeSortColumn = 'vault' | 'perf_fee' | 'mgmt_fee' | 'total' | 'created_at'

export function FeeHistory({
  isLoading,
  filteredFees,
  vaults,
  selectedVaultId,
  onSelectVault,
  onClaimFee,
  isClaiming = false,
  claimingVaultId = null,
  userAddress,
}: FeeHistoryProps) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'CLAIMABLE' | 'CLAIMED'>('ALL')

  const { sortBy, sortOrder, handleSort } = useTableSort<FeeSortColumn>({
    sortBy: 'created_at',
    defaultOrder: 'desc',
    allowClear: true,
  })

  const userAddr = userAddress

  const currentVault = vaults.find((v) => v.id === selectedVaultId)
  const displayLabel = !selectedVaultId || selectedVaultId === 'ALL'
    ? 'All Vaults'
    : currentVault?.metadata.displayName || `Vault ${selectedVaultId.slice(0, 8)}`

  const statusFilteredFees = useMemo(() => {
    if (statusFilter === 'CLAIMABLE') {
      return filteredFees.filter((f) => (f.total_accrued ?? 0) > 0 && f.status !== 'Claimed')
    }
    if (statusFilter === 'CLAIMED') {
      return filteredFees.filter((f) => (f.total_accrued ?? 0) <= 0 || f.status === 'Claimed' || ((f.claimed_amount ?? 0) > 0))
    }
    return filteredFees
  }, [filteredFees, statusFilter])

  const sortedFees = useMemo(() => {
    if (!sortBy || !sortOrder) return statusFilteredFees

    return [...statusFilteredFees].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortBy) {
        case 'created_at': {
          const vA = vaults.find((v) => v.id === a.vault_id)
          const vB = vaults.find((v) => v.id === b.vault_id)
          const timeA = new Date(vA?.createdAt || 0).getTime()
          const timeB = new Date(vB?.createdAt || 0).getTime()
          aVal = isNaN(timeA) ? 0 : timeA
          bVal = isNaN(timeB) ? 0 : timeB
          break
        }
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
  }, [statusFilteredFees, vaults, sortBy, sortOrder])

  const totalPages = Math.max(1, Math.ceil(sortedFees.length / pageSize))
  const pagedFees = sortedFees.slice((page - 1) * pageSize, page * pageSize)

  return (
    <SectionCard
      icon={<Receipt className="size-4 text-primary-coral" />}
      title="Fee History"
      description="Track accrued performance and management fees per vault position"
      rightContent={
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center rounded-xl bg-bg-inset border border-border-subtle p-0.5 text-xs font-semibold">
            {(['ALL', 'CLAIMABLE', 'CLAIMED'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setStatusFilter(tab)
                  setPage(1)
                }}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-bg-elevated text-primary-coral shadow-xs font-bold'
                    : 'text-text-tertiary hover:text-text-primary'
                }`}
              >
                {tab === 'ALL' ? 'All' : tab === 'CLAIMABLE' ? 'Claimable' : 'Claimed'}
              </button>
            ))}
          </div>

          <Select 
            value={selectedVaultId || 'ALL'} 
            onValueChange={(val) => {
              onSelectVault(val)
              setPage(1)
            }}
          >
            <SelectTrigger className="h-8 w-40 rounded-xl border border-border-subtle bg-bg-inset px-3 text-xs font-semibold text-text-primary hover:border-primary-coral/40 cursor-pointer">
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
        </div>
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
                    <TableCell className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 shrink-0">
                          <AvatarFallback
                            src={vault?.metadata?.coverImageUrl}
                            seed={vault?.address || vault?.id || vaultName}
                          >
                            {vaultName.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-semibold text-xs text-text-primary flex items-center gap-2">
                            <span>{vaultName}</span>
                            {vault?.status && <StatusBadge status={vault.status} />}
                          </div>
                          <div className="mt-0.5">
                            {vault?.managerAddress ? (
                              <AddressPill prefix="by " address={vault.managerAddress} length={4} />
                            ) : (
                              <span className="text-[11px] text-text-tertiary font-mono">by Vault Manager</span>
                            )}
                          </div>
                        </div>
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
                      {userAddr && vault?.managerAddress && vault.managerAddress.toLowerCase() !== userAddr.toLowerCase() ? (
                        <span className="inline-flex items-center rounded-lg bg-bg-inset border border-border-subtle px-2.5 py-1 text-xs font-semibold text-text-tertiary">
                          Not Manager
                        </span>
                      ) : fee.total_accrued <= 0 || fee.status === 'Claimed' ? (
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 text-xs font-semibold text-emerald-400 shadow-xs">
                            <Check className="size-3.5 stroke-[2.5]" />
                            Claimed
                          </span>
                          <a
                            href={
                              fee.claim_tx_signature
                                ? `https://solscan.io/tx/${fee.claim_tx_signature}?cluster=${SOLSCAN_CLUSTER}`
                                : `https://solscan.io/account/${vault?.address || fee.vault_id}?cluster=${SOLSCAN_CLUSTER}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center size-7 rounded-lg border border-border-subtle bg-bg-inset text-text-tertiary hover:text-primary-coral hover:border-primary-coral/40 transition-colors"
                            title={fee.claim_tx_signature ? 'View claim transaction on Solscan' : 'View on Solscan'}
                          >
                            <ExternalLink className="size-3.5" />
                          </a>
                        </div>
                      ) : (
                        <button
                          type="button"
                          disabled={isClaiming || !vault}
                          onClick={() => {
                            if (vault && onClaimFee) {
                              onClaimFee(vault, fee)
                            }
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-primary-coral to-primary-amber px-3 py-1.5 text-xs font-bold text-white shadow-sm shadow-primary-coral/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100 disabled:active:scale-100"
                        >
                          {isClaiming && claimingVaultId === fee.vault_id ? 'Claiming...' : 'Claim'}
                        </button>
                      )}
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
