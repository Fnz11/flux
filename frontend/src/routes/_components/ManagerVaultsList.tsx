import { Link } from '@tanstack/react-router'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { SweepButton } from '@/components/ui/SweepButton'
import { VaultSparkline } from '../vaults/_components/VaultSparkline'
import { SectionCard } from '@/components/ui/SectionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Shield, PlusCircle, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-US')

function formatCurrency(val: number): string {
  return currencyFormatter.format(val)
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : dateFormatter.format(d)
}

export function ManagerVaultsList({ walletAddress }: { walletAddress?: string }) {
  const { data: allVaults = [], isLoading } = useVaultsQuery()

  // Filter vaults managed by current wallet
  const vaults = walletAddress
    ? allVaults.filter((v) => v.managerAddress.toLowerCase() === walletAddress.toLowerCase())
    : allVaults

  return (
    <SectionCard
      icon={<Shield className="size-4 text-primary-coral" />}
      title="Managed Vaults"
      description="Investment vaults created & managed by your account"
      rightContent={
        <Link to="/vaults/create">
          <SweepButton className="h-8 text-xs">
            <PlusCircle className="mr-1.5 size-3.5" />
            Create Vault
          </SweepButton>
        </Link>
      }
    >
      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-bg-inset p-4" />
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
        <Table className="min-w-[640px]">
          <TableHeader>
            <TableRow>
              <TableHead className="py-3 px-5">VAULT NAME</TableHead>
              <TableHead className="py-3 px-4">STATUS</TableHead>
              <TableHead className="py-3 px-4">TVL</TableHead>
              <TableHead className="py-3 px-4">PNL</TableHead>
              <TableHead className="py-3 px-4">CREATED</TableHead>
              <TableHead className="py-3 px-4">PERFORMANCE</TableHead>
              <TableHead className="py-3 px-5 text-right">ACTION</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {vaults.map((vault) => {
              const pnl = vault.pnlPercent ?? 0
              const isPositive = pnl >= 0
              const displayName = vault.metadata.displayName || `Vault ${vault.address.slice(0, 4)}...${vault.address.slice(-4)}`
              return (
                <TableRow key={vault.id} className="hover:bg-bg-elevated/60 transition-colors">
                  <TableCell className="py-3.5 px-5 font-semibold text-text-primary whitespace-nowrap text-xs">
                    {displayName}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 whitespace-nowrap">
                    <StatusBadge status={vault.status} />
                  </TableCell>
                  <TableCell className="py-3.5 px-4 font-mono whitespace-nowrap text-xs text-text-primary">
                    ${formatCurrency(vault.tvl)}
                  </TableCell>
                  <TableCell className={cn(
                    'py-3.5 px-4 font-mono font-semibold whitespace-nowrap text-xs',
                    isPositive ? 'text-emerald-400' : 'text-rose-400'
                  )}>
                    {isPositive ? `+${pnl.toFixed(2)}%` : `${pnl.toFixed(2)}%`}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 font-mono text-xs text-text-tertiary whitespace-nowrap">
                    {formatDate(vault.createdAt)}
                  </TableCell>
                  <TableCell className="py-3.5 px-4 whitespace-nowrap">
                    <VaultSparkline isPositive={isPositive} />
                  </TableCell>
                  <TableCell className="py-3.5 px-5 text-right whitespace-nowrap">
                    <Link
                      to="/vaults/$id"
                      params={{ id: vault.id }}
                      className="inline-flex items-center justify-center size-7 rounded-lg bg-bg-inset text-text-secondary hover:text-primary-coral hover:bg-primary-coral/10 transition-colors border border-border-subtle"
                    >
                      <ChevronRight className="size-4" />
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
