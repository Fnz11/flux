import { createFileRoute } from '@tanstack/react-router'
import { generateMetadata } from '@/lib/metadata'
import { VaultDetailView } from '@/components/detail-vault'

export const Route = createFileRoute('/invest/vaults/$id/')({
  head: ({ params }) => ({
    meta: generateMetadata({
      title: `Invest - Vault ${params.id}`,
      description: 'Explore strategy parameters, on-chain holdings, and invest into this automated Solana vault.',
    }),
  }),
  component: VaultInvestDetailPage,
})

export function VaultInvestDetailPage() {
  const { id } = Route.useParams()
  return <VaultDetailView id={id} backTo="/invest/vaults" isInvestorView={true} />
}
