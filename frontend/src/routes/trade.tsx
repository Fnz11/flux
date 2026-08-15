import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { useTradeHistory } from '@/hooks/useTradeHistory'
import { PageHeader } from '@/components/ui/PageHeader'
import { SwapForm } from './trade/_components/SwapForm'
import { VaultAssetsPanel } from './trade/_components/VaultAssetsPanel'
import { TradeHistory } from './portfolio/_components/TradeHistory'
import { generateMetadata } from '@/lib/metadata'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'

export const Route = createFileRoute('/trade')({
  head: () => ({
    meta: generateMetadata({
      title: 'AMM Trade Console',
      description: 'Execute high-precision Pyth Oracle AMM swaps directly on your Solana vaults.',
      path: '/trade',
      noIndex: true,
    }),
  }),
  component: TradePage,
})

export function TradePage() {
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  useRouteWsChannel([walletAddress ? `portfolio:${walletAddress}` : null, 'global:trades'])

  const { data: fetchedVaults = [], isLoading: isFetchingVaults } = useVaultsQuery()

  // Filter vaults managed by current connected wallet
  const managerVaults = useMemo(() => {
    if (!walletAddress) return []
    return fetchedVaults.filter(
      (v) =>
        v.managerAddress &&
        v.managerAddress.toLowerCase() === walletAddress.toLowerCase() &&
        (v.status?.toLowerCase() === 'active' || v.status?.toLowerCase() === 'fundraising')
    )
  }, [fetchedVaults, walletAddress])

  const [selectedVaultId, setSelectedVaultId] = useState<string>('')

  // Selected vault object
  const activeVault = useMemo(() => {
    if (selectedVaultId) {
      return managerVaults.find((v) => v.id === selectedVaultId || v.address === selectedVaultId)
    }
    return managerVaults[0]
  }, [managerVaults, selectedVaultId])

  const vaultIds = useMemo(() => (activeVault ? [activeVault.id] : managerVaults.map((v) => v.id)), [activeVault, managerVaults])
  const { trades, isLoading: tradesLoading } = useTradeHistory(vaultIds)

  return (
    <div className="space-y-6 pb-12 w-full relative">
      <PageHeader
        title="AMM Trade Console"
        subtitle="Execute high-speed on-chain swaps with Pyth real-time price feeds for your Solana vaults."
      />

      <div className="space-y-6">
        <SwapForm
          preselectedVaultId={activeVault?.id}
          vaults={managerVaults}
          isLoadingVaults={isFetchingVaults}
          onVaultChange={(id) => setSelectedVaultId(id)}
        />

        <div className="flex flex-col gap-6">
          <VaultAssetsPanel
            vaultId={activeVault?.id}
            vaultName={activeVault?.metadata?.displayName}
            vaults={managerVaults}
            onVaultChange={(id) => setSelectedVaultId(id)}
          />

          <TradeHistory trades={trades} isLoading={tradesLoading} />
        </div>
      </div>
    </div>
  )
}

