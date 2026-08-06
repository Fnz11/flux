import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, useMemo } from 'react'
import { useAppStore } from '@/stores/app-store'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { useFees } from '@/hooks/useFees'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { PageHeader } from '@/components/ui/PageHeader'
import { PayoutSummary } from './payout/_components/PayoutSummary'
import { FeeHistory } from './payout/_components/FeeHistory'

export const Route = createFileRoute('/payout')({
  beforeLoad: () => {
    // Note: beforeLoad is not a React component, must use .getState(), not hook selector
    const isManager = useAppStore.getState().isManager
    if (!isManager) {
      throw redirect({
        to: '/invest',
      })
    }
  },
  component: PayoutPage,
})

function PayoutPage() {
  const isManager = useAppStore((s) => s.isManager)
  const navigate = useNavigate()
  const { data: vaults = [] } = useVaultsQuery()

  const [selectedVaultId, setSelectedVaultId] = useState<string>('ALL')

  useEffect(() => {
    if (!isManager) {
      navigate({ to: '/invest', replace: true })
    }
  }, [isManager, navigate])

  const vaultIds = useMemo(() => vaults.map((v) => v.id), [vaults])
  const { fees, isLoading } = useFees(vaultIds)

  const filteredFees = selectedVaultId === 'ALL'
    ? fees
    : fees.filter((f) => f.vault_id === selectedVaultId)

  const totalFees = filteredFees.reduce((acc, f) => acc + (f.total_accrued || 0), 0)
  const totalPerf = filteredFees.reduce((acc, f) => acc + (f.accrued_performance_fee || 0), 0)
  const totalMgmt = filteredFees.reduce((acc, f) => acc + (f.accrued_management_fee || 0), 0)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Payout"
        subtitle="Manage investor payouts and distributions."
        action={
          <div className="w-full sm:w-48">
            <Select 
              value={selectedVaultId} 
              onValueChange={setSelectedVaultId}
              disabled={vaults.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={vaults.length === 0 ? "No vaults available" : "Filter by vault..."} />
              </SelectTrigger>
              <SelectContent>
                {vaults.length === 0 ? (
                  <SelectItem disabled value="empty">No vaults available</SelectItem>
                ) : (
                  <>
                    <SelectItem value="ALL">All Vaults</SelectItem>
                    {vaults.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.metadata.displayName || `Vault ${v.id.slice(0, 8)}`}
                      </SelectItem>
                    ))}
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        }
      />

      <PayoutSummary totalPerf={totalPerf} totalMgmt={totalMgmt} totalFees={totalFees} />

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-text-primary">How It Works</h2>
        <div className="rounded-xl border border-border-subtle bg-bg-elevated/60 backdrop-blur-2xl p-5">
          <div className="space-y-2 text-sm text-text-secondary">
            <p>
              Fees are accrued on-chain and tracked per vault. The <strong>Keeper</strong> system
              automates fee collection and distribution to manager wallets.
            </p>
            <ul className="list-inside list-disc space-y-1 text-xs text-text-tertiary">
              <li>Performance Fee: Charged on profits, paid in vault LP tokens.</li>
              <li>Management Fee: Charged on AUM, accrued continuously.</li>
              <li>Keepers trigger payouts on a schedule or when thresholds are met.</li>
            </ul>
          </div>
        </div>
      </div>

      <FeeHistory isLoading={isLoading} filteredFees={filteredFees} vaults={vaults} />
    </div>
  )
}
