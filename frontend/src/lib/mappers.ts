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
    acceptedAssets?: string[]
    accepted_assets?: string[]
    coverImageUrl?: string
    cover_image_url?: string
    tags?: string[]
    depositMint?: string
    deposit_mint?: string
  } | null
  depositMint?: string
  deposit_mint?: string
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

  let metadataObj: Record<string, unknown> = {}
  if (typeof raw.metadata === 'string') {
    try {
      metadataObj = JSON.parse(raw.metadata) as Record<string, unknown>
    } catch {
      metadataObj = {}
    }
  } else if (raw.metadata && typeof raw.metadata === 'object') {
    metadataObj = raw.metadata as Record<string, unknown>
  }

  const focusAssets = Array.isArray(metadataObj.focusAssets)
    ? metadataObj.focusAssets
    : Array.isArray(metadataObj.focus_assets)
      ? metadataObj.focus_assets
      : []

  const acceptedAssets = Array.isArray(metadataObj.acceptedAssets)
    ? metadataObj.acceptedAssets
    : Array.isArray(metadataObj.accepted_assets)
      ? metadataObj.accepted_assets
      : undefined

  const depositMint =
    (typeof raw.depositMint === 'string' && raw.depositMint) ||
    (typeof raw.deposit_mint === 'string' && raw.deposit_mint) ||
    (typeof metadataObj.depositMint === 'string' && metadataObj.depositMint) ||
    (typeof metadataObj.deposit_mint === 'string' && metadataObj.deposit_mint) ||
    undefined

  const pnlPercent = typeof raw.pnl_percent === 'number'
    ? raw.pnl_percent
    : typeof raw.pnlPercent === 'number'
      ? raw.pnlPercent
      : raw.pnl_percent != null && !isNaN(Number(raw.pnl_percent))
        ? Number(raw.pnl_percent)
        : raw.pnlPercent != null && !isNaN(Number(raw.pnlPercent))
          ? Number(raw.pnlPercent)
          : (Number(raw.pnl) || 0)

  const vault: Vault = {
    id: raw.id ?? '',
    address: raw.address ?? '',
    managerId: raw.managerId ?? raw.manager_id ?? '',
    managerAddress: raw.managerAddress ?? raw.manager_address ?? '',
    status,
    metadata: {
      displayName: String(metadataObj.displayName ?? metadataObj.display_name ?? ''),
      description: String(metadataObj.description ?? ''),
      focusAssets: focusAssets.filter((t: unknown): t is string => typeof t === 'string' && t.toUpperCase() !== 'BONK'),
      ...(acceptedAssets
        ? { acceptedAssets: acceptedAssets.filter((t: unknown): t is string => typeof t === 'string' && t.toUpperCase() !== 'BONK') }
        : {}),
      ...(metadataObj.coverImageUrl || metadataObj.cover_image_url
        ? { coverImageUrl: String(metadataObj.coverImageUrl ?? metadataObj.cover_image_url) }
        : {}),
      ...(metadataObj.tags
        ? { tags: Array.isArray(metadataObj.tags) ? (metadataObj.tags as string[]) : [] }
        : {}),
      ...(depositMint ? { depositMint } : {}),
    },
    performanceFeeBps: Number(raw.performanceFeeBps ?? raw.performance_fee_bps) || 0,
    managementFeeBps: Number(raw.managementFeeBps ?? raw.management_fee_bps) || 0,
    tvl: typeof raw.tvl === 'number' ? raw.tvl : parseFloat(String(raw.tvl || '0')),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? new Date().toISOString(),
    pnlPercent,
    minRaiseAmount: typeof raw.min_raise_amount === 'number' ? raw.min_raise_amount : typeof raw.minRaiseAmount === 'number' ? raw.minRaiseAmount : 1,
    lockupPeriod: typeof raw.lockup_period === 'number' ? raw.lockup_period : typeof raw.lockupPeriod === 'number' ? raw.lockupPeriod : 7,
    vaultType: raw.vaultType ?? raw.vault_type ?? 'open',
    investorCount: typeof raw.investor_count === 'number' ? raw.investor_count : typeof raw.investorCount === 'number' ? raw.investorCount : (raw.investors ?? 0),
    ...(depositMint ? { depositMint } : {}),
  }
  if (Array.isArray(raw.sparkline)) {
    vault.sparkline = raw.sparkline.map((p) => (typeof p === 'number' ? p : Number(p?.value ?? p)))
  }
  return vault
}

export function mapApiPortfolioToPortfolio(raw: RawApiPortfolioPosition | null | undefined): PortfolioPosition {
  if (raw == null) {
    return {} as PortfolioPosition
  }

  const sharesOwned = typeof raw.sharesOwned === 'number' ? raw.sharesOwned : Number(raw.shares_owned ?? 0)
  const totalInvested = typeof raw.totalInvested === 'number' ? raw.totalInvested : Number(raw.total_invested_value ?? 0)
  const averageEntryPrice = typeof raw.averageEntryPrice === 'number' ? raw.averageEntryPrice : Number(raw.average_entry_price ?? 0)
  const currentValue = typeof raw.currentValue === 'number' ? raw.currentValue : Number(raw.current_value ?? 0)

  const pnl = typeof raw.pnl === 'number' ? raw.pnl : raw.pnl != null && !isNaN(Number(raw.pnl)) ? Number(raw.pnl) : (currentValue - totalInvested)
  const pnlPercent = typeof raw.pnlPercent === 'number'
    ? raw.pnlPercent
    : typeof raw.pnl_percent === 'number'
      ? raw.pnl_percent
      : raw.pnl_percent != null && !isNaN(Number(raw.pnl_percent))
        ? Number(raw.pnl_percent)
        : (totalInvested > 0 ? (pnl / totalInvested) * 100 : 0)

  const createdAt = raw.invested_at ?? raw.investedAt ?? raw.created_at ?? raw.createdAt ?? undefined

  const result: PortfolioPosition = {
    vaultId: raw.vaultId ?? raw.vault_id ?? '',
    vaultAddress: raw.vaultAddress ?? raw.vault_address ?? '',
    vaultName: raw.vaultName ?? raw.vault_name ?? '',
    sharesOwned,
    totalInvested,
    averageEntryPrice,
    currentValue,
    pnl,
    pnlPercent,
  }

  if (createdAt !== undefined) {
    result.createdAt = createdAt
    result.investedAt = createdAt
  }

  return result
}

export function mapApiConfigToConfig(raw: RawApiConfig | null | undefined): AppConfig {
  if (!raw) {
    return {
      dustThreshold: 0.001,
      focusAssetsWhitelist: [...DEFAULT_FOCUS_ASSETS_WHITELIST],
      minRaiseAmount: 1,
      lockupPeriod: 7,
    }
  }
  const rawList = raw.focusAssetsWhitelist ?? raw.focus_assets_whitelist
  const whitelist = Array.isArray(rawList) && rawList.length > 0
    ? rawList.filter((t) => t.toUpperCase() !== 'BONK')
    : [...DEFAULT_FOCUS_ASSETS_WHITELIST]

  return {
    dustThreshold: raw.dustThreshold ?? raw.dust_threshold ?? 0.001,
    focusAssetsWhitelist: whitelist.length > 0 ? whitelist : [...DEFAULT_FOCUS_ASSETS_WHITELIST],
    minRaiseAmount: raw.minRaiseAmount ?? raw.min_raise_amount ?? 1,
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
