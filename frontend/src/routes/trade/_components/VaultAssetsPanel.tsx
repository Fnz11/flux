import { useVaultBalancesQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { Wallet, Layers } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Vault } from '@/types'

interface VaultAssetsPanelProps {
  vaultId?: string
  vaultName?: string
  vaults?: Vault[]
  onVaultChange?: (vaultId: string) => void
}

const TOKEN_LOGOS: Record<string, string> = {
  SOL: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  USDC: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  USDT: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png',
  JUP: 'https://static.jup.ag/jup/icon.png',
  PYTH: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png',
}

export function VaultAssetsPanel({ vaultId, vaultName, vaults = [], onVaultChange }: VaultAssetsPanelProps) {
  const { data: balances = [], isLoading } = useVaultBalancesQuery(vaultId ?? '')

  const totalUsdValue = balances.reduce((sum, b) => sum + (b.usdValue || 0), 0)
  const formattedVal = totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [valInt, valDec] = formattedVal.split('.')

  const isEmptyBalances = vaultId ? balances.length === 0 : false

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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-bg-inset animate-pulse p-3" />
          ))}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {balances.map((asset) => {
            const logoUrl = TOKEN_LOGOS[asset.symbol] || TOKEN_LOGOS.SOL
            const unitPrice = (asset.usdValue || 0) / (asset.amount || 1)
            const allocPct = totalUsdValue > 0 ? Math.min(100, Math.round(((asset.usdValue || 0) / totalUsdValue) * 100)) : 0

            return (
              <div
                key={asset.symbol || asset.mint}
                className="relative flex flex-col justify-between rounded-xl border border-border-subtle/70 bg-bg-inset/60 p-3 hover:border-primary-coral/40 transition-colors shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <img src={logoUrl} alt={asset.symbol} className="size-7 rounded-full object-cover shrink-0" />
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
                    {asset.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
      )}
    </SectionCard>
  )
}
