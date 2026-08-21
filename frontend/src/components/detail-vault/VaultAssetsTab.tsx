import { VaultAssetsPanel } from '@/components/vault/VaultAssetsPanel'
import type { Vault } from '@/types'

export interface VaultAssetsTabProps {
  vault: Vault
  isManager?: boolean
}

export function VaultAssetsTab({ vault, isManager }: VaultAssetsTabProps) {
  return (
    <VaultAssetsPanel
      vault={vault}
      isManager={isManager}
      showSwapButton={true}
      showTable={false}
      title="Asset Holdings & Allocations"
      description="On-chain non-custodial token balances, visual allocation donut, and weight breakdown."
    />
  )
}
