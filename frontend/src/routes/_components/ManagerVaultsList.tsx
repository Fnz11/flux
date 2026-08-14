import { Link } from '@tanstack/react-router'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Table, TableHeader, TableBody, TableRow, TableHead } from '@/components/ui/table'
import { TableRowSkeleton } from '@/components/ui/TableSkeleton'
import { Shield, PlusCircle } from 'lucide-react'
import { ManagedVaultRow } from './ManagedVaultRow'

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
            <TableRowSkeleton
              columns={7}
              rows={4}
              cellAligns={['left', 'left', 'right', 'right', 'right', 'right', 'right']}
              cellWidths={['w-36', 'w-16', 'w-20', 'w-16', 'w-20', 'w-20', 'w-16']}
            />
          </TableBody>
        </Table>
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
            {vaults.map((vault) => (
              <ManagedVaultRow key={vault.id} vault={vault} />
            ))}
          </TableBody>
        </Table>
      )}
    </SectionCard>
  )
}
