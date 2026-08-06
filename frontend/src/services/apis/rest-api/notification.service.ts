import { api } from '@/lib/api'
import type { Notification, ApiNotification, NotificationsResponse } from '@/types'

export interface GetNotificationsParams { unread?: boolean; page?: number; limit?: number }

export async function getNotifications(params?: GetNotificationsParams): Promise<{ items: Notification[]; total: number; unread: number }> {
  const q = new URLSearchParams()
  if (params?.unread) q.set('unread', 'true')
  if (params?.page) q.set('page', String(params.page))
  if (params?.limit) q.set('limit', String(params.limit))
  const s = q.toString()
  const res = await api.get<NotificationsResponse>(`/notifications${s ? '?' + s : ''}`)
  return { items: (res.items ?? []).map(mapApiNotification), total: res.total ?? 0, unread: res.unread ?? 0 }
}
export async function createNotification(input: { type: string; title: string; message: string }): Promise<Notification> {
  const raw = await api.post<ApiNotification>('/notifications', input)
  return mapApiNotification(raw)
}
export async function markAllNotificationsRead(): Promise<void> {
  await api.post('/notifications/read', {})
}
export function mapApiNotification(raw: ApiNotification): Notification {
  return { id: raw.id, type: raw.type, title: raw.title, message: raw.message, read: raw.read, createdAt: raw.created_at }
}
