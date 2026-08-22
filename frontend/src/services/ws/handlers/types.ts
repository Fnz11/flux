import type { QueryClient } from '@tanstack/react-query'
import type { WSMessage } from '@/types'

export interface WSHandlerContext {
  queryClient: QueryClient
  walletAddress?: string | null
}

export interface WSEventHandler<T = unknown> {
  types: readonly string[]
  handleBatch: (messages: WSMessage<T>[], ctx: WSHandlerContext) => void
}
