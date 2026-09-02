import { useEffect } from 'react'
import { useWebSocketStore } from '@/stores/websocket-store'
import { useAppStore } from '@/stores/app-store'
import { registerNotificationWsListener } from '@/stores/notification-store'

export function subscribeToNotifications(wallet: string): () => void {
  const channel = 'notification'
  useWebSocketStore.getState().subscribe(channel, wallet)
  return () => {
    useWebSocketStore.getState().unsubscribe(channel)
  }
}

export function startWsHeartbeat(intervalMs: number = 30000): () => void {
  const timer = setInterval(() => {
    const ws = useWebSocketStore.getState().ws
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }))
    }
  }, intervalMs)
  return () => clearInterval(timer)
}

export function useNotificationWs(): void {
  const currentUser = useAppStore((s) => s.currentUser)

  useEffect(() => {
    useWebSocketStore.getState().authenticate(currentUser)
    if (!currentUser) return
    return subscribeToNotifications(currentUser)
  }, [currentUser])

  useEffect(() => {
    return registerNotificationWsListener()
  }, [])

  useEffect(() => {
    return startWsHeartbeat()
  }, [])
}