import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { TrendingUp, ChevronRight } from 'lucide-react'
import { usePortfolioQuery, useVaultsQuery } from '@/services/hooks'
import { VaultSparkline } from '@/routes/vaults/_components/VaultSparkline'
import { cn } from '@/lib/utils'

interface InvestorVaultsListProps {
  walletAddress: string
}

export function InvestorVaultsList({ walletAddress }: InvestorVaultsListProps) {
  const { data: positions = [], isLoading: isPortfolioLoading } = usePortfolioQuery(walletAddress)
  const { data: vaults = [], isLoading: isVaultsLoading } = useVaultsQuery()

  const isLoading = isPortfolioLoading || isVaultsLoading

  const sortedInvestments = useMemo(() => {
    if (!positions || positions.length === 0) return []
    // Map position with vault details if available
    const mapped = positions.map((p) => {
      const v = vaults.find((v) => v.id === p.vaultId || v.address === p.vaultAddress)
      return {
        ...p,
        vaultName: p.vaultName || v?.metadata.displayName || `Vault ${p.vaultAddress.slice(0, 4)}...`,
        status: v?.status ?? 'Active',
      }
    })
    // Sort invested positions (most recently updated/invested first)
    return mapped
  }, [positions, vaults])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Your Investments</h2>
          <p className="text-xs text-text-tertiary">Vault positions in your active portfolio</p>
        </div>
        <Link to="/portfolio" className="text-[13px] text-primary-coral hover:underline font-medium">
          View Portfolio →
        </Link>
      </div>

      {isLoading ? (
        <div className="h-44 w-full animate-pulse rounded-xl border border-border-subtle bg-bg-elevated/40" />
      ) : sortedInvestments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-elevated/30 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400 mb-3">
            <TrendingUp className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">No Active Investments</h3>
          <p className="mt-1 text-xs text-text-tertiary max-w-sm">
            Deposit into top-performing Solana vaults to earn yields managed by pros.
          </p>
          <Link to="/vaults" className="mt-4">
            <span className="inline-flex items-center justify-center rounded-lg bg-primary-coral px-4 py-2 text-sm font-semibold text-white hover:bg-primary-coral/90 transition-colors shadow-md">
              Explore Vaults
            </span>
          </Link>
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-border-subtle bg-bg-elevated/60 shadow-lg backdrop-blur-md">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-bg-inset/40 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="py-3 px-5">VAULT NAME</th>
                <th className="py-3 px-4">SHARES</th>
                <th className="py-3 px-4">INVESTED</th>
                <th className="py-3 px-4">CURRENT VALUE</th>
                <th className="py-3 px-4">PNL</th>
                <th className="py-3 px-4">PERFORMANCE</th>
                <th className="py-3 px-5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {sortedInvestments.map((pos) => {
                const isPositive = pos.pnlPercent >= 0
                return (
                  <tr key={pos.vaultId} className="hover:bg-bg-elevated/80 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-text-primary whitespace-nowrap">
                      {pos.vaultName}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-text-secondary whitespace-nowrap">
                      {pos.sharesOwned.toFixed(4)}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-text-secondary whitespace-nowrap">
                      ${pos.totalInvested.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-text-primary whitespace-nowrap">
                      ${pos.currentValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={cn(
                      'py-3.5 px-4 font-mono font-semibold whitespace-nowrap',
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    )}>
                      {isPositive ? `+${pos.pnlPercent.toFixed(2)}%` : `${pos.pnlPercent.toFixed(2)}%`}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <VaultSparkline isPositive={isPositive} width={80} height={24} />
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <Link
                        to="/vaults/$id"
                        params={{ id: pos.vaultId }}
                        className="inline-flex items-center text-xs font-medium text-primary-coral hover:underline"
                      >
                        View Details <ChevronRight className="ml-1 h-3.5 w-3.5" />
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
