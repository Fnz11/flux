import { create } from 'zustand'
import type { WSMessage } from '../types'

type MessageHandler = (msg: WSMessage) => void

interface WebSocketState {
  isConnected: boolean
  lastMessage: WSMessage | null
  reconnectAttempts: number
  subscriptions: string[]
  wallet: string | null
}

interface WebSocketActions {
  connect: (url: string) => void
  disconnect: () => void
  authenticate: (wallet: string | null) => void
  subscribe: (channel: string, wallet?: string) => void
  unsubscribe: (channel: string) => void
  subscribeMany: (channels: string[], wallet?: string) => void
  unsubscribeMany: (channels: string[]) => void
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
  wallet: null,
  ws: null,
  handlers: new Set(),

  connect: (url) => {
    const { ws } = get()
    if (ws?.readyState === WebSocket.OPEN || ws?.readyState === WebSocket.CONNECTING) return

    const socket = new WebSocket(url)

    socket.onopen = () => {
      set({ isConnected: true, reconnectAttempts: 0 })
      const { wallet, subscriptions } = get()
      if (wallet) {
        socket.send(JSON.stringify({ type: 'auth', wallet }))
      }
      if (subscriptions.length > 0) {
        socket.send(JSON.stringify({ type: 'subscribe', channels: subscriptions, wallet: wallet || undefined }))
      }
    }

    socket.onmessage = (event) => {
      try {
        const raw = String(event.data || '')
        const lines = raw.includes('\n') ? raw.split('\n') : [raw]
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const msg: WSMessage = JSON.parse(trimmed)
          set({ lastMessage: msg })
          get().handlers.forEach((handler) => handler(msg))
        }
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

  authenticate: (wallet) => {
    const current = get()
    if (current.wallet === wallet && current.isConnected) return
    set({ wallet })
    if (wallet && current.ws?.readyState === WebSocket.OPEN) {
      current.ws.send(JSON.stringify({ type: 'auth', wallet }))
    }
  },

  subscribe: (channel, wallet) =>
    set((s) => {
      const activeWallet = wallet || s.wallet || undefined
      if (s.subscriptions.includes(channel)) return s
      if (s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({ type: 'subscribe', channel, wallet: activeWallet }))
      }
      return { subscriptions: [...s.subscriptions, channel], ...(wallet ? { wallet } : {}) }
    }),

  unsubscribe: (channel) =>
    set((s) => {
      if (s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({ type: 'unsubscribe', channel }))
      }
      return { subscriptions: s.subscriptions.filter((c) => c !== channel) }
    }),

  subscribeMany: (channels, wallet) =>
    set((s) => {
      const activeWallet = wallet || s.wallet || undefined
      const newChannels = channels.filter((c) => Boolean(c) && !s.subscriptions.includes(c))
      if (newChannels.length === 0) return s
      if (s.ws?.readyState === WebSocket.OPEN) {
        s.ws.send(JSON.stringify({ type: 'subscribe', channels: newChannels, wallet: activeWallet }))
      }
      return { subscriptions: [...s.subscriptions, ...newChannels], ...(wallet ? { wallet } : {}) }
    }),

  unsubscribeMany: (channels) =>
    set((s) => {
      const toRemove = new Set(channels)
      if (s.ws?.readyState === WebSocket.OPEN && channels.length > 0) {
        s.ws.send(JSON.stringify({ type: 'unsubscribe', channels }))
      }
      return { subscriptions: s.subscriptions.filter((c) => !toRemove.has(c)) }
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
