import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { useMemo, useState, useEffect } from 'react'
import { SwapForm } from '@/routes/trade/_components/SwapForm'
import { VaultAssetsPanel } from '@/routes/trade/_components/VaultAssetsPanel'
import { TradeHistory } from '@/routes/portfolio/_components/TradeHistory'
import { useAppStore } from '@/stores/app-store'
import { PageHeader } from '@/components/ui/PageHeader'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { useTradeHistory } from '@/hooks/useTradeHistory'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'

const tradeSearchSchema = z.object({
  vaultId: z.string().optional(),
})

import { generateMetadata } from '@/lib/metadata'

export const Route = createFileRoute('/trade')({
  head: () => ({
    meta: generateMetadata({
      title: 'Manager Trade Console',
      description: 'Execute DEX token swaps, manage liquidity, and rebalance assets for your Solana vaults.',
      path: '/trade',
      noIndex: true,
    }),
  }),
  component: TradePage,
  validateSearch: (search) => tradeSearchSchema.parse(search),
  beforeLoad: () => {
    // Note: beforeLoad is not a React component, must use .getState(), not hook selector
    const isManager = useAppStore.getState().isManager
    if (!isManager) {
      throw redirect({
        to: '/invest',
      })
    }
  },
})

function TradePage() {
  const { vaultId: searchVaultId } = Route.useSearch()
  const { data: vaults = [] } = useVaultsQuery()
  const [selectedVaultId, setSelectedVaultId] = useState<string | undefined>(searchVaultId)

  useEffect(() => {
    if (searchVaultId) {
      setSelectedVaultId(searchVaultId)
    } else if (vaults.length > 0 && !selectedVaultId) {
      setSelectedVaultId(vaults[0].id)
    }
  }, [searchVaultId, vaults, selectedVaultId])

  useRouteWsChannel([selectedVaultId ? `vault:${selectedVaultId}` : 'vaults'])

  const selectedVault = useMemo(
    () => vaults.find((v) => v.id === selectedVaultId),
    [vaults, selectedVaultId]
  )

  const targetIds = useMemo(
    () => (selectedVaultId ? [selectedVaultId] : vaults.map((v) => v.id)),
    [selectedVaultId, vaults],
  )

  const { trades, isLoading: tradesLoading } = useTradeHistory(targetIds)

  return (
    <div className="space-y-5">
      <PageHeader 
        title="Trade"
        subtitle="Execute Pyth Oracle-powered AMM trades."
      />

      <VaultAssetsPanel
        vaultId={selectedVaultId}
        vaultName={selectedVault?.metadata?.displayName}
      />

      <SwapForm
        preselectedVaultId={selectedVaultId}
        onVaultChange={setSelectedVaultId}
      />

      <div className="mt-4">
        <TradeHistory trades={trades} isLoading={tradesLoading} />
      </div>
    </div>
  )
}
