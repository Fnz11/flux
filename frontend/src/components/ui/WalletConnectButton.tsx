'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Wallet, LogOut, Copy, ChevronDown } from 'lucide-react'
import { Modal } from './modal'
import { Button } from './button'
import { useAppStore } from '@/stores/app-store'
import { usePortfolioStore, useVaultStore } from '@/stores'

export function WalletConnectButton() {
  const { wallets, select, connect, disconnect, connected, publicKey } = useWallet()
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)

  const [isOpen, setIsOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Sync wallet address with global store
  useEffect(() => {
    if (connected && publicKey) {
      setCurrentUser(publicKey.toBase58())
    } else {
      setCurrentUser(null)
      usePortfolioStore.getState().reset()
      useVaultStore.getState().reset()
    }
  }, [connected, publicKey, setCurrentUser])

  const address = publicKey?.toBase58() ?? ''
  const truncatedAddress = address
    ? `${address.slice(0, 4)}...${address.slice(-4)}`
    : ''

  const handleCopy = useCallback(async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }, [address])

  const handleSelectWallet = async (walletName: any) => {
    try {
      select(walletName)
      setIsOpen(false)
      await connect()
    } catch (err) {
      console.error('Wallet connection error:', err)
    }
  }

  const handleDisconnect = useCallback(() => {
    disconnect()
    usePortfolioStore.getState().reset()
    useVaultStore.getState().reset()
    setCurrentUser(null)
    setDropdownOpen(false)
  }, [disconnect, setCurrentUser])

  if (connected && address) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="group inline-flex items-center gap-2 rounded-xl border border-border-medium bg-bg-elevated px-3 py-1.5 text-xs font-mono text-text-primary transition-all hover:border-primary-gold/40 hover:bg-bg-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-coral"
        >
          <span className="size-2 rounded-full bg-status-success animate-pulse" />
          <span>{truncatedAddress}</span>
          <ChevronDown className="size-3 text-text-tertiary transition-transform group-hover:text-text-primary" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 rounded-xl border border-border-medium bg-bg-elevated p-2 shadow-xl backdrop-blur-xl z-50">
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-inset hover:text-text-primary transition-colors"
            >
              <Copy className="size-3.5" />
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
            <button
              onClick={handleDisconnect}
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-status-error hover:bg-status-error/10 transition-colors"
            >
              <LogOut className="size-3.5" />
              Disconnect
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <>
      <Button
        variant="sweep"
        size="sm"
        onClick={() => setIsOpen(true)}
        className="h-7 px-3 text-xs gap-1.5"
      >
        <Wallet className="size-3.5" />
        <span>Connect Wallet</span>
      </Button>

      <Modal open={isOpen} onOpenChange={setIsOpen} title="Connect Wallet">
        <div className="space-y-3 py-2">
          <p className="text-xs text-text-tertiary">
            Select a Solana wallet to connect to FBYT platform:
          </p>
          <div className="grid gap-2">
            {wallets.length > 0 ? (
              wallets.map((w) => (
                <Button
                  key={w.adapter.name}
                  type="button"
                  variant="outline"
                  onClick={() => handleSelectWallet(w.adapter.name)}
                  className="h-auto w-full items-center justify-between bg-bg-inset px-4 py-3 text-left transition-all hover:border-primary-coral/50 hover:bg-bg-elevated font-normal"
                >
                  <div className="flex items-center gap-3">
                    {w.adapter.icon && (
                      <img src={w.adapter.icon} alt={w.adapter.name} className="size-6 rounded" />
                    )}
                    <span className="text-sm font-medium text-text-primary">{w.adapter.name}</span>
                  </div>
                  <span className="text-xs text-text-tertiary">
                    {w.readyState}
                  </span>
                </Button>
              ))
            ) : (
              <div className="rounded-xl border border-border-subtle bg-bg-inset p-4 text-center">
                <p className="text-sm text-text-secondary">No wallet extension detected.</p>
                <p className="mt-1 text-xs text-text-tertiary">
                  Please install Phantom or Solflare wallet extension in your browser.
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
