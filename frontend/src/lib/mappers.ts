import type {
  Vault,
  PortfolioPosition,
  AppConfig,
  Transaction,
  VaultStatus,
  TradeType,
} from '@/types'
import { DEFAULT_FOCUS_ASSETS_WHITELIST } from '@/constants/tokens'

export interface RawApiVault {
  id?: string
  address?: string
  managerId?: string
  manager_id?: string
  managerAddress?: string
  manager_address?: string
  status?: VaultStatus
  metadata?: {
    displayName?: string
    display_name?: string
    description?: string
    focusAssets?: string[]
    focus_assets?: string[]
    coverImageUrl?: string
    cover_image_url?: string
    tags?: string[]
  } | null
  performanceFeeBps?: number
  performance_fee_bps?: number
  managementFeeBps?: number
  management_fee_bps?: number
  tvl?: number | string
  createdAt?: string
  created_at?: string
  updatedAt?: string
  updated_at?: string
  pnl?: number
  pnl_percent?: number
  pnlPercent?: number
  min_raise_amount?: number
  minRaiseAmount?: number
  lockup_period?: number
  lockupPeriod?: number
  vault_type?: 'open' | 'closed'
  vaultType?: 'open' | 'closed'
  investors?: number
  investor_count?: number
  investorCount?: number
  sparkline?: Array<number | { value?: number; date?: string }>
}

export interface RawApiPortfolioPosition {
  id?: string
  vaultId?: string
  vault_id?: string
  vaultAddress?: string
  vault_address?: string
  vaultName?: string
  vault_name?: string
  sharesOwned?: number
  shares_owned?: number
  totalInvested?: number
  total_invested_value?: number
  averageEntryPrice?: number
  average_entry_price?: number
  currentValue?: number
  current_value?: number
  pnl?: number
  pnlPercent?: number
  pnl_percent?: number
  createdAt?: string
  created_at?: string
  investedAt?: string
  invested_at?: string
}

export interface RawApiConfig {
  dustThreshold?: number
  dust_threshold?: number
  focusAssetsWhitelist?: string[]
  focus_assets_whitelist?: string[]
  minRaiseAmount?: number
  min_raise_amount?: number
  lockupPeriod?: number
  lockup_period?: number
}

export interface RawApiTrade {
  id?: string
  transaction_signature?: string | null
  signature?: string | null
  vault_id?: string | null
  vaultId?: string | null
  executed_at?: string | number | null
  trade_type?: TradeType
  input_token?: string
  inputToken?: string
  output_token?: string
  outputToken?: string
  amount_in?: number
  amountIn?: number
  amount_out?: number
  amountOut?: number
}

export function mapApiVaultToVault(raw: RawApiVault | null | undefined): Vault {
  if (!raw) return {} as Vault
  const tvl = typeof raw.tvl === 'number' ? raw.tvl : parseFloat(raw.tvl || '0')
  const minRaiseAmount = typeof raw.min_raise_amount === 'number' ? raw.min_raise_amount : typeof raw.minRaiseAmount === 'number' ? raw.minRaiseAmount : 1

  let status = raw.status ?? 'Fundraising'
  const isTargetMet = tvl >= minRaiseAmount * 75 || tvl >= minRaiseAmount
  if (status.toLowerCase() === 'fundraising' && isTargetMet && tvl > 0) {
    status = 'Active'
  }

  const vault: Vault = {
    id: raw.id ?? '',
    address: raw.address ?? '',
    managerId: raw.managerId ?? raw.manager_id ?? '',
    managerAddress: raw.managerAddress ?? raw.manager_address ?? '',
    status,
    metadata: {
      displayName: raw.metadata?.displayName ?? raw.metadata?.display_name ?? '',
      description: raw.metadata?.description ?? '',
      focusAssets: raw.metadata?.focusAssets ?? raw.metadata?.focus_assets ?? [],
      ...(raw.metadata && ('coverImageUrl' in raw.metadata || 'cover_image_url' in raw.metadata)
        ? { coverImageUrl: raw.metadata.coverImageUrl ?? raw.metadata.cover_image_url ?? '' }
        : {}),
      ...(raw.metadata && 'tags' in raw.metadata && raw.metadata.tags
        ? { tags: raw.metadata.tags }
        : {}),
    },
    performanceFeeBps: raw.performanceFeeBps ?? raw.performance_fee_bps ?? 0,
    managementFeeBps: raw.managementFeeBps ?? raw.management_fee_bps ?? 0,
    tvl: typeof raw.tvl === 'number' ? raw.tvl : parseFloat(raw.tvl || '0'),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? new Date().toISOString(),
    pnlPercent: typeof raw.pnl_percent === 'number' ? raw.pnl_percent : typeof raw.pnlPercent === 'number' ? raw.pnlPercent : (raw.pnl ?? 0),
    minRaiseAmount: typeof raw.min_raise_amount === 'number' ? raw.min_raise_amount : typeof raw.minRaiseAmount === 'number' ? raw.minRaiseAmount : 1,
    lockupPeriod: typeof raw.lockup_period === 'number' ? raw.lockup_period : typeof raw.lockupPeriod === 'number' ? raw.lockupPeriod : 7,
    vaultType: raw.vaultType ?? raw.vault_type ?? 'open',
    investorCount: typeof raw.investor_count === 'number' ? raw.investor_count : typeof raw.investorCount === 'number' ? raw.investorCount : (raw.investors ?? 0),
  }
  if (Array.isArray(raw.sparkline)) {
    vault.sparkline = raw.sparkline.map((p) => (typeof p === 'number' ? p : Number(p?.value ?? p)))
  }
  return vault
}

export function mapApiPortfolioToPortfolio(raw: RawApiPortfolioPosition | null | undefined): PortfolioPosition {
  if (!raw) {
    return {
      vaultId: '',
      vaultAddress: '',
      vaultName: '',
      sharesOwned: 0,
      totalInvested: 0,
      averageEntryPrice: 0,
      currentValue: 0,
      pnl: 0,
      pnlPercent: 0,
    }
  }

  const sharesOwned = typeof raw.sharesOwned === 'number' ? raw.sharesOwned : Number(raw.shares_owned ?? 0)
  let totalInvested = typeof raw.totalInvested === 'number' ? raw.totalInvested : Number(raw.total_invested_value ?? 0)
  let averageEntryPrice = typeof raw.averageEntryPrice === 'number' ? raw.averageEntryPrice : Number(raw.average_entry_price ?? 0)
  const currentValue = typeof raw.currentValue === 'number' ? raw.currentValue : Number(raw.current_value ?? 0)

  // Frontend safety guard: if legacy backend entry price is 1.0 (token quantity rather than USD)
  // and current value is in USD (e.g. currentValue > totalInvested * 5), calibrate totalInvested to USD entry value
  if (averageEntryPrice <= 1.01 && totalInvested > 0 && currentValue > totalInvested * 5 && sharesOwned > 0) {
    const impliedSharePrice = currentValue / sharesOwned
    totalInvested = sharesOwned * impliedSharePrice
    averageEntryPrice = impliedSharePrice
  }

  const pnl = currentValue - totalInvested
  const pnlPercent = totalInvested > 0 ? (pnl / totalInvested) * 100 : 0

  const createdAt = raw.invested_at ?? raw.investedAt ?? raw.created_at ?? raw.createdAt ?? undefined

  return {
    vaultId: raw.vaultId ?? raw.vault_id ?? '',
    vaultAddress: raw.vaultAddress ?? raw.vault_address ?? '',
    vaultName: raw.vaultName ?? raw.vault_name ?? '',
    sharesOwned,
    totalInvested,
    averageEntryPrice,
    currentValue,
    pnl,
    pnlPercent,
    createdAt,
    investedAt: createdAt,
  }
}

export function mapApiConfigToConfig(raw: RawApiConfig | null | undefined): AppConfig {
  if (!raw) {
    return {
      dustThreshold: 0.001,
      focusAssetsWhitelist: [...DEFAULT_FOCUS_ASSETS_WHITELIST],
      minRaiseAmount: 10,
      lockupPeriod: 7,
    }
  }
  return {
    dustThreshold: raw.dustThreshold ?? raw.dust_threshold ?? 0.001,
    focusAssetsWhitelist: raw.focusAssetsWhitelist ?? raw.focus_assets_whitelist ?? [...DEFAULT_FOCUS_ASSETS_WHITELIST],
    minRaiseAmount: raw.minRaiseAmount ?? raw.min_raise_amount ?? 10,
    lockupPeriod: raw.lockupPeriod ?? raw.lockup_period ?? 7,
  }
}

export function mapApiTradeToTransaction(raw: RawApiTrade | null | undefined): Transaction {
  if (!raw) {
    return {
      id: '',
      type: 'trade',
      status: 'success',
      signature: null,
      vaultId: null,
      timestamp: Date.now(),
      errorMessage: null,
    }
  }
  return {
    id: raw.id ?? '',
    type: 'trade',
    status: 'success',
    signature: raw.transaction_signature ?? raw.signature ?? null,
    vaultId: raw.vault_id ?? raw.vaultId ?? null,
    timestamp: raw.executed_at ? new Date(raw.executed_at).getTime() : Date.now(),
    errorMessage: null,
    inputToken: raw.input_token ?? raw.inputToken,
    outputToken: raw.output_token ?? raw.outputToken,
    amountIn: raw.amount_in ?? raw.amountIn,
    amountOut: raw.amount_out ?? raw.amountOut,
  }
}
