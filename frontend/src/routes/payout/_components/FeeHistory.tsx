import type { ApiFee, Vault } from '@/types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableEmpty } from '@/components/ui/table'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'

interface FeeHistoryProps {
  isLoading: boolean
  filteredFees: ApiFee[]
  vaults: Vault[]
}

export function FeeHistory({ isLoading, filteredFees, vaults }: FeeHistoryProps) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-text-primary">Fee History</h2>

      <div className="rounded-xl border border-border-subtle bg-bg-elevated/60 backdrop-blur-2xl p-0 overflow-hidden">
        {isLoading ? (
          <div className="p-5"><LoadingSkeleton lines={4} /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vault</TableHead>
                <TableHead>Performance Fee</TableHead>
                <TableHead>Management Fee</TableHead>
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFees.length === 0 ? (
                <TableEmpty
                  colSpan={4}
                  title="No accrued fees"
                  description="Fees accrued on active vaults will appear here"
                />
              ) : (
                filteredFees.map((fee) => {
                  const vault = vaults.find((v) => v.id === fee.vault_id)
                  const vaultName = vault?.metadata.displayName || `Vault ${fee.vault_id.slice(0, 8)}`
                  return (
                    <TableRow key={fee.vault_id}>
                      <TableCell className="font-mono text-xs text-text-primary font-medium">{vaultName}</TableCell>
                      <TableCell className="font-mono text-xs text-text-secondary">${fee.accrued_performance_fee.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs text-text-secondary">${fee.accrued_management_fee.toFixed(2)}</TableCell>
                      <TableCell className="font-mono text-xs font-semibold text-primary-coral">${fee.total_accrued.toFixed(2)}</TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
