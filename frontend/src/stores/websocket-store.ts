import { create } from 'zustand'
import type { WSMessage } from '../types'

type MessageHandler = (msg: WSMessage) => void

interface WebSocketState {
  isConnected: boolean
  lastMessage: WSMessage | null
  reconnectAttempts: number
  subscriptions: string[]
}

interface WebSocketActions {
  connect: (url: string) => void
  disconnect: () => void
  subscribe: (channel: string) => void
  unsubscribe: (channel: string) => void
  onMessage: (handler: MessageHandler) => () => void
}

type WebSocketStore = WebSocketState & WebSocketActions & { ws: WebSocket | null; handlers: Set<MessageHandler> }

const MAX_RECONNECT = 10
const RECONNECT_BASE = 1000

export const useWebSocketStore = create<WebSocketStore>()((set, get) => ({
  isConnected: false,
  lastMessage: null,
  reconnectAttempts: 0,
  subscriptions: [],
  ws: null,
  handlers: new Set(),

  connect: (url) => {
    const { ws } = get()
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return

    const socket = new WebSocket(url)

    socket.onopen = () => {
      set({ isConnected: true, reconnectAttempts: 0 })
      const { subscriptions } = get()
      subscriptions.forEach((channel) => {
        socket.send(JSON.stringify({ type: 'subscribe', channel }))
      })
    }

    socket.onmessage = (event) => {
      try {
        const msg: WSMessage = JSON.parse(event.data)
        set({ lastMessage: msg })
        get().handlers.forEach((handler) => handler(msg))
      } catch {
        // ignore malformed messages
      }
    }

    socket.onclose = () => {
      set({ isConnected: false, ws: null })
      const { reconnectAttempts, connect: reconnect, subscriptions } = get()
      if (subscriptions.length > 0 && reconnectAttempts < MAX_RECONNECT) {
        const delay = RECONNECT_BASE * Math.pow(2, reconnectAttempts)
        set((s) => ({ reconnectAttempts: s.reconnectAttempts + 1 }))
        setTimeout(() => reconnect(url), delay)
      }
    }

    socket.onerror = () => {
      socket.close()
    }

    set({ ws: socket })
  },

  disconnect: () => {
    const { ws } = get()
    ws?.close()
    set({ ws: null, isConnected: false, subscriptions: [] })
  },

  subscribe: (channel) =>
    set((s) => {
      if (s.subscriptions.includes(channel)) return s
      if (s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({ type: 'subscribe', channel }))
      }
      return { subscriptions: [...s.subscriptions, channel] }
    }),

  unsubscribe: (channel) =>
    set((s) => {
      if (s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({ type: 'unsubscribe', channel }))
      }
      return { subscriptions: s.subscriptions.filter((c) => c !== channel) }
    }),

  onMessage: (handler) => {
    set((state) => ({ handlers: new Set(state.handlers).add(handler) }))
    return () => {
      set((state) => {
        const next = new Set(state.handlers)
        next.delete(handler)
        return { handlers: next }
      })
    }
  },
}))
