import { describe, it } from 'vitest'
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
        status: 'Active' as const,
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
        vaultType: 'open',
        investorCount: 0,
      })
    })

    it('prefers camelCase vault fields when both naming styles are present', () => {
      const vault = mapApiVaultToVault({
        managerId: 'camel-manager',
        manager_id: 'snake-manager',
        managerAddress: 'camel-address',
        manager_address: 'snake-address',
        performanceFeeBps: 125,
        performance_fee_bps: 500,
        metadata: {
          displayName: 'Camel Vault',
          display_name: 'Snake Vault',
          focusAssets: ['SOL'],
          focus_assets: ['USDC'],
        },
      })

      assert.equal(vault.managerId, 'camel-manager')
      assert.equal(vault.managerAddress, 'camel-address')
      assert.equal(vault.performanceFeeBps, 125)
      assert.equal(vault.metadata.displayName, 'Camel Vault')
      assert.deepStrictEqual(vault.metadata.focusAssets, ['SOL'])
    })

    it('applies vault defaults when optional fields are missing', () => {
      const before = Date.now()
      const vault = mapApiVaultToVault({})
      const after = Date.now()

      assert.equal(vault.id, '')
      assert.equal(vault.address, '')
      assert.equal(vault.status, 'Fundraising')
      assert.deepStrictEqual(vault.metadata, { displayName: '', description: '', focusAssets: [] })
      assert.equal(vault.tvl, 0)
      assert.equal(vault.minRaiseAmount, 1)
      assert.equal(vault.lockupPeriod, 7)
      assert.ok(Date.parse(vault.createdAt) >= before)
      assert.ok(Date.parse(vault.updatedAt) <= after)
    })

    it('handles null metadata using metadata defaults', () => {
      const vault = mapApiVaultToVault({ metadata: null })

      assert.deepStrictEqual(vault.metadata, { displayName: '', description: '', focusAssets: [] })
    })

    it('preserves numeric zero values instead of replacing them with defaults', () => {
      const vault = mapApiVaultToVault({
        pnl_percent: 0,
        min_raise_amount: 0,
        lockup_period: 0,
        investor_count: 0,
      })

      assert.equal(vault.pnlPercent, 0)
      assert.equal(vault.minRaiseAmount, 0)
      assert.equal(vault.lockupPeriod, 0)
      assert.equal(vault.investorCount, 0)
    })

    it('reflects malformed tvl strings as NaN', () => {
      assert.equal(Number.isNaN(mapApiVaultToVault({ tvl: 'not-a-number' }).tvl), true)
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

    it('maps camelCase portfolio fields and prefers them over snake_case', () => {
      const position = mapApiPortfolioToPortfolio({
        vaultId: 'camel-id',
        vault_id: 'snake-id',
        sharesOwned: 4,
        shares_owned: 8,
        totalInvested: 20,
        total_invested_value: 40,
        pnlPercent: -5,
        pnl_percent: 10,
      })

      assert.equal(position.vaultId, 'camel-id')
      assert.equal(position.sharesOwned, 4)
      assert.equal(position.totalInvested, 20)
      assert.equal(position.pnlPercent, -5)
    })

    it('uses portfolio defaults for missing values', () => {
      assert.deepStrictEqual(mapApiPortfolioToPortfolio({}), {
        vaultId: '',
        vaultAddress: '',
        vaultName: '',
        sharesOwned: 0,
        totalInvested: 0,
        averageEntryPrice: 0,
        currentValue: 0,
        pnl: 0,
        pnlPercent: 0,
      })
    })
  })

  describe('mapApiConfigToConfig', () => {
    it('provides fallback defaults when raw is null', () => {
      const config = mapApiConfigToConfig(null)
      assert.equal(config.dustThreshold, 0.001)
      assert.ok(config.focusAssetsWhitelist.includes('SOL'))
      assert.equal(config.minRaiseAmount, 1)
      assert.equal(config.lockupPeriod, 7)
    })

    it('maps custom config values', () => {
      const rawConfig = {
        dust_threshold: 0.05,
        focus_assets_whitelist: ['SOL', 'JUP'],
        min_raise_amount: 100,
        lockup_period: 30,
      }
      const config = mapApiConfigToConfig(rawConfig)
      assert.equal(config.dustThreshold, 0.05)
      assert.deepStrictEqual(config.focusAssetsWhitelist, ['SOL', 'JUP'])
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

    it('maps camelCase transaction fields and uses the current time when execution is missing', () => {
      const before = Date.now()
      const tx = mapApiTradeToTransaction({
        signature: 'camel-signature',
        vaultId: 'camel-vault',
        inputToken: 'USDC',
        outputToken: 'SOL',
        amountIn: 25,
        amountOut: 1.5,
      })

      assert.equal(tx.signature, 'camel-signature')
      assert.equal(tx.vaultId, 'camel-vault')
      assert.equal(tx.inputToken, 'USDC')
      assert.equal(tx.outputToken, 'SOL')
      assert.equal(tx.amountIn, 25)
      assert.equal(tx.amountOut, 1.5)
      assert.ok(tx.timestamp >= before && tx.timestamp <= Date.now())
    })

    it('maps executed_at to a millisecond timestamp and defaults missing signature fields', () => {
      const tx = mapApiTradeToTransaction({ executed_at: '2026-02-03T04:05:06.000Z' })

      assert.equal(tx.timestamp, Date.parse('2026-02-03T04:05:06.000Z'))
      assert.equal(tx.signature, null)
      assert.equal(tx.vaultId, null)
      assert.equal(tx.errorMessage, null)
    })
  })
})
