import { createFileRoute } from '@tanstack/react-router'
import { WalletStatus } from './settings/_components/WalletStatus'
import { RpcConfig } from './settings/_components/RpcConfig'
import { TradePreferences } from './settings/_components/TradePreferences'

import { generateMetadata } from '@/lib/metadata'

export const Route = createFileRoute('/settings')({
  head: () => ({
    meta: generateMetadata({
      title: 'Settings',
      description: 'Configure Solana RPC endpoints, default trade slippage, and platform preferences.',
      path: '/settings',
      noIndex: true,
    }),
  }),
  component: SettingsPage,
})

export function SettingsPage() {
  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-2 text-text-secondary">Configure network RPC, trading slippage, and platform preferences.</p>
      </div>

      <WalletStatus />
      <RpcConfig />
      <TradePreferences />
    </div>
  )
}
