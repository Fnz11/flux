import { useWallet } from '@solana/wallet-adapter-react'
import { AddressPill } from '@/components/ui/AddressPill'
import { ShieldCheck } from 'lucide-react'

export function WalletStatus() {
  const wallet = useWallet()

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-6 space-y-4">
      <div className="flex items-center gap-3">
        <ShieldCheck className="size-5 text-primary-gold" />
        <h2 className="text-base font-semibold text-text-primary">Wallet & Account</h2>
      </div>
      {wallet.publicKey ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-bg-inset p-4">
          <div>
            <p className="text-xs text-text-tertiary">Connected Address</p>
            <div className="mt-1">
              <AddressPill address={wallet.publicKey.toBase58()} />
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success/10 px-2.5 py-1 text-xs font-medium text-status-success border border-status-success/20">
            <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
            Connected ({wallet.wallet?.adapter.name || 'Solana'})
          </span>
        </div>
      ) : (
        <p className="text-sm text-text-tertiary">
          No wallet connected. Connect your wallet to manage permissions and sign transactions.
        </p>
      )}
    </div>
  )
}
