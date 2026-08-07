import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useVaultsQuery } from '@/services/hooks'
import { VaultsTable, type SortColumn } from './_components/VaultsTable'
import { EmptyVaultsTable } from '@/components/ui/EmptyVaultsTable'
import { SweepButton } from '@/components/ui/SweepButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { Layers } from 'lucide-react'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { cn } from '@/lib/utils'
import { generateMetadata } from '@/lib/metadata'

const vaultsSearchSchema = z.object({
  status: z.enum(['All', 'Fundraising', 'Active', 'Dormant']).optional(),
  sortBy: z.enum(['displayName', 'pnl', 'created_at', 'min_raise_amount', 'investors', 'tvl']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
})

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

const STATUS_TABS = ['All', 'Fundraising', 'Active', 'Dormant'] as const

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
            <div className="flex items-center space-x-1 rounded-xl bg-bg-inset p-1 overflow-x-auto max-w-full no-scrollbar shrink-0">
              {STATUS_TABS.map((tab) => {
                const isActive = currentStatus === tab
                return (
                  <button
                    key={tab}
                    onClick={() => handleStatusChange(tab)}
                    className={cn(
                      'px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap',
                      isActive
                        ? 'bg-primary-coral/10 text-primary-coral border border-primary-coral/30 shadow-xs'
                        : 'text-text-tertiary hover:text-text-primary hover:bg-bg-elevated'
                    )}
                  >
                    {tab}
                  </button>
                )
              })}
            </div>

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
