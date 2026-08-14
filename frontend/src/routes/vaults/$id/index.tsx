import { createFileRoute } from '@tanstack/react-router'
import { generateMetadata } from '@/lib/metadata'
import { VaultDetailView } from '@/components/detail-vault'

export const Route = createFileRoute('/vaults/$id/')({
  head: ({ params }) => ({
    meta: generateMetadata({
      title: `Vault ${params.id}`,
      description: 'Explore strategy parameters, on-chain holdings, and trade history for this automated Solana vault.',
    }),
  }),
  component: VaultDetailPage,
})

export function VaultDetailPage() {
  const { id } = Route.useParams()
  return <VaultDetailView id={id} backTo="/vaults" />
}
