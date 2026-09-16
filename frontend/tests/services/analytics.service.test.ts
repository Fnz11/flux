import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import { getLeaderboard, getMarketStats } from '@/services/apis/rest-api/market.service'
import { getMetrics } from '@/services/apis/rest-api/metrics.service'
import { getPortfolio } from '@/services/apis/rest-api/portfolio.service'
import { getPortfolioHistory } from '@/services/apis/rest-api/portfolio_history.service'
import { getGlobalTransactions } from '@/services/apis/rest-api/transactions.service'

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }))

describe('transactions service', () => {
  beforeEach(() => vi.resetAllMocks())

  it('passes filters separately and maps snake-case transaction fields', async () => {
    const params = { page: 2, limit: 20, type: 'deposit', wallet: 'wallet-1' }
    vi.mocked(api.get).mockResolvedValueOnce({
      data: {
        total: 1,
        items: [{
          id: 'tx-1', executed_at: '2026-01-01', action: 'deposit', vault_id: 'v1',
          vault_name: 'Alpha', symbol: 'SOL', amount: '12.5', transaction_signature: 'sig-1', wallet: 'wallet-1',
        }],
      },
    })

    await expect(getGlobalTransactions(params)).resolves.toEqual({
      total: 1,
      items: [{
        id: 'tx-1', executedAt: '2026-01-01', action: 'deposit', vaultId: 'v1',
        vaultName: 'Alpha', symbol: 'SOL', amount: 12.5, transactionSignature: 'sig-1', wallet: 'wallet-1',
      }],
    })
    expect(api.get).toHaveBeenCalledWith('/user/activity', params)
  })

  it('uses empty params and defaults a missing data envelope', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({})

    await expect(getGlobalTransactions()).resolves.toEqual({ items: [], total: 0 })
    expect(api.get).toHaveBeenCalledWith('/user/activity', {})
  })
})

describe('portfolio services', () => {
  beforeEach(() => vi.resetAllMocks())

  it('URL-encodes the wallet and maps an enveloped portfolio', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      wallet: 'wallet/a+b',
      positions: [{
        vault_id: 'v1', vault_address: 'a1', vault_name: 'Alpha', shares_owned: 2,
        total_invested_value: 100, average_entry_price: 50, current_value: 125, pnl: 25, pnl_percent: 25,
      }],
    })

    await expect(getPortfolio('wallet/a+b')).resolves.toEqual([{
      vaultId: 'v1', vaultAddress: 'a1', vaultName: 'Alpha', sharesOwned: 2,
      totalInvested: 100, averageEntryPrice: 50, currentValue: 125, pnl: 25, pnlPercent: 25,
    }])
    expect(api.get).toHaveBeenCalledWith('/user/portfolio/wallet%2Fa%2Bb')
  })

  it('supports a bare portfolio array and malformed envelope fallback', async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce([{ vault_id: 'v1' }])
      .mockResolvedValueOnce({ positions: null })

    await expect(getPortfolio('w1')).resolves.toHaveLength(1)
    await expect(getPortfolio('w1')).resolves.toEqual([])
  })

  it('requests portfolio history with the default range', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ points: [], wallet: 'w1', range: '30d' })

    await getPortfolioHistory('w1')

    expect(api.get).toHaveBeenCalledWith('/user/portfolio/history', { wallet: 'w1', range: '30d' })
  })

  it('supports custom range, bare arrays, and missing points', async () => {
    const points = [{ date: '2026-01-01', value: 100 }]
    vi.mocked(api.get).mockResolvedValueOnce(points).mockResolvedValueOnce({})

    await expect(getPortfolioHistory('w1', '90d')).resolves.toEqual(points)
    expect(api.get).toHaveBeenNthCalledWith(1, '/user/portfolio/history', { wallet: 'w1', range: '90d' })
    await expect(getPortfolioHistory('w1', '7d')).resolves.toEqual([])
  })
})

describe('market service', () => {
  beforeEach(() => vi.resetAllMocks())

  it('unwraps market stats from the exact endpoint', async () => {
    const stats = { market_cap: '$1B', updated_at: '2026-01-01' }
    vi.mocked(api.get).mockResolvedValueOnce({ data: stats })

    await expect(getMarketStats()).resolves.toBe(stats)
    expect(api.get).toHaveBeenCalledWith('/metrics/market')
  })

  it('builds leaderboard params while preserving a zero limit', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: { type: 'new', items: [] } })

    await getLeaderboard('new', 0, '24h')

    expect(api.get).toHaveBeenCalledWith('/metrics/leaderboard', { type: 'new', limit: 0, period: '24h' })
  })

  it('omits absent leaderboard options and defaults missing items', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ data: {} })

    await expect(getLeaderboard('gainers')).resolves.toEqual([])
    expect(api.get).toHaveBeenCalledWith('/metrics/leaderboard', { type: 'gainers' })
  })
})

describe('metrics service', () => {
  beforeEach(() => vi.resetAllMocks())

  it('requests default period and maps labels and numeric values', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      series: [{ date: '2026-01-02T12:00:00Z', value: '12.75' }, { date: '2026-01-03T12:00:00Z', value: 'bad' }],
    })

    await expect(getMetrics('tvl')).resolves.toEqual([
      { date: 'Jan 2', value: 12.75 },
      { date: 'Jan 3', value: 0 },
    ])
    expect(api.get).toHaveBeenCalledWith('/metrics/series', { metric: 'tvl', period: '30d' })
  })

  it('returns an empty series for malformed and failed responses', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({})
    await expect(getMetrics('volume', '7d')).resolves.toEqual([])

    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(api.get).mockRejectedValueOnce(new Error('offline'))
    await expect(getMetrics('volume')).resolves.toEqual([])
    expect(consoleError).toHaveBeenCalledWith('Failed to fetch metrics for volume:', expect.any(Error))
    consoleError.mockRestore()
  })
})
