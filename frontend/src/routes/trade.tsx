import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { SwapForm } from '@/routes/trade/_components/SwapForm'

const tradeSearchSchema = z.object({
  vaultId: z.string().optional(),
})

export const Route = createFileRoute('/trade')({
  component: TradePage,
  validateSearch: (search) => tradeSearchSchema.parse(search),
})

function TradePage() {
  const { vaultId } = Route.useSearch()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Trade</h1>
        <p className="mt-2 text-text-secondary">Execute Pyth Oracle-powered AMM trades.</p>
      </div>

      <SwapForm preselectedVaultId={vaultId} />
    </div>
  )
}
