import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { getConfig } from '@/services/apis/rest-api/config.service'
import { getAccruedFees } from '@/services/apis/rest-api/fee.service'
import { getHistory } from '@/services/apis/rest-api/trade.service'
import { getVaultSparkline } from '@/services/apis/rest-api/vault_sparkline.service'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

describe('config service', () => {
  beforeEach(() => vi.resetAllMocks())

  it('gets and maps snake-case configuration', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      dust_threshold: 0.005,
      focus_assets_whitelist: ['SOL', 'USDC'],
      min_raise_amount: 25,
      lockup_period: 14,
    })

    await expect(getConfig()).resolves.toEqual({
      dustThreshold: 0.005,
      focusAssetsWhitelist: ['SOL', 'USDC'],
      minRaiseAmount: 25,
      lockupPeriod: 14,
    })
    expect(api.get).toHaveBeenCalledWith('/config')
  })

  it('maps a null response to configuration defaults', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(null)

    await expect(getConfig()).resolves.toMatchObject({ dustThreshold: 0.001, minRaiseAmount: 1, lockupPeriod: 7 })
  })
})

describe('fee and trade services', () => {
  beforeEach(() => vi.resetAllMocks())

  it('returns accrued fees from the vault-specific endpoint unchanged', async () => {
    const fees = { vault_id: 'v1', accrued_performance_fee: 2, accrued_management_fee: 1, total_accrued: 3 }
    vi.mocked(api.get).mockResolvedValueOnce(fees)

    await expect(getAccruedFees('v1')).resolves.toMatchObject(fees)
    expect(api.get).toHaveBeenCalledWith('/vaults/v1/fees')
  })

  it('returns trade history from the vault-specific endpoint unchanged', async () => {
    const history = { vault_id: 'v1', trades: [] }
    vi.mocked(api.get).mockResolvedValueOnce(history)

    await expect(getHistory('v1')).resolves.toBe(history)
    expect(api.get).toHaveBeenCalledWith('/vaults/v1/trades')
  })

  it('propagates fee and trade request failures', async () => {
    const error = new Error('unauthorized')
    vi.mocked(api.get).mockRejectedValue(error)

    await expect(getAccruedFees('v1')).rejects.toBe(error)
    await expect(getHistory('v1')).rejects.toBe(error)
  })
})

describe('vault sparkline service', () => {
  beforeEach(() => vi.resetAllMocks())

  it('requests the default range and maps numeric point values', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { vault_id: 'v1', range: '30d', points: [{ date: '2026-01-01', value: '10.5' }] },
    })

    await expect(getVaultSparkline('v1')).resolves.toEqual([{ date: '2026-01-01', value: 10.5 }])
    expect(api.get).toHaveBeenCalledWith('/vaults/v1/sparkline', { range: '30d', resolution: 'day' })
  })

  it('supports a top-level response and a custom range', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      vault_id: 'v1', range: '7d', points: [{ date: '2026-01-02', value: 7 }],
    })

    await expect(getVaultSparkline('v1', '7d')).resolves.toEqual([{ date: '2026-01-02', value: 7 }])
    expect(api.get).toHaveBeenCalledWith('/vaults/v1/sparkline', { range: '7d', resolution: 'day' })
  })

  it('returns an empty array for missing points', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { vault_id: 'v1', range: '90d' } })

    await expect(getVaultSparkline('v1', '90d')).resolves.toEqual([])
  })

  it('propagates sparkline request failures', async () => {
    const error = new Error('timeout')
    vi.mocked(api.get).mockRejectedValueOnce(error)

    await expect(getVaultSparkline('v1')).rejects.toBe(error)
  })
})
