import { createFileRoute, redirect, Link } from '@tanstack/react-router'
import { useMemo, useState, useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { SwapForm } from '@/routes/trade/_components/SwapForm'
import { VaultAssetsPanel } from '@/routes/trade/_components/VaultAssetsPanel'
import { TradeHistory } from '@/routes/portfolio/_components/TradeHistory'
import { useAppStore } from '@/stores/app-store'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { WalletPrompt } from '@/components/ui/WalletPrompt'
import { SweepButton } from '@/components/ui/SweepButton'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { useTradeHistory } from '@/hooks/useTradeHistory'
import { useRouteWsChannel } from '@/hooks/useRouteWsChannel'
import { generateMetadata } from '@/lib/metadata'
import { tradeSearchSchema } from '@/validations/trade'
import { Shield, PlusCircle } from 'lucide-react'

export const Route = createFileRoute('/trade')({
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
  head: () => ({
    meta: generateMetadata({
      title: 'Manager Trade Console',
      description: 'Execute DEX token swaps, manage liquidity, and rebalance assets for your Solana vaults.',
      path: '/trade',
      noIndex: true,
    }),
  }),
  component: TradePage,
})

function TradePage() {
  const { vaultId: searchVaultId } = Route.useSearch()
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  const { data: allVaults = [], isLoading: vaultsLoading } = useVaultsQuery()

  // Filter to only active vaults owned by the connected manager wallet
  const managedVaults = useMemo(() => {
    if (!walletAddress) return []
    return allVaults.filter(
      (v) =>
        v.managerAddress &&
        v.managerAddress.toLowerCase() === walletAddress.toLowerCase() &&
        v.status?.toLowerCase() === 'active'
    )
  }, [allVaults, walletAddress])

  const hasAnyManagedVaults = useMemo(() => {
    if (!walletAddress) return false
    return allVaults.some(
      (v) => v.managerAddress && v.managerAddress.toLowerCase() === walletAddress.toLowerCase()
    )
  }, [allVaults, walletAddress])

  const [selectedVaultId, setSelectedVaultId] = useState<string | undefined>(undefined)

  useEffect(() => {
    if (searchVaultId && managedVaults.some((v) => v.id === searchVaultId)) {
      setSelectedVaultId(searchVaultId)
    } else if (managedVaults.length > 0 && (!selectedVaultId || !managedVaults.some((v) => v.id === selectedVaultId))) {
      setSelectedVaultId(managedVaults[0].id)
    } else if (managedVaults.length === 0) {
      setSelectedVaultId(undefined)
    }
  }, [searchVaultId, managedVaults, selectedVaultId])

  useRouteWsChannel([selectedVaultId ? `vault:${selectedVaultId}` : 'vaults'])

  const selectedVault = useMemo(
    () => managedVaults.find((v) => v.id === selectedVaultId),
    [managedVaults, selectedVaultId]
  )

  const targetIds = useMemo(
    () => (selectedVaultId ? [selectedVaultId] : managedVaults.map((v) => v.id)),
    [selectedVaultId, managedVaults],
  )

  const { trades, isLoading: tradesLoading } = useTradeHistory(targetIds)

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Trade Console"
        subtitle="Execute Pyth Oracle-powered AMM trades & rebalance vault liquidity."
      />

      {!walletAddress ? (
        <WalletPrompt description="Please connect your manager wallet to access the trade console." />
      ) : !vaultsLoading && managedVaults.length === 0 ? (
        <SectionCard
          icon={<Shield className="size-4 text-primary-coral" />}
          title={hasAnyManagedVaults ? "No Active Vaults Available" : "No Managed Vaults Found"}
          description={hasAnyManagedVaults ? "Only active vaults can execute DEX trades and manage liquidity." : "You do not manage any investment vaults on this wallet."}
        >
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="rounded-full bg-bg-inset p-4 border border-border-subtle">
              <Shield className="size-8 text-primary-coral" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-semibold text-text-primary">
                {hasAnyManagedVaults ? "Active Vault Required" : "Manager Authority Required"}
              </h3>
              <p className="text-xs text-text-secondary max-w-md">
                {hasAnyManagedVaults
                  ? "Your managed vaults are currently in fundraising or paused status. Activate a vault to start trading."
                  : "Only the designated manager of an active vault can execute DEX swaps and rebalance its assets. Launch your own vault to start trading."}
              </p>
            </div>
            <Link to={hasAnyManagedVaults ? "/vaults" : "/vaults/create"}>
              <SweepButton className="h-9 px-4 text-xs font-semibold">
                <PlusCircle className="mr-1.5 size-3.5" />
                {hasAnyManagedVaults ? "View Managed Vaults" : "Create Your First Vault"}
              </SweepButton>
            </Link>
          </div>
        </SectionCard>
      ) : (
        <>
          {/* 1. Vault Assets & Balances Cockpit */}
          <VaultAssetsPanel
            vaultId={selectedVaultId}
            vaultName={selectedVault?.metadata?.displayName}
            vaults={managedVaults}
            onVaultChange={setSelectedVaultId}
          />

          {/* 2. Swap Console & Oracle Live Feeds */}
          <SwapForm
            preselectedVaultId={selectedVaultId}
            vaults={managedVaults}
            isLoadingVaults={vaultsLoading}
            onVaultChange={setSelectedVaultId}
          />

          {/* 3. Trade History Console */}
          <div className="pt-2">
            <TradeHistory trades={trades} isLoading={tradesLoading} />
          </div>
        </>
      )}
    </div>
  )
}
