import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/ui/PageHeader'
import { VaultsExplorer } from '@/components/vault/VaultsExplorer'
import { generateMetadata } from '@/lib/metadata'

export const Route = createFileRoute('/invest/vaults/')({
  head: () => ({
    meta: generateMetadata({
      title: 'Browse Vaults',
      description: 'Filter and discover non-custodial Solana vaults by asset focus, TVL, and performance fee.',
      path: '/invest/vaults',
    }),
  }),
  component: VaultInvestListPage,
})

export function VaultInvestListPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Vaults"
        subtitle="Browse and invest in Solana vaults."
      />

      <VaultsExplorer
        title="Explore Solana Vaults"
        description="Discover top performing Solana vaults, track TVL, and allocate capital"
        managerOnly={false}
        showCreateButton={false}
        requireWallet={false}
        defaultViewMode="cards"
      />
    </div>
  )
}
