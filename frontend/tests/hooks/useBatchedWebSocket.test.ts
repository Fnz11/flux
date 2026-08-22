import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useBatchedWebSocket } from '@/hooks/useBatchedWebSocket'
import { useWebSocketStore } from '@/stores/websocket-store'
import type { WSMessage } from '@/types'

describe('useBatchedWebSocket Hook', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('buffers high-frequency events and flushes them in a single batch on the interval', () => {
    const onBatch = vi.fn()

    renderHook(() =>
      useBatchedWebSocket({
        intervalMs: 200,
        onBatch,
      })
    )

    // Simulate rapid incoming WebSocket events
    const store = useWebSocketStore.getState()
    act(() => {
      store.handlers.forEach((h) =>
        h({
          type: 'portfolio_summary_update',
          data: { pnl_delta: 5 },
          timestamp: Date.now(),
        } as WSMessage)
      )
      store.handlers.forEach((h) =>
        h({
          type: 'portfolio_summary_update',
          data: { pnl_delta: -2 },
          timestamp: Date.now(),
        } as WSMessage)
      )
    })

    // Not yet called before timer interval
    expect(onBatch).not.toHaveBeenCalled()

    // Advance timer by 200ms
    act(() => {
      vi.advanceTimersByTime(200)
    })

    // Dispatched in 1 single atomic batch containing both messages
    expect(onBatch).toHaveBeenCalledTimes(1)
    expect(onBatch.mock.calls[0][0]).toHaveLength(2)
  })
})
