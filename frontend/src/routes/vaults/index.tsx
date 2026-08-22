import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { VaultsExplorer } from '@/components/vault/VaultsExplorer'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { useTableSort } from '@/hooks/useTableSort'
import { generateMetadata } from '@/lib/metadata'
import { vaultsSearchSchema } from '@/validations/vault'
import type { SortColumn } from './_components/VaultsTable'
import type { StatusTab } from '@/constants/vault'

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

  const { sortBy, sortOrder, handleSort } = useTableSort<SortColumn>({
    sortBy: search.sortBy ?? 'created_at',
    sortOrder: search.sortOrder ?? 'desc',
    defaultOrder: 'desc',
    onSortChange: (nextSortBy, nextSortOrder) => {
      navigate({
        search: (prev) => ({
          ...prev,
          sortBy: nextSortBy,
          sortOrder: nextSortOrder,
        }),
        replace: true,
      })
    },
  })

  const handleStatusChange = (status: StatusTab) => {
    navigate({
      search: (prev) => ({
        ...prev,
        status: status === 'All' ? undefined : status,
      }),
      replace: true,
    })
  }

  const handleSearchChange = (val: string) => {
    navigate({
      search: (prev) => ({ ...prev, search: val || undefined }),
      replace: true,
    })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vaults"
        subtitle="Create and manage Solana investment vaults."
      />

      <VaultsExplorer
        title="Solana Vaults"
        description="Browse, filter, and manage non-custodial Solana investment vaults"
        managerOnly={true}
        showCreateButton={true}
        requireWallet={true}
        defaultViewMode="table"
        status={currentStatus as StatusTab}
        onStatusChange={handleStatusChange}
        search={search.search ?? ''}
        onSearchChange={handleSearchChange}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSort}
      />
    </div>
  )
}
