import { describe, it, expect } from 'vitest'
import {
  getWithdrawEligibility,
  getTradeEligibility,
  getDepositEligibility,
} from '@/lib/eligibility'
import type { Vault, PortfolioPosition } from '@/types'

const mockVault = (overrides?: Partial<Vault>): Vault => ({
  id: 'vault-1',
  address: 'Address111111111111111111111111111111111111',
  managerAddress: 'Manager11111111111111111111111111111111111',
  managerId: 'mgr-1',
  status: 'Active',
  metadata: {
    displayName: 'Test Vault',
    description: 'Test',
    focusAssets: ['SOL', 'USDC'],
  },
  performanceFeeBps: 1500,
  managementFeeBps: 200,
  tvl: 50000,
  createdAt: '2026-08-01T00:00:00.000Z',
  updatedAt: '2026-08-01T00:00:00.000Z',
  lockupPeriod: 7, // 7 days
  vaultType: 'open',
  ...overrides,
})

const mockPosition = (overrides?: Partial<PortfolioPosition>): PortfolioPosition => ({
  vaultId: 'vault-1',
  vaultAddress: 'Address111111111111111111111111111111111111',
  vaultName: 'Test Vault',
  sharesOwned: 10,
  totalInvested: 1000,
  averageEntryPrice: 100,
  currentValue: 1200,
  pnl: 200,
  pnlPercent: 20,
  ...overrides,
})

describe('getWithdrawEligibility', () => {
  it('disallows withdrawal if wallet is not connected', () => {
    const res = getWithdrawEligibility(mockVault(), mockPosition(), false)
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('Connect your wallet')
  })

  it('disallows withdrawal if user has no shares', () => {
    const res = getWithdrawEligibility(mockVault(), mockPosition({ sharesOwned: 0 }), true)
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('no shares')
  })

  it('disallows withdrawal if user has null position', () => {
    const res = getWithdrawEligibility(mockVault(), null, true)
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('no shares')
  })

  it('disallows withdrawal if lockup period is active', () => {
    // Created 1 hour ago with 7 days lockup
    const recentDate = new Date(Date.now() - 3600 * 1000).toISOString()
    const res = getWithdrawEligibility(
      mockVault({ createdAt: recentDate, lockupPeriod: 604800 }),
      mockPosition(),
      true,
    )
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('Withdrawals locked until')
    expect(res.unlockTime).toBeInstanceOf(Date)
  })

  it('allows withdrawal if lockup period has expired', () => {
    // Created 30 days ago with 7 days lockup
    const oldDate = new Date(Date.now() - 30 * 86400 * 1000).toISOString()
    const res = getWithdrawEligibility(
      mockVault({ createdAt: oldDate, lockupPeriod: 7 }),
      mockPosition(),
      true,
    )
    expect(res.canExecute).toBe(true)
    expect(res.reason).toBeNull()
  })

  it('allows withdrawal if lockup period is 0', () => {
    const res = getWithdrawEligibility(
      mockVault({ lockupPeriod: 0 }),
      mockPosition(),
      true,
    )
    expect(res.canExecute).toBe(true)
    expect(res.reason).toBeNull()
  })
})

describe('getTradeEligibility', () => {
  it('disallows trading if wallet is not connected', () => {
    const res = getTradeEligibility(mockVault(), true, false)
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('Connect wallet')
  })

  it('disallows trading if no vault is selected', () => {
    const res = getTradeEligibility(null, true, true)
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('Select an active vault')
  })

  it('disallows trading if user is not manager', () => {
    const res = getTradeEligibility(mockVault(), false, true)
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('Only the vault manager')
  })

  it('disallows trading if vault is in Fundraising phase', () => {
    const res = getTradeEligibility(mockVault({ status: 'Fundraising' }), true, true)
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('Fundraising')
  })

  it('allows trading when user is manager and vault is Active', () => {
    const res = getTradeEligibility(mockVault({ status: 'Active' }), true, true)
    expect(res.canExecute).toBe(true)
    expect(res.reason).toBeNull()
  })
})

describe('getDepositEligibility', () => {
  it('disallows deposit if wallet is disconnected', () => {
    const res = getDepositEligibility(mockVault(), false)
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('Connect wallet')
  })

  it('disallows deposit if vault is dormant', () => {
    const res = getDepositEligibility(mockVault({ status: 'Dormant' }), true)
    expect(res.canExecute).toBe(false)
    expect(res.reason).toContain('dormant')
  })

  it('allows deposit if vault is fundraising or active', () => {
    expect(getDepositEligibility(mockVault({ status: 'Fundraising' }), true).canExecute).toBe(true)
    expect(getDepositEligibility(mockVault({ status: 'Active' }), true).canExecute).toBe(true)
  })
})
