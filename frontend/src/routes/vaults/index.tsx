import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useVaultsQuery } from '@/services/hooks'
import { VaultsTable, type SortColumn } from './_components/VaultsTable'
import { EmptyVaultsTable } from '@/components/ui/EmptyVaultsTable'
import { SweepButton } from '@/components/ui/SweepButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Layers } from 'lucide-react'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { generateMetadata } from '@/lib/metadata'
import { vaultsSearchSchema } from '@/validations/vault'
import { STATUS_TABS, type StatusTab } from '@/constants/vault'

export const Route = createFileRoute('/vaults/')({
  validateSearch: (search) => vaultsSearchSchema.parse(search),
  head: () => ({
    meta: generateMetadata({
      title: 'Vault Management',
      description: 'Manage non-custodial Solana vaults, view performance metrics, and track investor TVL.',
      path: '/vaults',
    }),
  }),
  component: VaultsListPage,
})

function VaultsListPage() {
  useRouteWsChannel(['vaults'])
  const navigate = useNavigate({ from: Route.fullPath })
  const search = Route.useSearch()

  const currentStatus = search.status ?? 'All'
  const sortBy = search.sortBy
  const sortOrder = search.sortOrder

  const { data: vaults = [], isLoading } = useVaultsQuery({
    status: currentStatus,
    sortBy: sortBy,
    sortOrder: sortOrder,
  })

  const handleStatusChange = (status: (typeof STATUS_TABS)[number]) => {
    navigate({
      search: (prev) => ({
        ...prev,
        status: status === 'All' ? undefined : status,
      }),
      replace: true,
    })
  }

  const handleSort = (column: SortColumn) => {
    let nextOrder: 'asc' | 'desc' = 'desc'
    if (sortBy === column) {
      nextOrder = sortOrder === 'desc' ? 'asc' : 'desc'
    } else if (column === 'displayName' || column === 'created_at') {
      nextOrder = 'asc'
    }

    navigate({
      search: (prev) => ({
        ...prev,
        sortBy: column,
        sortOrder: nextOrder,
      }),
      replace: true,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vaults"
        subtitle="Create and manage Solana investment vaults."
      />

      <SectionCard
        icon={<Layers className="size-4 text-primary-coral" />}
        title="Solana Vaults"
        description="Browse, filter, and manage non-custodial Solana investment vaults"
        rightContent={
          <div className="flex flex-wrap items-center justify-between sm:justify-end gap-2.5 w-full sm:w-auto">
            <SegmentedControl
              options={STATUS_TABS}
              value={currentStatus as StatusTab}
              onChange={(tab) => handleStatusChange(tab as StatusTab)}
              className="bg-bg-inset border-0 shrink-0"
            />

            <Link to="/vaults/create" className="shrink-0">
              <SweepButton className="h-8 text-xs whitespace-nowrap">Create Vault</SweepButton>
            </Link>
          </div>
        }
      >
        {isLoading ? (
          <div className="w-full h-64 animate-pulse rounded-xl bg-bg-inset p-5" />
        ) : vaults.length === 0 ? (
          <EmptyVaultsTable
            title="No vaults found"
            description={
              currentStatus === 'All'
                ? 'Create your first Solana investment vault to get started'
                : `No vaults found with status "${currentStatus}"`
            }
            headers={['VAULT', 'PNL', 'CREATED', 'MIN', 'INVESTORS', 'ASSET', 'PERFORMANCE', 'ACTION']}
          />
        ) : (
          <VaultsTable
            vaults={vaults}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
        )}
      </SectionCard>
    </div>
  )
}
