import { useRef, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useBatchedWebSocket } from './useBatchedWebSocket'
import type { WSEventHandler, WSHandlerContext } from '@/services/ws/handlers/types'
import type { WSMessage } from '@/types'

export interface UseRealtimeSyncOptions {
  /**
   * Array of dedicated message handlers to mount on this view.
   */
  handlers: WSEventHandler<any>[]
  /**
   * Optional connected wallet address for user-scoped cache updates.
   */
  walletAddress?: string | null
  /**
   * Batch interval in milliseconds. Defaults to 200ms.
   */
  intervalMs?: number
}

/**
 * Universal, modular Realtime Sync Hook.
 * Composes independent, typesafe domain handlers (vaults, portfolio, activity, etc.)
 * into a single micro-interval batch processor without code duplication.
 */
export function useRealtimeSync({
  handlers,
  walletAddress,
  intervalMs = 200,
}: UseRealtimeSyncOptions) {
  const queryClient = useQueryClient()
  const handlersRef = useRef(handlers)

  useEffect(() => {
    handlersRef.current = handlers
  })

  useBatchedWebSocket({
    intervalMs,
    filter: (msg: WSMessage) => {
      const allTypes = handlersRef.current.flatMap((h) => h.types)
      return allTypes.includes(msg.type)
    },
    onBatch: (batch: WSMessage[]) => {
      const ctx: WSHandlerContext = { queryClient, walletAddress }

      // Group batch messages by handler
      for (const handler of handlersRef.current) {
        const handlerTypes = new Set(handler.types)
        const relevantMessages = batch.filter((m) => handlerTypes.has(m.type))

        if (relevantMessages.length > 0) {
          handler.handleBatch(relevantMessages, ctx)
        }
      }
    },
  })
}
