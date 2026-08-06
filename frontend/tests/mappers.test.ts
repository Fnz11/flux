import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  mapApiVaultToVault,
  mapApiPortfolioToPortfolio,
  mapApiConfigToConfig,
  mapApiTradeToTransaction,
} from '../src/lib/mappers'

describe('mappers', () => {
  describe('mapApiVaultToVault', () => {
    it('returns empty object cast as Vault when raw is null/undefined', () => {
      assert.deepStrictEqual(mapApiVaultToVault(null), {})
      assert.deepStrictEqual(mapApiVaultToVault(undefined), {})
    })

    it('correctly maps snake_case backend vault response to camelCase Vault domain model', () => {
      const rawApiVault = {
        id: 'vault_123',
        address: 'VaultPubkey11111111111111111111111111111111',
        manager_id: 'manager_456',
        manager_address: 'ManagerPubkey1111111111111111111111111111111',
        status: 'Active',
        metadata: {
          display_name: 'Alpha Quant Vault',
          description: 'High frequency SOL strategy',
          focus_assets: ['SOL', 'USDC'],
        },
        performance_fee_bps: 1000,
        management_fee_bps: 200,
        tvl: '1500000.50',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-02T00:00:00Z',
      }

      const vault = mapApiVaultToVault(rawApiVault)

      assert.deepStrictEqual(vault, {
        id: 'vault_123',
        address: 'VaultPubkey11111111111111111111111111111111',
        managerId: 'manager_456',
        managerAddress: 'ManagerPubkey1111111111111111111111111111111',
        status: 'Active',
        metadata: {
          displayName: 'Alpha Quant Vault',
          description: 'High frequency SOL strategy',
          focusAssets: ['SOL', 'USDC'],
        },
        performanceFeeBps: 1000,
        managementFeeBps: 200,
        tvl: 1500000.5,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-02T00:00:00Z',
        pnlPercent: 0,
        minRaiseAmount: 1,
        lockupPeriod: 7,
        investorCount: 0,
      })
    })
  })

  describe('mapApiPortfolioToPortfolio', () => {
    it('returns empty object when raw is falsy', () => {
      assert.deepStrictEqual(mapApiPortfolioToPortfolio(null), {})
    })

    it('maps portfolio position with snake_case fields', () => {
      const rawPortfolio = {
        vault_id: 'v_1',
        vault_address: '0x123',
        vault_name: 'Sol Vault',
        shares_owned: 100,
        total_invested_value: 5000,
        average_entry_price: 50,
        current_value: 6000,
        pnl: 1000,
        pnl_percent: 20,
      }

      const position = mapApiPortfolioToPortfolio(rawPortfolio)

      assert.deepStrictEqual(position, {
        vaultId: 'v_1',
        vaultAddress: '0x123',
        vaultName: 'Sol Vault',
        sharesOwned: 100,
        totalInvested: 5000,
        averageEntryPrice: 50,
        currentValue: 6000,
        pnl: 1000,
        pnlPercent: 20,
      })
    })
  })

  describe('mapApiConfigToConfig', () => {
    it('provides fallback defaults when raw is null', () => {
      const config = mapApiConfigToConfig(null)
      assert.equal(config.dustThreshold, 0.001)
      assert.ok(config.focusAssetsWhitelist.includes('SOL'))
      assert.equal(config.minRaiseAmount, 10)
      assert.equal(config.lockupPeriod, 7)
    })

    it('maps custom config values', () => {
      const rawConfig = {
        dust_threshold: 0.05,
        focus_assets_whitelist: ['SOL', 'BONK'],
        min_raise_amount: 100,
        lockup_period: 30,
      }
      const config = mapApiConfigToConfig(rawConfig)
      assert.equal(config.dustThreshold, 0.05)
      assert.deepStrictEqual(config.focusAssetsWhitelist, ['SOL', 'BONK'])
      assert.equal(config.minRaiseAmount, 100)
      assert.equal(config.lockupPeriod, 30)
    })
  })

  describe('mapApiTradeToTransaction', () => {
    it('maps trade response to Transaction object', () => {
      const rawTrade = {
        id: 'trade_999',
        transaction_signature: 'sig_abc_123',
        vault_id: 'vault_1',
        executed_at: '2026-01-15T12:00:00Z',
        input_token: 'SOL',
        output_token: 'USDC',
        amount_in: 10,
        amount_out: 1400,
      }

      const tx = mapApiTradeToTransaction(rawTrade)

      assert.equal(tx.id, 'trade_999')
      assert.equal(tx.type, 'trade')
      assert.equal(tx.status, 'success')
      assert.equal(tx.signature, 'sig_abc_123')
      assert.equal(tx.vaultId, 'vault_1')
      assert.equal(tx.inputToken, 'SOL')
      assert.equal(tx.outputToken, 'USDC')
      assert.equal(tx.amountIn, 10)
      assert.equal(tx.amountOut, 1400)
    })
  })
})
