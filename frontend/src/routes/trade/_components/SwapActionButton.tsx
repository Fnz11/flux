export interface SwapActionButtonProps {
  disabled: boolean
  isExecuting: boolean
  walletConnected: boolean
}

export function SwapActionButton({ disabled, isExecuting, walletConnected }: SwapActionButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className={`mt-4 w-full rounded-xl py-3 text-sm font-bold shadow-lg transition-all cursor-pointer ${
        disabled
          ? 'bg-bg-inset border border-border-subtle text-text-muted cursor-not-allowed'
          : 'bg-gradient-to-r from-primary-coral via-primary-amber to-primary-gold text-black hover:brightness-110 shadow-primary-coral/20'
      }`}
    >
      {isExecuting ? 'Swapping...' : !walletConnected ? 'Connect Wallet' : 'Execute Swap'}
    </button>
  )
}
