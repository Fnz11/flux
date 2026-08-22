import type { Vault, PortfolioPosition } from '@/types'

export interface ActionEligibility {
  canExecute: boolean
  reason: string | null
  unlockTime?: Date | null
}

export function getWithdrawEligibility(
  vault?: Vault | null,
  position?: PortfolioPosition | null,
  walletConnected?: boolean,
): ActionEligibility {
  if (walletConnected === false) {
    return { canExecute: false, reason: 'Connect your wallet to withdraw shares' }
  }

  if (!position || position.sharesOwned <= 0) {
    return { canExecute: false, reason: 'You have no shares in this vault to withdraw' }
  }

  if (vault) {
    const rawLockup = vault.lockupPeriod ?? 0
    const lockupSec = rawLockup >= 3600 ? rawLockup : rawLockup * 86400

    if (lockupSec > 0 && vault.createdAt) {
      const createdMs = new Date(vault.createdAt).getTime()
      if (!isNaN(createdMs) && createdMs > 0) {
        const unlockMs = createdMs + lockupSec * 1000
        const nowMs = Date.now()

        if (nowMs < unlockMs) {
          const unlockDate = new Date(unlockMs)
          const dateStr = unlockDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
          return {
            canExecute: false,
            reason: `Withdrawals locked until ${dateStr} (Lockup period active)`,
            unlockTime: unlockDate,
          }
        }
      }
    }
  }

  return { canExecute: true, reason: null, unlockTime: null }
}

export function getTradeEligibility(
  vault?: Vault | null,
  isManager?: boolean,
  walletConnected?: boolean,
): ActionEligibility {
  if (walletConnected === false) {
    return { canExecute: false, reason: 'Connect wallet to execute swaps' }
  }

  if (!vault || !vault.id) {
    return { canExecute: false, reason: 'Select an active vault to trade' }
  }

  if (!isManager) {
    return { canExecute: false, reason: 'Only the vault manager can execute trades for this vault' }
  }

  const isStatusFundraising = vault.status?.toLowerCase() === 'fundraising'
  const isStatusActive = vault.status?.toLowerCase() === 'active'

  if (!isStatusActive && !(isStatusFundraising && isManager)) {
    return {
      canExecute: false,
      reason: `Vault is currently in ${vault.status || 'Fundraising'} phase. Trading unlocks after activation.`,
    }
  }

  return { canExecute: true, reason: null }
}

export function getDepositEligibility(
  vault?: Vault | null,
  walletConnected?: boolean,
): ActionEligibility {
  if (walletConnected === false) {
    return { canExecute: false, reason: 'Connect wallet to deposit funds' }
  }

  if (!vault || !vault.id) {
    return { canExecute: false, reason: 'Select a vault to deposit' }
  }

  if (vault.status === 'Dormant') {
    return { canExecute: false, reason: 'This vault is dormant and closed for new deposits' }
  }

  return { canExecute: true, reason: null }
}
