import { act, fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiTrade, PortfolioPosition } from '@/types'
import { PortfolioSummary } from '@/routes/portfolio/_components/PortfolioSummary'
import { PositionCard } from '@/routes/portfolio/_components/PositionCard'
import { AllocationChart } from '@/routes/portfolio/_components/AllocationChart'
import { PerformanceChart } from '@/routes/portfolio/_components/PerformanceChart'
import { PnLTicker } from '@/routes/portfolio/_components/PnLTicker'
import { TradeHistory } from '@/routes/portfolio/_components/TradeHistory'
import { LeaderboardWidget } from '@/routes/portfolio/_components/LeaderboardWidget'

const mocks = vi.hoisted(() => ({
  pnl: { totalValue: 12500.5, totalPnl: 250, totalPnlPercent: 2.5 },
  history: [] as Array<{ date: string; value: number }>,
  market: { data: undefined as unknown, isLoading: false, isError: false },
  leaderboard: { data: [] as unknown[], isLoading: false, isError: false },
  navigate: vi.fn(),
  setMode: vi.fn(),
  invalidate: vi.fn(),
  onMessage: vi.fn(),
  wsListener: undefined as undefined | ((message: { type: string }) => void),
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ publicKey: { toBase58: () => 'Wallet111' } }),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, params, ...props }: { children: React.ReactNode; to?: string; params?: { id?: string }; [key: string]: unknown }) => (
    <a href={params ? `${to}/${params.id}` : to} {...props}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
}))

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidate }),
}))

vi.mock('@/hooks/usePortfolioPnl', () => ({ usePortfolioPnl: () => mocks.pnl }))
vi.mock('@/services/hooks/useQuery/usePortfolioHistoryQuery', () => ({
  usePortfolioHistoryQuery: () => ({ data: mocks.history }),
}))
vi.mock('@/services/hooks/useQuery/useMarketStatsQuery', () => ({
  useMarketStatsQuery: () => mocks.market,
}))
vi.mock('@/services/hooks/useQuery/useLeaderboardQuery', () => ({
  useLeaderboardQuery: () => mocks.leaderboard,
}))
vi.mock('@/stores/app-store', () => ({
  useAppStore: <T,>(selector: (state: { setMode: typeof mocks.setMode }) => T) =>
    selector({ setMode: mocks.setMode }),
}))
vi.mock('@/stores', () => ({
  useWebSocketStore: <T,>(selector: (state: { onMessage: typeof mocks.onMessage }) => T) =>
    selector({
      onMessage: mocks.onMessage.mockImplementation((listener: (message: { type: string }) => void) => {
        mocks.wsListener = listener
        return vi.fn()
      }),
    }),
}))
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('@/routes/portfolio/_components/AllocationChartInner', () => ({
  AllocationChartInner: ({ data }: { data: Array<{ name: string }> }) => <div>allocation:{data.map((item) => item.name).join(',')}</div>,
}))
vi.mock('@/routes/portfolio/_components/PerformanceChartInner', () => ({
  PerformanceChartInner: ({ data }: { data: unknown[] }) => <div>points:{data.length}</div>,
}))

vi.mock('@/components/ui/select', async () => {
  const ReactModule = await import('react')
  interface SelectContextValue {
    value?: string
    onValueChange?: (val: string) => void
  }
  const Context = ReactModule.createContext<SelectContextValue>({})
  return {
    Select: ({ value, onValueChange, children }: { value?: string; onValueChange?: (val: string) => void; children: React.ReactNode }) => (
      <Context.Provider value={{ value, onValueChange }}>{children}</Context.Provider>
    ),
    SelectTrigger: () => null,
    SelectValue: () => null,
    SelectContent: ({ children }: { children: React.ReactNode }) => {
      const context = ReactModule.useContext(Context)
      return <select aria-label="history filter" value={context.value} onChange={(event) => context.onValueChange?.(event.target.value)}>{children}</select>
    },
    SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => <option value={value}>{children}</option>,
  }
})

const position: PortfolioPosition & { shareOfPortfolio?: number } = {
  vaultId: 'vault-1',
  vaultAddress: 'Address12345678',
  vaultName: 'Growth Vault',
  sharesOwned: 10,
  totalInvested: 1000,
  averageEntryPrice: 100,
  currentValue: 1250,
  pnl: 250,
  pnlPercent: 25,
  shareOfPortfolio: 42.5,
}

function trade(index: number, type: ApiTrade['trade_type'] = 'Buy'): ApiTrade {
  return {
    id: `trade-${index}`,
    vault_id: 'vault-1',
    actor_id: 'actor-1',
    transaction_signature: `signature-${index}`,
    trade_type: type,
    input_token: 'SOL',
    output_token: 'USDC',
    amount_in: index + 0.25,
    amount_out: 20,
    price_at_execution: 150.5,
    executed_at: '2026-08-08T12:00:00Z',
  }
}

describe('portfolio summary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.pnl = { totalValue: 12500.5, totalPnl: 250, totalPnlPercent: 2.5 }
    mocks.history = []
  })

  it('renders positive aggregate PnL and rising history', () => {
    mocks.history = [{ date: 'a', value: 1000 }, { date: 'b', value: 1200 }]
    render(<PortfolioSummary />)
    expect(screen.getByText('$+250.00')).toBeInTheDocument()
    expect(screen.getByText('▲ 2.50%')).toBeInTheDocument()
    expect(screen.getByText('+20.00%')).toBeInTheDocument()
    expect(screen.getByText('+$200.00')).toBeInTheDocument()
  })

  it('renders negative aggregate PnL and falling history', () => {
    mocks.pnl = { totalValue: 800, totalPnl: -200, totalPnlPercent: -20 }
    mocks.history = [{ date: 'a', value: 1000 }, { date: 'b', value: 800 }]
    render(<PortfolioSummary />)
    expect(screen.getAllByText('$-200.00').length).toBeGreaterThan(0)
    expect(screen.getByText('▼ 20.00%')).toBeInTheDocument()
    expect(screen.getByText('-20.00%')).toBeInTheDocument()
  })

  it('uses empty-history fallbacks', () => {
    render(<PortfolioSummary />)
    expect(screen.getByText('--')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
  })

  it('switches to manager mode and dashboard', () => {
    render(<PortfolioSummary />)
    fireEvent.click(screen.getByRole('button', { name: 'Become a manager' }))
    expect(mocks.setMode).toHaveBeenCalledWith(true)
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/' })
  })
})

describe('position card', () => {
  it('renders position values and details destination', () => {
    render(<PositionCard position={position} />)
    expect(screen.getByText('Growth Vault')).toBeInTheDocument()
    expect(screen.getByText('$1,000')).toBeInTheDocument()
    expect(screen.getByText('$250 (25.00%)')).toHaveClass('text-status-success')
    expect(screen.getByRole('link', { name: /view details/i })).toHaveAttribute('href', '/invest/vaults/$id/vault-1')
  })

  it('styles losses as errors', () => {
    render(<PositionCard position={{ ...position, pnl: -50, pnlPercent: -5 }} />)
    expect(screen.getByText('$-50 (-5.00%)')).toHaveClass('text-status-error')
  })

  it('caps allocation bar width and defaults missing share', () => {
    const { rerender, container } = render(<PositionCard position={{ ...position, shareOfPortfolio: 120 }} />)
    expect(container.querySelector('[style]')).toHaveStyle({ width: '100%' })
    rerender(<PositionCard position={{ ...position, shareOfPortfolio: undefined }} />)
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})

describe('charts', () => {
  beforeEach(() => {
    mocks.market = { data: undefined, isLoading: false, isError: false }
  })

  it('shows allocation loading and empty fallbacks', () => {
    const { rerender, container } = render(<AllocationChart data={[]} isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    rerender(<AllocationChart data={[]} />)
    expect(screen.getByText('No active position allocation')).toBeInTheDocument()
  })

  it('loads allocation chart data', async () => {
    render(<AllocationChart data={[{ name: 'Alpha', value: 70, color: '#fff' }]} />)
    expect(await screen.findByText('allocation:Alpha')).toBeInTheDocument()
  })

  it('shows performance loading and error fallbacks', () => {
    const { rerender, container } = render(<PerformanceChart data={[]} isLoading />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    mocks.market = { data: undefined, isLoading: false, isError: true }
    rerender(<PerformanceChart data={[]} />)
    expect(screen.getByText('Market data unavailable')).toBeInTheDocument()
  })

  it('formats market data, loads points, and changes timeframe', async () => {
    mocks.market = {
      isLoading: false,
      isError: false,
      data: {
        rate: '152.25', rate_change_pct: '2.5', market_cap: '1000000000', market_cap_change_pct: '-1',
        circulating_supply: '500000000', circulating_change_pct: '0.5', volume_24h: '2500000',
        volume_24h_change_pct: '3', ath: '300', ath_change_pct: '-49.25', updated_at: '',
      },
    }
    render(<PerformanceChart data={[{ date: 'Aug 8', value: 100 }]} />)
    expect(screen.getByText('$152.25')).toBeInTheDocument()
    expect(screen.getByText('$1.00B')).toBeInTheDocument()
    expect(await screen.findByText('points:1')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '1Y' }))
    expect(screen.getByRole('button', { name: '1Y' })).toHaveClass('bg-bg-elevated')
  })
})

describe('PnL ticker', () => {
  beforeEach(() => {
    mocks.pnl = { totalValue: 0, totalPnl: 10, totalPnlPercent: 0 }
    window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  })

  it('renders positive and negative totals', () => {
    const { rerender } = render(<PnLTicker />)
    expect(screen.getByText('+$10')).toHaveClass('text-status-success')
    mocks.pnl = { ...mocks.pnl, totalPnl: -5 }
    rerender(<PnLTicker />)
    expect(screen.getByText('$-5')).toHaveClass('text-status-error')
  })

  it('flashes green after an increase', () => {
    const { rerender, container } = render(<PnLTicker />)
    mocks.pnl = { ...mocks.pnl, totalPnl: 20 }
    rerender(<PnLTicker />)
    expect(container.firstChild).toHaveClass('bg-status-success/20')
  })

  it('suppresses flash for reduced motion', () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })
    const { rerender, container } = render(<PnLTicker />)
    mocks.pnl = { ...mocks.pnl, totalPnl: 5 }
    rerender(<PnLTicker />)
    expect(container.firstChild).not.toHaveClass('bg-status-error/20')
  })
})

describe('trade history', () => {
  it('renders loading and empty states', () => {
    const { rerender, container } = render(<TradeHistory trades={[]} isLoading />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
    rerender(<TradeHistory trades={[]} />)
    expect(screen.getByText('No trades recorded yet')).toBeInTheDocument()
  })

  it('renders formatted trade details', () => {
    render(<TradeHistory trades={[trade(1)]} />)
    expect(screen.getByText('8/8/2026')).toBeInTheDocument()
    expect(screen.getByText('SOL/USDC')).toBeInTheDocument()
    expect(screen.getByText('1.2500')).toBeInTheDocument()
    expect(screen.getByText('$150.5000')).toBeInTheDocument()
    expect(screen.getByText('Confirmed')).toBeInTheDocument()
  })

  it('filters trade types and resets to first page', () => {
    render(<TradeHistory trades={[trade(1, 'Buy'), trade(2, 'Deposit')]} />)
    fireEvent.change(screen.getByLabelText('history filter'), { target: { value: 'Deposits' } })
    expect(screen.queryByText('Buy')).not.toBeInTheDocument()
    expect(screen.getByText('Deposit')).toBeInTheDocument()
  })

  it('paginates more than ten rows', () => {
    render(<TradeHistory trades={Array.from({ length: 11 }, (_, index) => trade(index))} />)
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByText('2 / 2')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
  })
})

describe('leaderboard widget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.leaderboard = { data: [], isLoading: false, isError: false }
    mocks.wsListener = undefined
  })

  it('renders five loading placeholders', () => {
    mocks.leaderboard = { data: [], isLoading: true, isError: false }
    const { container } = render(<LeaderboardWidget />)
    expect(container.querySelectorAll('.size-6.animate-pulse')).toHaveLength(5)
  })

  it('renders the same safe empty state on errors', () => {
    mocks.leaderboard = { data: [], isLoading: false, isError: true }
    render(<LeaderboardWidget />)
    expect(screen.getByText('No tokens yet')).toBeInTheDocument()
  })

  it('formats token data and missing icons', () => {
    mocks.leaderboard = { data: [{ rank: 1, name: 'Solana', symbol: 'SOL', tag: 'Layer 1', volume: 1250000, change: -3.5, icon: '' }], isLoading: false, isError: false }
    render(<LeaderboardWidget />)
    expect(screen.getByText('Solana')).toBeInTheDocument()
    expect(screen.getByText('$1.25M')).toBeInTheDocument()
    expect(screen.getByText('-3.50%')).toHaveClass('text-status-error')
    expect(screen.getByAltText('S')).toBeInTheDocument()
  })

  it('changes tabs and invalidates leaderboard after websocket update', () => {
    const { rerender } = render(<LeaderboardWidget />)
    fireEvent.click(screen.getByRole('button', { name: 'Gainers' }))
    expect(screen.getByRole('button', { name: 'Gainers' })).toHaveClass('bg-bg-elevated')
    act(() => mocks.wsListener?.({ type: 'leaderboard_update' }))
    expect(mocks.invalidate).toHaveBeenCalledWith({ queryKey: ['leaderboard'] })
    rerender(<LeaderboardWidget />)
  })
})
