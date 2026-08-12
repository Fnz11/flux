import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PortfolioPosition } from '../src/types'
import { usePortfolioStore } from '../src/stores/portfolio-store'
import { getPortfolio } from '../src/services/apis/rest-api/portfolio.service'

vi.mock('../src/services/apis/rest-api/portfolio.service', () => ({
  getPortfolio: vi.fn(),
}))

const position: PortfolioPosition = {
  vaultId: 'v1',
  vaultAddress: 'vault-address',
  vaultName: 'Alpha',
  sharesOwned: 2,
  totalInvested: 100,
  averageEntryPrice: 50,
  currentValue: 120,
  pnl: 20,
  pnlPercent: 20,
}

describe('usePortfolioStore', () => {
  beforeEach(() => {
    usePortfolioStore.getState().reset()
    vi.resetAllMocks()
  })

  it('starts with defaults and updates portfolio controls', () => {
    expect(usePortfolioStore.getState()).toMatchObject({
      selectedPositionId: null,
      timeRange: '30d',
      sortBy: 'value',
      positions: [],
      isLoading: false,
      error: null,
    })

    usePortfolioStore.getState().setSelectedPositionId('v1')
    usePortfolioStore.getState().setTimeRange('7d')
    usePortfolioStore.getState().setSortBy('pnl')
    expect(usePortfolioStore.getState()).toMatchObject({ selectedPositionId: 'v1', timeRange: '7d', sortBy: 'pnl' })
  })

  it('loads positions for the requested wallet and exposes loading', async () => {
    let resolvePortfolio!: (value: PortfolioPosition[]) => void
    vi.mocked(getPortfolio).mockReturnValue(new Promise((resolve) => {
      resolvePortfolio = resolve
    }))

    const request = usePortfolioStore.getState().fetchPortfolio('wallet/one')
    expect(usePortfolioStore.getState().isLoading).toBe(true)
    resolvePortfolio([position])
    await expect(request).resolves.toEqual([position])

    expect(getPortfolio).toHaveBeenCalledWith('wallet/one')
    expect(usePortfolioStore.getState()).toMatchObject({ positions: [position], isLoading: false, error: null })
  })

  it('returns an empty result and records fetch failures', async () => {
    vi.mocked(getPortfolio).mockRejectedValue(new Error('Portfolio unavailable'))

    await expect(usePortfolioStore.getState().fetchPortfolio('wallet')).resolves.toEqual([])
    expect(usePortfolioStore.getState()).toMatchObject({ positions: [], isLoading: false, error: 'Portfolio unavailable' })
  })

  it('reset clears positions, errors, and changed controls', () => {
    usePortfolioStore.setState({
      selectedPositionId: 'v1',
      timeRange: '1y',
      sortBy: 'pnl',
      positions: [position],
      isLoading: true,
      error: 'stale',
    })

    usePortfolioStore.getState().reset()

    expect(usePortfolioStore.getState()).toMatchObject({
      selectedPositionId: null,
      timeRange: '30d',
      sortBy: 'value',
      positions: [],
      isLoading: false,
      error: null,
    })
  })
})
