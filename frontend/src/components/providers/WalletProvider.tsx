import React, { useMemo } from 'react'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'

interface Props {
  children: React.ReactNode
}

export function WalletProvider({ children }: Props) {
  const endpoint = useMemo(() => {
    return import.meta.env.VITE_SOLANA_RPC_URL || import.meta.env.VITE_RPC_ENDPOINT || 'http://127.0.0.1:8899'
  }, [])

  const wsEndpoint = useMemo(() => {
    if (import.meta.env.VITE_SOLANA_WS_URL) {
      return import.meta.env.VITE_SOLANA_WS_URL
    }
    if (endpoint.includes('127.0.0.1:8899') || endpoint.includes('localhost:8899')) {
      return endpoint.replace('8899', '8900').replace('http://', 'ws://').replace('https://', 'wss://')
    }
    if (endpoint.startsWith('http://')) {
      return endpoint.replace('http://', 'ws://')
    }
    if (endpoint.startsWith('https://')) {
      return endpoint.replace('https://', 'wss://')
    }
    return undefined
  }, [endpoint])

  const connectionConfig = useMemo(() => ({
    commitment: 'confirmed' as const,
    wsEndpoint,
  }), [wsEndpoint])

  // Standard wallet adapters (Phantom, Solflare, etc.) are auto-discovered by WalletProvider
  const wallets = useMemo(() => [], [])

  return (
    <ConnectionProvider endpoint={endpoint} config={connectionConfig}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
