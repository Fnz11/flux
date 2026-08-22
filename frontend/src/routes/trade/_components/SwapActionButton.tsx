import { cn } from '@/lib/utils'
import { Lock, ShieldAlert } from 'lucide-react'

export interface SwapActionButtonProps {
  disabled: boolean
  isExecuting: boolean
  walletConnected: boolean
  isInsufficientBalance?: boolean
  isVaultFundraising?: boolean
  isManager?: boolean
  hasVault?: boolean
  hasAmount?: boolean
  reason?: string | null
}

export function SwapActionButton({
  disabled,
  isExecuting,
  walletConnected,
  isInsufficientBalance,
  isVaultFundraising,
  isManager = true,
  hasVault = true,
  hasAmount = true,
  reason,
}: SwapActionButtonProps) {
  let label: React.ReactNode = 'Execute Swap'
  let isActionDisabled = disabled

  if (isExecuting) {
    label = 'Swapping...'
  } else if (!walletConnected) {
    label = 'Connect Wallet'
  } else if (!hasVault) {
    label = 'Select Active Vault'
  } else if (!isManager) {
    isActionDisabled = true
    label = (
      <span className="flex items-center justify-center gap-2">
        <ShieldAlert className="size-4 text-status-warn" />
        Manager Access Only
      </span>
    )
  } else if (isVaultFundraising && !isManager) {
    isActionDisabled = true
    label = (
      <span className="flex items-center justify-center gap-2">
        <Lock className="size-4" />
        Vault Locked (Fundraising)
      </span>
    )
  } else if (!hasAmount) {
    label = isVaultFundraising && isManager ? 'Enter Amount to Activate & Swap' : 'Enter Amount'
  } else if (isInsufficientBalance) {
    isActionDisabled = true
    label = 'Insufficient Vault Balance'
  } else if (isVaultFundraising && isManager) {
    label = 'Activate Vault & Execute Swap'
  }

  const tooltip =
    reason ||
    (!walletConnected
      ? 'Connect wallet to execute swaps'
      : !hasVault
        ? 'Please select a vault'
        : !isManager
          ? 'Only the vault manager can execute trades'
          : isVaultFundraising && !isManager
            ? 'Trading is locked during Fundraising phase'
            : isInsufficientBalance
              ? 'Entered amount exceeds vault token balance'
              : !hasAmount
                ? 'Enter an amount to trade'
                : isVaultFundraising && isManager
                  ? 'Activate vault and execute swap on-chain'
                  : 'Execute trade swap on-chain')

  return (
    <button
      type="submit"
      disabled={isActionDisabled}
      title={tooltip}
      className={cn(
        'mt-4 w-full rounded-xl py-3 text-sm font-bold shadow-md transition-all duration-150 cursor-pointer',
        isActionDisabled
          ? 'bg-white/[0.03] border border-white/10 text-text-muted cursor-not-allowed opacity-60'
          : 'bg-primary-coral text-white hover:bg-primary-coral/90 shadow-primary-coral/20'
      )}
    >
      {label}
    </button>
  )
}
