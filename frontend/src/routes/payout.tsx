import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { getVaults } from '@/services/apis/rest-api/vault.service'
import * as feeService from '@/services/apis/rest-api/fee.service'
import { EmptyState } from '@/components/ui/EmptyState'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import type { ApiFee, Vault } from '@/types'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { MetricCard } from './payout/_components/MetricCard'

export const Route = createFileRoute('/payout')({ component: PayoutPage })

function PayoutPage() {
  const [vaults, setVaults] = useState<Vault[]>([])
  const [fees, setFees] = useState<ApiFee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedVaultId] = useState('')

  useEffect(() => {
    setIsLoading(true)
    getVaults()
      .then(setVaults)
      .catch(() => setVaults([]))
  }, [])

  useEffect(() => {
    if (vaults.length === 0) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    Promise.all(
      vaults.map((v) => feeService.getAccruedFees(v.id).catch(() => null)),
    )
      .then((results) => {
        setFees(results.filter((f): f is ApiFee => f !== null))
      })
      .finally(() => setIsLoading(false))
  }, [vaults])

  fees.find((f) => f.vault_id === selectedVaultId)
  const totalFees = fees.reduce((acc, f) => acc + f.total_accrued, 0)
  const totalPerf = fees.reduce((acc, f) => acc + f.accrued_performance_fee, 0)
  const totalMgmt = fees.reduce((acc, f) => acc + f.accrued_management_fee, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Payout</h1>
        <p className="mt-2 text-text-secondary">Manage investor payouts and distributions.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total Performance Fee" value={`$${totalPerf.toFixed(2)}`} accent />
        <MetricCard label="Total Management Fee" value={`$${totalMgmt.toFixed(2)}`} />
        <MetricCard label="Total Accrued" value={`$${totalFees.toFixed(2)}`} accent />
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
        <h2 className="text-sm font-semibold text-text-primary">How It Works</h2>
        <div className="mt-3 space-y-2 text-sm text-text-secondary">
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

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
        <h2 className="mb-4 text-sm font-semibold text-text-primary">Fee History</h2>

        {isLoading ? (
          <LoadingSkeleton lines={4} />
        ) : fees.length === 0 ? (
          <EmptyState title="No fees accrued" description="Fees will appear once vaults are active." />
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
              {fees.map((fee) => (
                <TableRow key={fee.vault_id}>
                  <TableCell className="font-mono text-xs">{fee.vault_id.slice(0, 12)}...</TableCell>
                  <TableCell>${fee.accrued_performance_fee.toFixed(2)}</TableCell>
                  <TableCell>${fee.accrued_management_fee.toFixed(2)}</TableCell>
                  <TableCell className="font-semibold">${fee.total_accrued.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
