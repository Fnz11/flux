import React, { useMemo } from 'react'
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react'
import { clusterApiUrl } from '@solana/web3.js'

interface Props {
  children: React.ReactNode
}

export function WalletProvider({ children }: Props) {
  const endpoint = useMemo(() => {
    return import.meta.env.VITE_SOLANA_RPC_URL || import.meta.env.VITE_RPC_ENDPOINT || 'http://127.0.0.1:8899'
  }, [])

  // Standard wallet adapters (Phantom, Solflare, etc.) are auto-discovered by WalletProvider
  const wallets = useMemo(() => [], [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}
