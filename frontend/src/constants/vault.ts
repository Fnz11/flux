export const STATUS_TABS = ['All', 'Fundraising', 'Active', 'Dormant'] as const
export type StatusTab = (typeof STATUS_TABS)[number]

export const FOCUS_ASSETS = ['All', 'SOL', 'USDC', 'BTC', 'ETH'] as const
export type FocusAsset = (typeof FOCUS_ASSETS)[number]

export const RAISE_UNITS = ['SOL', 'USDC', 'USDT'] as const
export type RaiseUnit = (typeof RAISE_UNITS)[number]

export const FEE_WITHDRAWAL_PERIODS = ['weekly', 'monthly', 'quarterly', 'yearly'] as const
export type FeeWithdrawalPeriod = (typeof FEE_WITHDRAWAL_PERIODS)[number]

export const LOCKUP_PERIOD_UNITS = ['hours', 'days'] as const
export type LockupPeriodUnit = (typeof LOCKUP_PERIOD_UNITS)[number]

export const VAULT_TYPES = ['open', 'closed'] as const
export type VaultType = (typeof VAULT_TYPES)[number]
