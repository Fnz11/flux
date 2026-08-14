import { Link } from '@tanstack/react-router'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableEmpty } from '@/components/ui/table'
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
      <Table className="min-w-[640px]" containerClassName="min-h-[400px]">
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
          {isLoading ? (
            <TableRowSkeleton
              columns={7}
              rows={5}
              cellAligns={['left', 'left', 'right', 'right', 'right', 'right', 'right']}
              cellWidths={['w-36', 'w-16', 'w-20', 'w-16', 'w-20', 'w-20', 'w-16']}
            />
          ) : vaults.length === 0 ? (
            <TableEmpty
              colSpan={7}
              icon={<PlusCircle className="size-5" />}
              title="No Vaults Created Yet"
              description="Launch your own Solana investment vault and start attracting capital today."
              minHeight="min-h-[300px]"
              action={
                <Link to="/vaults/create">
                  <SweepButton className="h-8 text-xs">Create Your First Vault</SweepButton>
                </Link>
              }
            />
          ) : (
            vaults.map((vault) => (
              <ManagedVaultRow key={vault.id} vault={vault} />
            ))
          )}
        </TableBody>
      </Table>
    </SectionCard>
  )
}
