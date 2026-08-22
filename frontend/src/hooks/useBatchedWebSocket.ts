import { useEffect, useRef } from 'react'
import { useWebSocketStore } from '@/stores/websocket-store'
import type { WSMessage } from '@/types'

export interface UseBatchedWebSocketOptions<T = WSMessage> {
  /**
   * Flush interval in milliseconds. Defaults to 200ms (~5 FPS batched renders, 60fps frame rate).
   */
  intervalMs?: number
  /**
   * Optional filter to only buffer matching messages.
   */
  filter?: (msg: WSMessage) => boolean
  /**
   * Batch consumer function called once per interval with all accumulated messages.
   */
  onBatch: (batch: T[]) => void
}

/**
 * High-performance WebSocket batching hook.
 * Buffers high-throughput incoming WS messages in-memory and flushes
 * them in atomic batches to prevent React render thrashing and CPU overload.
 */
export function useBatchedWebSocket<T = WSMessage>({
  intervalMs = 200,
  filter,
  onBatch,
}: UseBatchedWebSocketOptions<T>) {
  const onMessage = useWebSocketStore((s) => s.onMessage)
  const bufferRef = useRef<T[]>([])
  const onBatchRef = useRef(onBatch)
  const filterRef = useRef(filter)

  useEffect(() => {
    onBatchRef.current = onBatch
    filterRef.current = filter
  })

  useEffect(() => {
    const unsub = onMessage((msg) => {
      const allowed = !filterRef.current || filterRef.current(msg)
      if (allowed) {
        bufferRef.current.push(msg as unknown as T)
      }
    })

    const timer = setInterval(() => {
      if (bufferRef.current.length === 0) return
      const batch = bufferRef.current
      bufferRef.current = []
      onBatchRef.current(batch)
    }, intervalMs)

    return () => {
      unsub()
      clearInterval(timer)
    }
  }, [intervalMs, onMessage])
}
