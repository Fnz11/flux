import { create } from 'zustand'
import type { Notification, WSMessage } from '../types'
import type { getNotifications, markAllNotificationsRead } from '@/services/apis/rest-api/notification.service'
import { useWebSocketStore } from './websocket-store'

interface NotificationState {
  items: Notification[]
  unread: number
  total: number
  isLoading: boolean
  error: string | null
}

interface NotificationActions {
  fetch: (unreadOnly?: boolean, fetcher?: typeof getNotifications) => Promise<void>
  markAllRead: (fetcher?: typeof markAllNotificationsRead) => Promise<void>
  add: (item: Notification) => void
  pushFromMessage: (msg: WSMessage) => void
}

export type NotificationStore = NotificationState & NotificationActions

function toNotification(raw: unknown): Notification | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (
    typeof r.id !== 'string' ||
    typeof r.type !== 'string' ||
    typeof r.title !== 'string' ||
    typeof r.message !== 'string' ||
    typeof r.read !== 'boolean' ||
    typeof r.createdAt !== 'string'
  ) {
    return null
  }
  return { id: r.id, type: r.type, title: r.title, message: r.message, read: r.read, createdAt: r.createdAt }
}

export const useNotificationStore = create<NotificationStore>()((set, get) => ({
  items: [],
  unread: 0,
  total: 0,
  isLoading: false,
  error: null,

  fetch: async (unreadOnly, fetcher) => {
    const load = fetcher ?? (await import('@/services/apis/rest-api/notification.service')).getNotifications
    set({ isLoading: true, error: null })
    try {
      const { items, total, unread } = await load({ unread: unreadOnly })
      set({ items, total, unread, isLoading: false })
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false })
    }
  },

  markAllRead: async (fetcher) => {
    const load = fetcher ?? (await import('@/services/apis/rest-api/notification.service')).markAllNotificationsRead
    try {
      await load()
      set((s) => ({ items: s.items.map((n) => ({ ...n, read: true })), unread: 0 }))
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) })
    }
  },

  add: (item) =>
    set((s) => {
      if (s.items.some((n) => n.id === item.id)) return s
      return {
        items: [item, ...s.items],
        unread: s.unread + (item.read ? 0 : 1),
      }
    }),

  pushFromMessage: (msg) => {
    const incoming = msg as { type?: string; data?: unknown }
    if (incoming.type !== 'notification') return
    const item = toNotification(incoming.data)
    if (item) get().add(item)
  },
}))

export function registerNotificationWsListener(): () => void {
  return useWebSocketStore.getState().onMessage((msg) => {
    useNotificationStore.getState().pushFromMessage(msg)
  })
}
