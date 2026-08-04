import { useState, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useVaultStore, usePortfolioStore, useTransactionStore } from '@/stores'
import { Button } from '@/components/ui/button'
import { VaultStats, VaultStatsSkeleton } from '../../_components/VaultStats'
import { DepositModal } from '../../_components/DepositModal'
import { WithdrawModal } from '../../_components/WithdrawModal'
import { AddressPill } from '@/components/ui/AddressPill'

export const Route = createFileRoute('/invest/vaults/$id/')({ component: VaultInvestDetailPage })

function VaultInvestDetailPage() {
  const { id } = Route.useParams()
  const vault = useVaultStore((s) => s.vaults.find((v) => v.id === id))
  const isLoading = useVaultStore((s) => s.isLoading)
  const fetchVaultById = useVaultStore((s) => s.fetchVaultById)
  const position = usePortfolioStore((s) => s.positions.find((p) => p.vaultId === id))
  const trades = useTransactionStore((s) => s.history.filter((t) => t.vaultId === id))

  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  useEffect(() => {
    fetchVaultById(id)
  }, [id, fetchVaultById])

  if (isLoading || !vault) {
    return (
      <div className="space-y-6">
        <VaultStatsSkeleton />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              {vault.metadata.displayName || `Vault ${id}`}
            </h1>
            <AddressPill address={vault.address} />
          </div>
          {vault.metadata.description && (
            <p className="mt-1 text-text-secondary">{vault.metadata.description}</p>
          )}
        </div>

        <div className="flex gap-3">
          <Button variant="default" onClick={() => setDepositOpen(true)}>
            Deposit
          </Button>
          <Button
            variant="outline"
            onClick={() => setWithdrawOpen(true)}
            disabled={!position || position.sharesOwned <= 0}
          >
            Withdraw
          </Button>
        </div>
      </div>

      <VaultStats vault={vault} />

      {position && (
        <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
          <h2 className="text-base font-semibold text-text-primary">Your Position</h2>
          <div className="mt-3 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-text-muted">Shares</p>
              <p className="text-lg font-semibold text-text-primary font-mono">{position.sharesOwned.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Invested</p>
              <p className="text-lg font-semibold text-text-primary">${position.totalInvested.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-text-muted">Value</p>
              <p className={`text-lg font-semibold ${position.pnl >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                ${position.currentValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <h2 className="text-base font-semibold text-text-primary">Focus Assets</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {vault.metadata.focusAssets?.length ? (
            vault.metadata.focusAssets.map((asset) => (
              <span key={asset} className="rounded-full bg-bg-inset px-3 py-1 text-xs font-medium text-text-secondary">
                {asset}
              </span>
            ))
          ) : (
            <p className="text-sm text-text-muted">No focus assets specified</p>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <h2 className="text-base font-semibold text-text-primary">Recent Activity</h2>
        {trades.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">No recent activity</p>
        ) : (
          <div className="mt-3 space-y-2">
            {trades.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-lg bg-bg-inset px-4 py-2">
                <span className="text-xs text-text-tertiary font-mono">{tx.timestamp}</span>
                <span className="text-sm text-text-primary">{tx.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <DepositModal vaultId={id} open={depositOpen} onClose={() => setDepositOpen(false)} />
      <WithdrawModal vaultId={id} open={withdrawOpen} onClose={() => setWithdrawOpen(false)} />
    </div>
  )
}
