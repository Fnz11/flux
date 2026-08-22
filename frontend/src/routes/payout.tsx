import { createFileRoute } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { useFees } from '@/hooks/useFees'
import { useClaimFee } from '@/hooks/useClaimFee'
import { PageHeader } from '@/components/ui/PageHeader'
import { PayoutSummary } from './payout/_components/PayoutSummary'
import { FeeHistory } from './payout/_components/FeeHistory'
import { Card } from '@/components/ui/card'
import { Coins, Zap, Wallet, Info } from 'lucide-react'
import { generateMetadata } from '@/lib/metadata'

export const Route = createFileRoute('/payout')({
  component: PayoutPage,
  head: () => ({
    meta: generateMetadata({
      title: 'Fee Payouts',
      description: 'Manage and claim management and performance fee distributions for your managed vaults.',
      path: '/payout',
      noIndex: true,
    }),
  }),
})

export function PayoutPage() {
  const { publicKey } = useWallet()
  const userAddress = publicKey?.toBase58()
  const { data: allVaults = [] } = useVaultsQuery()

  const vaults = useMemo(() => {
    if (!userAddress) return allVaults
    const owned = allVaults.filter(
      (v) => v.managerAddress && v.managerAddress.toLowerCase() === userAddress.toLowerCase(),
    )
    return owned.length > 0 ? owned : allVaults
  }, [allVaults, userAddress])

  const [selectedVaultId, setSelectedVaultId] = useState<string>('ALL')

  const vaultIds = useMemo(() => vaults.map((v) => v.id), [vaults])
  const { fees, isLoading } = useFees(vaultIds)
  const { claimSingleFee, claimAllFees, isClaiming, claimingVaultId } = useClaimFee()

  const filteredFees = useMemo(() => {
    return selectedVaultId === 'ALL'
      ? fees
      : fees.filter((f) => f.vault_id === selectedVaultId)
  }, [fees, selectedVaultId])

  const totalFees = useMemo(() => filteredFees.reduce((acc, f) => acc + (f.total_accrued || 0), 0), [filteredFees])
  const totalPerf = useMemo(() => filteredFees.reduce((acc, f) => acc + (f.accrued_performance_fee || 0), 0), [filteredFees])
  const totalMgmt = useMemo(() => filteredFees.reduce((acc, f) => acc + (f.accrued_management_fee || 0), 0), [filteredFees])

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Fee Payouts"
        subtitle="Manage investor payouts, automated keeper distributions, and fee claims."
      />

      {/* 3-Card Summary Top Metrics */}
      <PayoutSummary
        totalPerf={totalPerf}
        totalMgmt={totalMgmt}
        totalFees={totalFees}
        onClaimAll={() => claimAllFees(vaults, filteredFees)}
        isClaiming={isClaiming}
      />

      {/* How It Works Step Cards Grid */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Info className="size-4 text-primary-coral" />
          <h2 className="text-lg font-bold text-text-primary">How Payouts Work</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-3 items-stretch">
          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary-coral">
              <Coins className="size-4" />
              <span>01. On-Chain Accrual</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Performance and management fees accumulate continuously on-chain per vault based on trading profits & AUM.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-primary-gold">
              <Zap className="size-4" />
              <span>02. Automated Keepers</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Automated keeper bots monitor fee thresholds and execute distribution instructions automatically.
            </p>
          </Card>

          <Card className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
              <Wallet className="size-4" />
              <span>03. Direct Payouts</span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed">
              Rewards are transferred directly to manager wallet addresses or claimed via one-click distributions.
            </p>
          </Card>
        </div>
      </div>

      {/* Fee History Section */}
      <FeeHistory
        isLoading={isLoading}
        filteredFees={filteredFees}
        vaults={vaults}
        selectedVaultId={selectedVaultId}
        onSelectVault={setSelectedVaultId}
        onClaimFee={claimSingleFee}
        isClaiming={isClaiming}
        claimingVaultId={claimingVaultId}
        userAddress={userAddress}
      />
    </div>
  )
}
