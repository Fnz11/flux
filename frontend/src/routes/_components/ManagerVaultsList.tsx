import { Link } from '@tanstack/react-router'
import { PlusCircle, ChevronRight } from 'lucide-react'
import { useVaultsQuery } from '@/services/hooks'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SweepButton } from '@/components/ui/SweepButton'
import { VaultSparkline } from '@/routes/vaults/_components/VaultSparkline'
import { cn } from '@/lib/utils'

interface ManagerVaultsListProps {
  walletAddress: string
}

export function ManagerVaultsList({ walletAddress }: ManagerVaultsListProps) {
  const { data: vaults = [], isLoading } = useVaultsQuery({
    managerAddress: walletAddress,
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Your Vaults</h2>
          <p className="text-xs text-text-tertiary">Vaults managed by your wallet (sorted by creation date)</p>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/vaults" className="text-[13px] text-primary-coral hover:underline font-medium">
            View All →
          </Link>
          <Link to="/vaults/create">
            <SweepButton className="h-8 px-3 text-xs">
              <PlusCircle className="h-4 w-4 mr-1.5 inline-block" />
              Create Vault
            </SweepButton>
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className="h-44 w-full animate-pulse rounded-xl border border-border-subtle bg-bg-elevated/40" />
      ) : vaults.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-bg-elevated/30 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-coral/10 text-primary-coral mb-3">
            <PlusCircle className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">No Vaults Created Yet</h3>
          <p className="mt-1 text-xs text-text-tertiary max-w-sm">
            Launch your own Solana investment vault and start attracting capital today.
          </p>
          <Link to="/vaults/create" className="mt-4">
            <SweepButton>Create Your First Vault</SweepButton>
          </Link>
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-border-subtle bg-bg-elevated/60 shadow-lg backdrop-blur-md">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-bg-inset/40 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              <tr>
                <th className="py-3 px-5">VAULT NAME</th>
                <th className="py-3 px-4">STATUS</th>
                <th className="py-3 px-4">TVL</th>
                <th className="py-3 px-4">PNL</th>
                <th className="py-3 px-4">CREATED</th>
                <th className="py-3 px-4">PERFORMANCE</th>
                <th className="py-3 px-5 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {vaults.map((vault) => {
                const pnl = vault.pnlPercent ?? 0
                const isPositive = pnl >= 0
                const displayName = vault.metadata.displayName || `Vault ${vault.address.slice(0, 4)}...${vault.address.slice(-4)}`
                return (
                  <tr key={vault.id} className="hover:bg-bg-elevated/80 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-text-primary whitespace-nowrap">
                      {displayName}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={vault.status} />
                    </td>
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap text-text-primary">
                      ${vault.tvl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={cn(
                      'py-3.5 px-4 font-mono font-semibold whitespace-nowrap',
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    )}>
                      {isPositive ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-text-tertiary whitespace-nowrap">
                      {new Date(vault.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <VaultSparkline isPositive={isPositive} width={80} height={24} />
                    </td>
                    <td className="py-3.5 px-5 text-right whitespace-nowrap">
                      <Link
                        to="/vaults/$id"
                        params={{ id: vault.id }}
                        className="inline-flex items-center text-xs font-medium text-primary-coral hover:underline"
                      >
                        Manage <ChevronRight className="ml-1 h-3.5 w-3.5" />
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
