import type {
  Vault,
  PortfolioPosition,
  AppConfig,
  Transaction,
} from '@/types'

export function mapApiVaultToVault(raw: any): Vault {
  if (!raw) return {} as Vault
  return {
    id: raw.id ?? '',
    address: raw.address ?? '',
    managerId: raw.managerId ?? raw.manager_id ?? '',
    managerAddress: raw.managerAddress ?? raw.manager_address ?? '',
    status: raw.status ?? 'Fundraising',
    metadata: {
      displayName: raw.metadata?.displayName ?? raw.metadata?.display_name ?? '',
      description: raw.metadata?.description ?? '',
      focusAssets: raw.metadata?.focusAssets ?? raw.metadata?.focus_assets ?? [],
    },
    performanceFeeBps: raw.performanceFeeBps ?? raw.performance_fee_bps ?? 0,
    managementFeeBps: raw.managementFeeBps ?? raw.management_fee_bps ?? 0,
    tvl: typeof raw.tvl === 'number' ? raw.tvl : parseFloat(raw.tvl || '0'),
    createdAt: raw.createdAt ?? raw.created_at ?? new Date().toISOString(),
    updatedAt: raw.updatedAt ?? raw.updated_at ?? new Date().toISOString(),
    pnlPercent: typeof raw.pnl_percent === 'number' ? raw.pnl_percent : typeof raw.pnlPercent === 'number' ? raw.pnlPercent : (raw.pnl ?? 0),
    minRaiseAmount: typeof raw.min_raise_amount === 'number' ? raw.min_raise_amount : typeof raw.minRaiseAmount === 'number' ? raw.minRaiseAmount : 1,
    lockupPeriod: typeof raw.lockup_period === 'number' ? raw.lockup_period : typeof raw.lockupPeriod === 'number' ? raw.lockupPeriod : 7,
    investorCount: typeof raw.investor_count === 'number' ? raw.investor_count : typeof raw.investorCount === 'number' ? raw.investorCount : (raw.investors ?? 0),
  }
}

export function mapApiPortfolioToPortfolio(raw: any): PortfolioPosition {
  if (!raw) return {} as PortfolioPosition
  return {
    vaultId: raw.vaultId ?? raw.vault_id ?? '',
    vaultAddress: raw.vaultAddress ?? raw.vault_address ?? '',
    vaultName: raw.vaultName ?? raw.vault_name ?? '',
    sharesOwned: typeof raw.sharesOwned === 'number' ? raw.sharesOwned : (raw.shares_owned ?? 0),
    totalInvested: typeof raw.totalInvested === 'number' ? raw.totalInvested : (raw.total_invested_value ?? 0),
    averageEntryPrice: typeof raw.averageEntryPrice === 'number' ? raw.averageEntryPrice : (raw.average_entry_price ?? 0),
    currentValue: typeof raw.currentValue === 'number' ? raw.currentValue : (raw.current_value ?? 0),
    pnl: typeof raw.pnl === 'number' ? raw.pnl : (raw.pnl ?? 0),
    pnlPercent: typeof raw.pnlPercent === 'number' ? raw.pnlPercent : (raw.pnl_percent ?? 0),
  }
}

export function mapApiConfigToConfig(raw: any): AppConfig {
  if (!raw) {
    return {
      dustThreshold: 0.001,
      focusAssetsWhitelist: ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'PYTH'],
      minRaiseAmount: 10,
      lockupPeriod: 7,
    }
  }
  return {
    dustThreshold: raw.dustThreshold ?? raw.dust_threshold ?? 0.001,
    focusAssetsWhitelist: raw.focusAssetsWhitelist ?? raw.focus_assets_whitelist ?? ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'PYTH'],
    minRaiseAmount: raw.minRaiseAmount ?? raw.min_raise_amount ?? 10,
    lockupPeriod: raw.lockupPeriod ?? raw.lockup_period ?? 7,
  }
}

export function mapApiTradeToTransaction(raw: any): Transaction {
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
