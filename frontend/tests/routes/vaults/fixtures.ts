import type { ApiTrade, PortfolioPosition, Vault } from '../../../src/types'

export function makeVault(overrides: Partial<Vault> = {}): Vault {
  return {
    id: 'vault-1',
    address: 'VaultAddress1111222233334444',
    managerAddress: 'ManagerAddress1111222233334444',
    managerId: 'manager-1',
    status: 'Active',
    metadata: {
      displayName: 'Alpha Vault',
      description: 'A diversified Solana strategy.',
      focusAssets: ['SOL', 'USDC'],
    },
    performanceFeeBps: 1500,
    managementFeeBps: 200,
    tvl: 125000,
    createdAt: '2026-01-15T12:00:00.000Z',
    updatedAt: '2026-01-16T12:00:00.000Z',
    pnlPercent: 12.34,
    minRaiseAmount: 5000,
    investorCount: 42,
    ...overrides,
  }
}

export function makePosition(overrides: Partial<PortfolioPosition> = {}): PortfolioPosition {
  return {
    vaultId: 'vault-1',
    vaultAddress: 'VaultAddress1111222233334444',
    vaultName: 'Alpha Vault',
    sharesOwned: 12.3456,
    totalInvested: 1000,
    averageEntryPrice: 10,
    currentValue: 1400,
    pnl: 400,
    pnlPercent: 40,
    ...overrides,
  }
}

export function makeTrade(overrides: Partial<ApiTrade> = {}): ApiTrade {
  return {
    id: 'trade-1',
    vault_id: 'vault-1',
    actor_id: 'actor-1',
    transaction_signature: 'signature-1',
    trade_type: 'Buy',
    input_token: 'SOL',
    output_token: 'USDC',
    amount_in: 2,
    amount_out: 301.23456,
    price_at_execution: 150.61728,
    executed_at: '2026-02-03T12:00:00.000Z',
    ...overrides,
  }
}
