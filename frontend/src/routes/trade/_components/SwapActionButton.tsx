import { cn } from '@/lib/utils'
import { Lock } from 'lucide-react'

export interface SwapActionButtonProps {
  disabled: boolean
  isExecuting: boolean
  walletConnected: boolean
  isInsufficientBalance?: boolean
  isVaultFundraising?: boolean
  hasVault?: boolean
  hasAmount?: boolean
}

export function SwapActionButton({
  disabled,
  isExecuting,
  walletConnected,
  isInsufficientBalance,
  isVaultFundraising,
  hasVault = true,
  hasAmount = true,
}: SwapActionButtonProps) {
  let label: React.ReactNode = 'Execute Swap'
  if (isExecuting) {
    label = 'Swapping...'
  } else if (!walletConnected) {
    label = 'Connect Wallet'
  } else if (isVaultFundraising) {
    label = (
      <span className="flex items-center justify-center gap-2">
        <Lock className="size-4" />
        Vault Locked (Fundraising)
      </span>
    )
  } else if (!hasVault) {
    label = 'Select Active Vault'
  } else if (!hasAmount) {
    label = 'Enter Amount'
  } else if (isInsufficientBalance) {
    label = 'Insufficient Vault Balance'
  }

  return (
    <button
      type="submit"
      disabled={disabled || isVaultFundraising}
      className={cn(
        'mt-4 w-full rounded-xl py-3 text-sm font-bold shadow-md transition-all duration-150 cursor-pointer',
        disabled || isVaultFundraising
          ? 'bg-white/[0.03] border border-white/10 text-text-muted cursor-not-allowed opacity-60'
          : 'bg-primary-coral text-white hover:bg-primary-coral/90 shadow-primary-coral/20'
      )}
    >
      {label}
    </button>
  )
}
