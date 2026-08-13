import React, { useEffect } from 'react'
import { useConfigStore } from '@/stores/config-store'
import { useWebSocketStore } from '@/stores/websocket-store'

export function RootBootstrap({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    useConfigStore.getState().fetchConfig().catch(() => {})

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/v1/ws'
    try {
      useWebSocketStore.getState().connect(wsUrl)
    } catch {
      // WS connection fallback handled in store
    }
  }, [])

  return <>{children}</>
}
