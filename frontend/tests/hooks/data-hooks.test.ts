import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebounce } from '../../src/hooks/useDebounce'
import { usePortfolioPnl } from '../../src/hooks/usePortfolioPnl'

const mocks = vi.hoisted(() => ({
  portfolioData: [] as any[],
}))

vi.mock('../../src/services/hooks/useQuery/usePortfolioQuery', () => ({
  usePortfolioQuery: () => ({ data: mocks.portfolioData }),
}))

const positions = [
  { vaultId: 'v1', vaultAddress: 'a', vaultName: 'Alpha', sharesOwned: 1, totalInvested: 100, averageEntryPrice: 100, currentValue: 150, pnl: 50, pnlPercent: 50 },
  { vaultId: 'v2', vaultAddress: 'b', vaultName: 'Beta', sharesOwned: 2, totalInvested: 200, averageEntryPrice: 100, currentValue: 150, pnl: -50, pnlPercent: -25 },
]

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('first', 100))
    expect(result.current).toBe('first')
  })

  it('delays an updated value', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), { initialProps: { value: 'first' } })
    rerender({ value: 'second' })
    act(() => vi.advanceTimersByTime(99))
    expect(result.current).toBe('first')
  })

  it('publishes after the delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), { initialProps: { value: 'first' } })
    rerender({ value: 'second' })
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('second')
  })

  it('cancels a superseded update', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), { initialProps: { value: 'one' } })
    rerender({ value: 'two' })
    act(() => vi.advanceTimersByTime(50))
    rerender({ value: 'three' })
    act(() => vi.advanceTimersByTime(50))
    expect(result.current).toBe('one')
    act(() => vi.advanceTimersByTime(50))
    expect(result.current).toBe('three')
  })
})

describe('usePortfolioPnl', () => {
  beforeEach(() => { mocks.portfolioData = [] })

  it('returns zero totals for no positions', () => {
    const { result } = renderHook(() => usePortfolioPnl([]))
    expect(result.current).toEqual({ totalInvested: 0, totalValue: 0, totalPnl: 0, totalPnlPercent: 0, positions: [] })
  })

  it('aggregates invested value, current value, and pnl', () => {
    const { result } = renderHook(() => usePortfolioPnl(positions))
    expect(result.current).toMatchObject({ totalInvested: 300, totalValue: 300, totalPnl: 0, totalPnlPercent: 0 })
  })

  it('calculates portfolio shares', () => {
    const { result } = renderHook(() => usePortfolioPnl(positions))
    expect(result.current.positions.map((position) => position.shareOfPortfolio)).toEqual([50, 50])
  })

  it('uses queried positions for a wallet address', () => {
    mocks.portfolioData = positions
    const { result } = renderHook(() => usePortfolioPnl('wallet'))
    expect(result.current.totalInvested).toBe(300)
  })

  it('avoids division by zero', () => {
    const zeroPosition = { ...positions[0], totalInvested: 0, currentValue: 0 }
    const { result } = renderHook(() => usePortfolioPnl([zeroPosition]))
    expect(result.current.totalPnlPercent).toBe(0)
    expect(result.current.positions[0].shareOfPortfolio).toBe(0)
  })
})
