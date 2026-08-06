import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import { PlusCircle, ChevronRight, Layers } from 'lucide-react'
import { useVaultsQuery } from '@/services/hooks'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { VaultSparkline } from '@/routes/vaults/_components/VaultSparkline'
import { cn } from '@/lib/utils'

interface ManagerVaultsListProps {
  walletAddress: string
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', { timeZone: 'UTC' })
}

export function ManagerVaultsList({ walletAddress }: ManagerVaultsListProps) {
  const { data: vaults = [], isLoading } = useVaultsQuery({
    managerAddress: walletAddress,
    sortBy: 'created_at',
    sortOrder: 'desc',
  })

  const createdAtByVaultId = useMemo(() => {
    const byId: Record<string, string> = {}
    for (const vault of vaults) {
      byId[vault.id] = formatDate(vault.createdAt)
    }
    return byId
  }, [vaults])

  return (
    <SectionCard
      icon={<Layers className="size-4 text-primary-coral" />}
      title="Your Vaults"
      description="Vaults managed by your wallet sorted by creation date"
      rightContent={
        <div className="flex items-center gap-3">
          <Link to="/vaults" className="text-xs text-primary-coral hover:underline font-semibold">
            View All →
          </Link>
          <Link to="/vaults/create">
            <SweepButton className="h-8 text-xs">
              Create Vault
            </SweepButton>
          </Link>
        </div>
      }
    >
      {isLoading ? (
        <div className="h-44 w-full animate-pulse rounded-xl border border-border-subtle bg-bg-elevated/40" />
      ) : vaults.length === 0 ? (
        <div className="rounded-xl border border-border-subtle/50 bg-bg-inset/40 p-4">
          <EmptyState
            icon={<PlusCircle className="size-5" />}
            title="No Vaults Created Yet"
            description="Launch your own Solana investment vault and start attracting capital today."
            size="md"
          />
          <div className="mt-2 flex justify-center">
            <Link to="/vaults/create">
              <SweepButton>Create Your First Vault</SweepButton>
            </Link>
          </div>
        </div>
      ) : (
        <div className="w-full overflow-x-auto rounded-xl border border-border-subtle/60 bg-bg-inset/40 shadow-lg">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border-subtle bg-bg-inset/60 text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
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
            <tbody className="divide-y divide-border-subtle/50">
              {vaults.map((vault) => {
                const pnl = vault.pnlPercent ?? 0
                const isPositive = pnl >= 0
                const displayName = vault.metadata.displayName || `Vault ${vault.address.slice(0, 4)}...${vault.address.slice(-4)}`
                return (
                  <tr key={vault.id} className="hover:bg-bg-elevated/60 transition-colors">
                    <td className="py-3.5 px-5 font-semibold text-text-primary whitespace-nowrap text-xs">
                      {displayName}
                    </td>
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <StatusBadge status={vault.status} />
                    </td>
                    <td className="py-3.5 px-4 font-mono whitespace-nowrap text-xs text-text-primary">
                      ${vault.tvl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className={cn(
                      'py-3.5 px-4 font-mono font-semibold whitespace-nowrap text-xs',
                      isPositive ? 'text-emerald-400' : 'text-rose-400'
                    )}>
                      {isPositive ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-text-tertiary whitespace-nowrap">
                      {createdAtByVaultId[vault.id]}
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
    </SectionCard>
  )
}
