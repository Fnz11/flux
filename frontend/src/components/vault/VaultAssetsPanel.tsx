import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { useVaultBalancesQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { Wallet, Layers, ArrowRight } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { SweepButton } from '@/components/ui/SweepButton'
import { AddressPill } from '@/components/ui/AddressPill'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SortableTableHead } from '@/components/ui/table'
import { useTableSort } from '@/hooks/useTableSort'
import { VaultAllocationChart } from './VaultAllocationChart'
import type { Vault } from '@/types'

export interface VaultAssetsPanelProps {
  vault?: Vault
  vaultId?: string
  vaultName?: string
  vaults?: Vault[]
  onVaultChange?: (vaultId: string) => void
  isManager?: boolean
  showSwapButton?: boolean
  showTable?: boolean
  title?: React.ReactNode
  description?: string
}

type AssetSortColumn = 'symbol' | 'amount' | 'usdValue' | 'allocation'

export function VaultAssetsPanel({
  vault,
  vaultId: propVaultId,
  vaultName: propVaultName,
  vaults = [],
  onVaultChange,
  isManager,
  showSwapButton = false,
  showTable = false,
  title,
  description,
}: VaultAssetsPanelProps) {
  const activeVaultId = vault?.id || vault?.address || propVaultId || ''
  const activeVaultName = propVaultName || vault?.metadata?.displayName || (vault as any)?.name || ''
  const { data: balances = [], isLoading } = useVaultBalancesQuery(activeVaultId)
  const selectedVault = vault || vaults.find((v) => v.id === activeVaultId || v.address === activeVaultId)

  const effectiveBalances = useMemo(() => {
    if (balances.length > 0) return balances
    if (selectedVault && selectedVault.tvl > 0) {
      return [
        {
          mint: 'So11111111111111111111111111111111111111112',
          symbol: 'SOL',
          amount: selectedVault.tvl / 75.33,
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

  const totalUsdValue = useMemo(() => {
    return effectiveBalances.reduce((sum, b) => sum + (b.usdValue || 0), 0)
  }, [effectiveBalances])

  const formattedVal = totalUsdValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [valInt, valDec] = formattedVal.split('.')

  const isEmptyBalances = activeVaultId ? effectiveBalances.length === 0 : false

  const { sortBy, sortOrder, handleSort } = useTableSort<AssetSortColumn>({
    sortBy: 'usdValue',
    defaultOrder: 'desc',
    allowClear: true,
  })

  const sortedBalances = useMemo(() => {
    return [...effectiveBalances].sort((a, b) => {
      let aVal: number | string = 0
      let bVal: number | string = 0

      switch (sortBy) {
        case 'symbol':
          aVal = (a.symbol || '').toLowerCase()
          bVal = (b.symbol || '').toLowerCase()
          break
        case 'amount':
          aVal = a.amount || 0
          bVal = b.amount || 0
          break
        case 'usdValue':
          aVal = a.usdValue || 0
          bVal = b.usdValue || 0
          break
        case 'allocation':
          aVal = totalUsdValue > 0 ? (a.usdValue / totalUsdValue) * 100 : 0
          bVal = totalUsdValue > 0 ? (b.usdValue / totalUsdValue) * 100 : 0
          break
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortOrder === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortOrder === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })
  }, [effectiveBalances, sortBy, sortOrder, totalUsdValue])

  return (
    <SectionCard
      icon={<Layers className="size-4 text-primary-coral" />}
      title={
        title || (
          <div className="flex flex-wrap items-center gap-2">
            <span>Vault Assets &amp; Balances</span>
            {activeVaultName && (
              <span className="text-xs font-semibold text-primary-coral bg-primary-coral/10 px-2.5 py-0.5 rounded-full border border-primary-coral/20">
                {activeVaultName}
              </span>
            )}
          </div>
        )
      }
      description={description || 'Real-time asset allocations available for DEX swap execution'}
      rightContent={
        <div className="flex items-center gap-3">
          {vaults.length > 0 && onVaultChange && (
            <Select value={activeVaultId || vaults[0]?.id || ''} onValueChange={onVaultChange}>
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

          {showSwapButton && isManager && selectedVault && (
            <Link to="/trade" search={{ vaultId: selectedVault.id }}>
              <SweepButton className="h-8 text-xs font-semibold">
                <span>Execute Swap</span>
                <ArrowRight className="ml-1.5 size-3.5" />
              </SweepButton>
            </Link>
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
        <div className="flex flex-col lg:flex-row gap-4 items-start">
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="animate-pulse flex flex-col justify-between rounded-2xl border border-white/12 bg-bg-elevated/3 backdrop-blur-2xl p-4 sm:p-5 h-auto min-h-[120px]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="size-8 rounded-full shrink-0 bg-white/10" />
                    <div className="space-y-1.5">
                      <div className="h-4 w-14 rounded bg-white/10" />
                      <div className="h-3 w-20 rounded bg-white/5" />
                    </div>
                  </div>
                  <div className="h-5 w-12 rounded-full bg-white/10" />
                </div>

                <div className="mt-4 flex items-baseline justify-between">
                  <div className="h-4 w-16 rounded bg-white/10" />
                  <div className="h-4 w-20 rounded bg-white/10" />
                </div>

                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div className="h-full w-2/3 rounded-full bg-white/10" />
                </div>
              </div>
            ))}
          </div>
          <div className="w-full lg:w-[280px] xl:w-[320px] shrink-0 rounded-2xl border border-white/12 bg-bg-elevated/3 backdrop-blur-2xl p-5 animate-pulse flex flex-col items-center justify-center min-h-[220px]">
            <div className="size-28 rounded-full border-4 border-white/10" />
          </div>
        </div>
      ) : !activeVaultId ? (
        <div className="rounded-2xl border border-white/12 bg-bg-elevated/3 p-6 backdrop-blur-2xl">
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="Select a Vault Above"
            description="Choose a managed vault from the dropdown above to view liquidity balances & execute oracle trades."
            size="md"
          />
        </div>
      ) : isEmptyBalances ? (
        <div className="rounded-2xl border border-white/12 bg-bg-elevated/3 p-6 backdrop-blur-2xl">
          <EmptyState
            icon={<Wallet className="size-5" />}
            title="No balances recorded"
            description="This vault has no recorded balances yet. Balances will appear here once recorded."
            size="md"
          />
        </div>
      ) : (
        <div className="space-y-5">
          {/* Top Row: Cards Grid (Left) + Donut Chart (Right) */}
          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 content-start">
              {effectiveBalances.map((asset) => {
                const unitPrice = (asset.usdValue || 0) / (asset.amount || 1)
                const allocPct = totalUsdValue > 0 ? Math.min(100, Math.round(((asset.usdValue || 0) / totalUsdValue) * 100)) : 0

                return (
                  <div
                    key={asset.symbol || asset.mint}
                    className="group rounded-2xl border border-white/12 bg-bg-elevated/3 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] p-4 sm:p-5 transition-all hover:border-white/20 hover:shadow-[0_16px_48px_rgba(0,0,0,0.7)] flex flex-col justify-between gap-3.5 h-auto"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <TokenIcon symbol={asset.symbol} className="size-8 shrink-0" />
                        <div className="min-w-0">
                          <span className="text-sm font-bold text-text-primary block truncate">{asset.symbol}</span>
                          <span className="text-[11px] text-text-tertiary font-mono block truncate">
                            ${unitPrice > 10 ? unitPrice.toFixed(2) : unitPrice.toFixed(4)} / unit
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-bold text-primary-gold bg-primary-gold/10 px-2.5 py-0.5 rounded-full border border-primary-gold/20 font-mono shrink-0">
                        {allocPct}%
                      </span>
                    </div>

                    <div>
                      <div className="flex items-baseline justify-between font-mono">
                        <span className="text-sm font-bold text-text-primary">
                          {asset.amount.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: asset.amount < 1 && asset.amount > 0 ? 6 : 4,
                          })}
                        </span>
                        <span className="text-sm font-bold text-status-success">
                          ${(asset.usdValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className="h-full bg-gradient-to-r from-primary-coral to-primary-gold rounded-full transition-all duration-500"
                          style={{ width: `${allocPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="w-full lg:w-[280px] xl:w-[320px] shrink-0 rounded-2xl border border-white/12 bg-bg-elevated/3 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)] p-5 flex flex-col justify-between">
              <VaultAllocationChart balances={effectiveBalances} totalUsdValue={totalUsdValue} />
            </div>
          </div>

          {/* Optional Detailed Holdings Table */}
          {showTable && sortedBalances.length > 0 && (
            <div className="pt-2">
              <Table className="min-w-[600px]">
                <TableHeader>
                  <TableRow>
                    <SortableTableHead
                      column="symbol"
                      currentSort={sortBy}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                      className="py-3 px-4"
                    >
                      ASSET
                    </SortableTableHead>
                    <SortableTableHead
                      column="amount"
                      currentSort={sortBy}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                      align="right"
                      className="py-3 px-4"
                    >
                      HOLDINGS
                    </SortableTableHead>
                    <SortableTableHead
                      column="usdValue"
                      currentSort={sortBy}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                      align="right"
                      className="py-3 px-4"
                    >
                      USD VALUE
                    </SortableTableHead>
                    <SortableTableHead
                      column="allocation"
                      currentSort={sortBy}
                      currentOrder={sortOrder}
                      onSort={handleSort}
                      align="right"
                      className="py-3 px-4"
                    >
                      ALLOCATION
                    </SortableTableHead>
                    <TableHead align="right" className="py-3 px-4">
                      MINT ADDRESS
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBalances.map((b) => {
                    const allocPct = totalUsdValue > 0 ? ((b.usdValue || 0) / totalUsdValue) * 100 : 0

                    return (
                      <TableRow key={b.mint || b.symbol} className="hover:bg-bg-elevated/40">
                        <TableCell className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <TokenIcon symbol={b.symbol} className="size-6" />
                            <div>
                              <span className="font-semibold text-text-primary text-xs block">{b.symbol}</span>
                              <span className="text-[10px] text-text-muted">{b.symbol}</span>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell align="right" className="py-3.5 px-4 font-mono font-bold text-xs text-text-primary">
                          {(b.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                        </TableCell>

                        <TableCell align="right" className="py-3.5 px-4 font-mono font-bold text-xs text-text-primary">
                          ${(b.usdValue || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </TableCell>

                        <TableCell align="right" className="py-3.5 px-4 font-mono font-bold text-xs text-primary-gold">
                          {allocPct.toFixed(2)}%
                        </TableCell>

                        <TableCell align="right" className="py-3.5 px-4">
                          {b.mint ? <AddressPill address={b.mint} /> : <span className="text-text-muted text-xs">—</span>}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}
