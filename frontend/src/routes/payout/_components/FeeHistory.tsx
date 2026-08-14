import type { ApiFee, Vault } from '@/types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SectionCard } from '@/components/ui/SectionCard'
import { Receipt, Coins } from 'lucide-react'

interface FeeHistoryProps {
  isLoading: boolean
  filteredFees: ApiFee[]
  vaults: Vault[]
  selectedVaultId: string
  onSelectVault: (id: string) => void
}

export function FeeHistory({ isLoading, filteredFees, vaults, selectedVaultId, onSelectVault }: FeeHistoryProps) {
  const currentVault = vaults.find((v) => v.id === selectedVaultId)
  const displayLabel = !selectedVaultId || selectedVaultId === 'ALL'
    ? 'All Vaults'
    : currentVault?.metadata.displayName || `Vault ${selectedVaultId.slice(0, 8)}`

  return (
    <SectionCard
      icon={<Receipt className="size-4 text-primary-coral" />}
      title="Fee History"
      description="Track accrued performance and management fees per vault position"
      rightContent={
        <Select 
          value={selectedVaultId || 'ALL'} 
          onValueChange={onSelectVault}
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
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>VAULT</TableHead>
            <TableHead className="text-right">PERFORMANCE FEE</TableHead>
            <TableHead className="text-right">MANAGEMENT FEE</TableHead>
            <TableHead className="text-right">TOTAL ACCRUED</TableHead>
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
          ) : filteredFees.length === 0 ? (
            <TableEmpty
              colSpan={5}
              title="No accrued fees recorded yet"
              description="Fees accrued on active vaults will appear here"
            />
          ) : (
              filteredFees.map((fee) => {
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
