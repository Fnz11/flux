import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFees } from '../../src/hooks/useFees'
import { useTradeHistory } from '../../src/hooks/useTradeHistory'

const mocks = vi.hoisted(() => ({
  queryResults: [] as unknown[],
  capturedQueries: [] as Array<{ queryKey?: unknown[]; enabled?: boolean }>,
}))

vi.mock('@tanstack/react-query', () => ({
  useQueries: ({ queries }: { queries: Array<{ queryKey?: unknown[]; enabled?: boolean }> }) => {
    mocks.capturedQueries = queries
    return mocks.queryResults
  },
}))
vi.mock('../../src/services/apis/rest-api/fee.service', () => ({ getAccruedFees: vi.fn() }))
vi.mock('../../src/services/apis/rest-api/trade.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/apis/rest-api/trade.service')>()
  return {
    ...actual,
    getHistory: vi.fn(),
  }
})

const fee = (vault: string, perf: number, mgmt: number) => ({
  vault_id: vault, accrued_performance_fee: perf, accrued_management_fee: mgmt, total_accrued: perf + mgmt,
})
const trade = (id: string, date: string) => ({
  id, vault_id: 'v1', actor_id: 'user', transaction_signature: 'sig', trade_type: 'Buy',
  input_token: 'SOL', output_token: 'USDC', amount_in: 1, amount_out: 2, price_at_execution: 2, executed_at: date,
})

beforeEach(() => {
  mocks.queryResults = []
  mocks.capturedQueries = []
})

describe('useFees', () => {
  it('deduplicates and removes empty vault ids', () => {
    renderHook(() => useFees(['v1', '', 'v1', 'v2']))
    expect(mocks.capturedQueries.map((query) => query.queryKey)).toEqual([['fees', 'v1'], ['fees', 'v2']])
  })

  it('reports loading when any fee query loads', () => {
    mocks.queryResults = [{ isLoading: false }, { isLoading: true }]
    const { result } = renderHook(() => useFees(['v1', 'v2']))
    expect(result.current.isLoading).toBe(true)
  })

  it('filters missing fee responses', () => {
    mocks.queryResults = [{ data: fee('v1', 2, 3) }, { data: undefined }]
    const { result } = renderHook(() => useFees(['v1', 'v2']))
    expect(result.current.fees).toHaveLength(1)
  })

  it('totals fee categories', () => {
    mocks.queryResults = [{ data: fee('v1', 2, 3) }, { data: fee('v2', 5, 7) }]
    const { result } = renderHook(() => useFees(['v1', 'v2']))
    expect(result.current).toMatchObject({ totalFees: 17, totalPerf: 7, totalMgmt: 10 })
  })
})

describe('useTradeHistory', () => {
  it('creates one query per vault and disables empty ids', () => {
    renderHook(() => useTradeHistory(['v1', '']))
    expect(mocks.capturedQueries.map((query) => query.enabled)).toEqual([true, false])
  })

  it('reports loading when any history query loads', () => {
    mocks.queryResults = [{ isLoading: true }, { isLoading: false }]
    const { result } = renderHook(() => useTradeHistory(['v1', 'v2']))
    expect(result.current.isLoading).toBe(true)
  })

  it('combines and sorts trades newest first', () => {
    mocks.queryResults = [
      { data: { trades: [trade('old', '2025-01-01T00:00:00Z')] } },
      { data: { trades: [trade('new', '2026-01-01T00:00:00Z')] } },
    ]
    const { result } = renderHook(() => useTradeHistory(['v1', 'v2']))
    expect(result.current.trades.map((item) => item.id)).toEqual(['new', 'old'])
  })

  it('ignores absent history responses', () => {
    mocks.queryResults = [{ data: undefined }, { data: { trades: [] } }]
    const { result } = renderHook(() => useTradeHistory(['v1', 'v2']))
    expect(result.current.trades).toEqual([])
  })
})
