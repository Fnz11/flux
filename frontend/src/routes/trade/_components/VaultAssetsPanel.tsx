import { useVaultBalancesQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { Coins, Wallet, Layers } from 'lucide-react'

interface VaultAssetsPanelProps {
  vaultId?: string
  vaultName?: string
}

export function VaultAssetsPanel({ vaultId, vaultName }: VaultAssetsPanelProps) {
  const { data: balances = [], isLoading } = useVaultBalancesQuery(vaultId ?? '')

  const totalUsdValue = balances.reduce((sum, b) => sum + (b.usdValue || 0), 0)

  if (!vaultId) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 p-6 backdrop-blur-2xl">
        <div className="flex flex-col items-center justify-center py-6 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-bg-inset border border-border-subtle text-text-tertiary mb-3">
            <Wallet className="size-6" />
          </div>
          <h3 className="text-sm font-semibold text-text-primary">No Vault Selected</h3>
          <p className="mt-1 text-xs text-text-secondary max-w-sm">
            Select a vault from the dropdown below to view its active token assets and balances.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated/40 p-5 backdrop-blur-2xl space-y-4">
      <div className="flex items-center justify-between border-b border-border-subtle/60 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary-coral/10 text-primary-coral border border-primary-coral/20">
            <Layers className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              Vault Assets & Balances
              {vaultName && (
                <span className="text-xs font-normal text-text-tertiary bg-bg-inset px-2 py-0.5 rounded border border-border-subtle">
                  {vaultName}
                </span>
              )}
            </h2>
            <p className="text-xs text-text-tertiary">Real-time asset allocations available for swap</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary block font-semibold">Total Value</span>
          <span className="font-mono text-base font-bold text-primary-coral">
            ${totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg bg-bg-inset animate-pulse p-3" />
          ))}
        </div>
      ) : balances.length === 0 ? (
        <div className="py-4 text-center text-xs text-text-tertiary flex items-center justify-center gap-2">
          <Coins className="size-4 text-text-tertiary" />
          No token balances found for this vault.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {balances.map((asset) => (
            <div
              key={asset.symbol || asset.mint}
              className="flex items-center justify-between rounded-lg border border-border-subtle bg-bg-inset/70 p-3 hover:border-primary-coral/30 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <div className="flex size-8 items-center justify-center rounded-full bg-bg-elevated text-xs font-bold text-text-primary border border-border-subtle font-mono">
                  {asset.symbol ? asset.symbol.slice(0, 3) : 'TOK'}
                </div>
                <div>
                  <span className="text-xs font-semibold text-text-primary block">{asset.symbol}</span>
                  <span className="text-[10px] text-text-tertiary font-mono">
                    ${((asset.usdValue || 0) / (asset.amount || 1)).toFixed(2)} / unit
                  </span>
                </div>
              </div>

              <div className="text-right font-mono">
                <span className="text-xs font-semibold text-text-primary block">
                  {asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                </span>
                <span className="text-[10px] text-text-tertiary block">
                  ≈ ${(asset.usdValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
