import { cn } from '@/lib/utils'

export interface SwapActionButtonProps {
  disabled: boolean
  isExecuting: boolean
  walletConnected: boolean
  isInsufficientBalance?: boolean
  hasVault?: boolean
  hasAmount?: boolean
}

export function SwapActionButton({
  disabled,
  isExecuting,
  walletConnected,
  isInsufficientBalance,
  hasVault = true,
  hasAmount = true,
}: SwapActionButtonProps) {
  let label = 'Execute Swap'
  if (isExecuting) {
    label = 'Swapping...'
  } else if (!walletConnected) {
    label = 'Connect Wallet'
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
      disabled={disabled}
      className={cn(
        'mt-4 w-full rounded-xl py-3 text-sm font-bold shadow-md transition-all duration-150 cursor-pointer',
        disabled
          ? 'bg-white/[0.03] border border-white/10 text-text-muted cursor-not-allowed opacity-60'
          : 'bg-primary-coral text-white hover:bg-primary-coral/90 shadow-primary-coral/20'
      )}
    >
      {label}
    </button>
  )
}
