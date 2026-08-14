import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useTransactionStore } from '@/stores'
import { useVaultDetailQuery, usePortfolioQuery } from '@/services/hooks'
import { Button } from '@/components/ui/button'
import { VaultStats } from '../../_components/VaultStats'
import { VaultStatsSkeleton } from '../../_components/VaultStatsSkeleton'
import { DepositModal } from '../../_components/DepositModal'
import { WithdrawModal } from '../../_components/WithdrawModal'
import { AddressPill } from '@/components/ui/AddressPill'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/invest/vaults/$id/')({ component: VaultInvestDetailPage })

function VaultInvestDetailPage() {
  const { id } = Route.useParams()
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  const { data: vault, isLoading } = useVaultDetailQuery(id)
  const { data: positions = [] } = usePortfolioQuery(walletAddress)
  const position = positions.find((p) => p.vaultId === id)
  const trades = useTransactionStore((s) => s.history.filter((t) => t.vaultId === id))

  const [depositOpen, setDepositOpen] = useState(false)
  const [withdrawOpen, setWithdrawOpen] = useState(false)

  if (isLoading || !vault) {
    return <VaultInvestDetailSkeleton />
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
        <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
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
              <p className={cn('text-lg font-semibold', position.currentValue >= position.totalInvested ? 'text-status-success' : 'text-status-error')}>
                ${position.currentValue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <h2 className="text-base font-semibold text-text-primary">Focus Assets</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {vault.metadata.focusAssets?.length ? (
            vault.metadata.focusAssets.map((asset) => (
              <span key={asset} className="inline-flex items-center gap-1.5 rounded-full bg-bg-inset px-3 py-1 text-xs font-medium text-text-secondary border border-border-subtle">
                <TokenIcon symbol={asset} className="size-3.5" />
                <span>{asset}</span>
              </span>
            ))
          ) : (
            <p className="text-sm text-text-muted">No focus assets specified</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <h2 className="text-base font-semibold text-text-primary">Recent Activity</h2>
        {trades.length === 0 ? (
          <p className="mt-4 text-sm text-text-muted">No recent activity</p>
        ) : (
          <div className="mt-3 space-y-2">
            {trades.slice(0, 10).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between rounded-xl bg-bg-inset px-4 py-2">
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

function VaultInvestDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-52 rounded-md" />
            <Skeleton className="h-6 w-28 rounded-full" />
          </div>
          <Skeleton className="h-4 w-72 rounded-md" />
        </div>

        <div className="flex gap-3">
          <Skeleton className="h-9 w-20 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
      </div>

      {/* 4 Stats Cards */}
      <VaultStatsSkeleton />

      {/* Position Card Skeleton */}
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <Skeleton className="h-4.5 w-28 rounded-md" />
        <div className="mt-4 grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Skeleton className="h-3 w-12 rounded" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-14 rounded" />
            <Skeleton className="h-6 w-28 rounded" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-10 rounded" />
            <Skeleton className="h-6 w-24 rounded" />
          </div>
        </div>
      </div>

      {/* Focus Assets Skeleton */}
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <Skeleton className="h-4.5 w-24 rounded-md" />
        <div className="mt-3 flex flex-wrap gap-2">
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
          <Skeleton className="h-7 w-18 rounded-full" />
        </div>
      </div>

      {/* Recent Activity Skeleton */}
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <Skeleton className="h-4.5 w-32 rounded-md" />
        <div className="mt-3 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between rounded-xl bg-bg-inset px-4 py-2.5">
              <Skeleton className="h-3.5 w-20 rounded" />
              <Skeleton className="h-3.5 w-16 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
