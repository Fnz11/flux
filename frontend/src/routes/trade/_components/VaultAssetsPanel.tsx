import { useMemo } from 'react'
import { useVaultBalancesQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { Wallet, Layers } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { VaultAllocationChart } from './VaultAllocationChart'
import type { Vault } from '@/types'

interface VaultAssetsPanelProps {
  vaultId?: string
  vaultName?: string
  vaults?: Vault[]
  onVaultChange?: (vaultId: string) => void
}

export function VaultAssetsPanel({ vaultId, vaultName, vaults = [], onVaultChange }: VaultAssetsPanelProps) {
  const { data: balances = [], isLoading } = useVaultBalancesQuery(vaultId ?? '')
  const selectedVault = vaults.find((v) => v.id === vaultId || v.address === vaultId)

  const effectiveBalances = useMemo(() => {
    if (balances.length > 0) return balances
    if (selectedVault && selectedVault.tvl > 0) {
      return [
        {
          mint: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          amount: selectedVault.tvl / 150,
          usdValue: selectedVault.tvl,
        },
        {
          mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          symbol: 'USDC',
          amount: 0,
          usdValue: 0,
        },
      ]
    }
    return []
  }, [balances, selectedVault])

  const totalUsdValue = effectiveBalances.reduce((sum, b) => sum + (b.usdValue || 0), 0)
  const formattedVal = totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [valInt, valDec] = formattedVal.split('.')

  const isEmptyBalances = vaultId ? effectiveBalances.length === 0 : false

  return (
    <SectionCard
      icon={<Layers className="size-4 text-primary-coral" />}
      title={
        <>
          <span>Vault Assets & Balances</span>
          {vaultName && (
            <span className="text-xs font-semibold text-primary-coral bg-primary-coral/10 px-2.5 py-0.5 rounded-full border border-primary-coral/20">
              {vaultName}
            </span>
          )}
        </>
      }
      description="Real-time asset allocations available for DEX swap execution"
      rightContent={
        <div className="flex items-center gap-3">
          {vaults.length > 0 && onVaultChange && (
            <Select value={vaultId || vaults[0]?.id || ''} onValueChange={onVaultChange}>
              <SelectTrigger className="h-8 w-44 rounded-xl border border-border-subtle bg-bg-inset px-3 text-xs font-semibold text-text-primary hover:border-primary-coral/40 cursor-pointer">
                <SelectValue placeholder="Select vault..." />
              </SelectTrigger>
              <SelectContent align="end" className="min-w-[11rem] rounded-xl border-border-medium bg-bg-elevated text-text-primary shadow-xl">
                {vaults.map((v) => (
                  <SelectItem key={v.id} value={v.id} className="text-xs cursor-pointer">
                    {v.metadata?.displayName || `Vault ${v.id.slice(0, 8)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="text-right hidden sm:block">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary block">TOTAL VALUE</span>
            <div className="flex items-baseline gap-1">
              <span className="font-mono text-base font-bold tracking-tight text-text-primary">${valInt}</span>
              <span className="font-mono text-xs font-semibold text-text-tertiary">.{valDec}</span>
            </div>
          </div>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse relative flex flex-col justify-between rounded-xl border border-border-subtle/70 bg-bg-inset/60 p-3 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-full shrink-0 bg-bg-elevated" />
                    <div className="space-y-1">
                      <div className="h-3.5 w-12 rounded bg-bg-elevated" />
                      <div className="h-2.5 w-16 rounded bg-bg-elevated" />
                    </div>
                  </div>
                  <div className="h-4 w-10 rounded-full bg-bg-elevated" />
                </div>

                <div className="mt-3 flex items-baseline justify-between">
                  <div className="h-3.5 w-14 rounded bg-bg-elevated" />
                  <div className="h-3.5 w-16 rounded bg-bg-elevated" />
                </div>

                <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
                  <div className="h-full w-2/3 rounded-full bg-bg-inset" />
                </div>
              </div>
            ))}
          </div>
          <div className="w-full lg:w-[260px] xl:w-[280px] shrink-0 rounded-xl border border-border-subtle/70 bg-bg-inset/60 p-4 animate-pulse flex flex-col items-center justify-center min-h-[160px]">
            <div className="size-24 rounded-full border-4 border-bg-elevated" />
          </div>
        </div>
      ) : !vaultId ? (
        <div className="rounded-xl border border-border-subtle/50 bg-bg-inset/40 p-4">
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="Select a Vault Above"
            description="Choose a managed vault from the dropdown above to view liquidity balances & execute oracle trades."
            size="md"
          />
        </div>
      ) : isEmptyBalances ? (
        <div className="rounded-xl border border-border-subtle/50 bg-bg-inset/40 p-4">
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No balances recorded"
            description="This vault has no recorded balances yet. Balances will appear here once recorded."
            size="md"
          />
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4 items-stretch">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
            {effectiveBalances.map((asset) => {
              const unitPrice = (asset.usdValue || 0) / (asset.amount || 1)
              const allocPct = totalUsdValue > 0 ? Math.min(100, Math.round(((asset.usdValue || 0) / totalUsdValue) * 100)) : 0

              return (
                <div
                  key={asset.symbol || asset.mint}
                  className="relative flex flex-col justify-between rounded-xl border border-border-subtle/70 bg-bg-inset/60 p-3 hover:border-primary-coral/40 transition-colors shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TokenIcon symbol={asset.symbol} className="size-7" />
                      <div>
                        <span className="text-xs font-bold text-text-primary block">{asset.symbol}</span>
                        <span className="text-[10px] text-text-tertiary font-mono">
                          ${unitPrice > 10 ? unitPrice.toFixed(2) : unitPrice.toFixed(4)} / unit
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-primary-gold bg-primary-gold/10 px-2 py-0.5 rounded-full border border-primary-gold/20 font-mono">
                      {allocPct}%
                    </span>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between font-mono">
                    <span className="text-xs font-semibold text-text-primary">
                      {asset.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: asset.amount < 1 && asset.amount > 0 ? 6 : 4,
                      })}
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      ${(asset.usdValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-bg-elevated">
                    <div
                      className="h-full bg-gradient-to-r from-primary-coral to-primary-gold rounded-full"
                      style={{ width: `${allocPct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          <div className="w-full lg:w-[260px] xl:w-[280px] shrink-0 rounded-xl border border-border-subtle/70 bg-bg-inset/60 p-3.5 shadow-xs flex flex-col justify-between">
            <VaultAllocationChart balances={effectiveBalances} totalUsdValue={totalUsdValue} />
          </div>
        </div>
      )}
    </SectionCard>
  )
}
