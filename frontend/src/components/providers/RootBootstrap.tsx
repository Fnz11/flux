import React, { useEffect } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useConfigStore } from '@/stores/config-store'
import { useWebSocketStore } from '@/stores/websocket-store'
import { useNotificationWs } from '@/services/ws'

export function RootBootstrap({ children }: { children: React.ReactNode }) {
  const { publicKey } = useWallet()
  const walletAddress = publicKey?.toBase58()

  useNotificationWs()

  useEffect(() => {
    useConfigStore.getState().fetchConfig().catch(() => {})

    const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8080/api/v1/ws'
    try {
      useWebSocketStore.getState().connect(wsUrl)
    } catch {
      // WS connection fallback handled in store
    }
  }, [])

  useEffect(() => {
    if (walletAddress) {
      useWebSocketStore.getState().authenticate(walletAddress)
    }
  }, [walletAddress])

  return <>{children}</>
}
