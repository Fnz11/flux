'use client'

import { useState, useEffect, useCallback } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { Wallet, LogOut, Copy, ChevronsUpDown } from 'lucide-react'
import { Modal } from './modal'
import { Button } from './button'
import { useAppStore } from '@/stores/app-store'
import { usePortfolioStore, useVaultStore } from '@/stores'
import { setAuthToken } from '@/lib/api'
import { getCachedAuthToken } from '@/services/apis/rest-api/auth.service'

export function WalletConnectButton() {
  const { wallets = [], select, disconnect, connected, publicKey } = useWallet()
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)

  const [isOpen, setIsOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  // Sync wallet address with global store
  useEffect(() => {
    if (connected && publicKey) {
      const addr = publicKey.toBase58()
      setCurrentUser(addr)
      const cached = getCachedAuthToken(addr)
      if (cached) {
        setAuthToken(cached)
      }
    } else {
      setCurrentUser(null)
      setAuthToken(null)
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

  const handleSelectWallet = async (walletName: Parameters<typeof select>[0]) => {
    try {
      select(walletName)
      setIsOpen(false)
    } catch (err) {
      console.error('Wallet connection error:', err)
    }
  }

  const handleDisconnect = async () => {
    try {
      await disconnect()
      usePortfolioStore.getState().reset()
      useVaultStore.getState().reset()
      setCurrentUser(null)
      setDropdownOpen(false)
    } catch (err) {
      console.error('Wallet disconnect error:', err)
    }
  }

  if (connected && address) {
    return (
      <div className="relative w-full">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="group flex w-full items-center justify-between gap-2 rounded-xl border border-border-medium bg-bg-elevated/90 px-2.5 py-1.5 transition-colors hover:border-primary-coral/40 hover:bg-bg-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-coral cursor-pointer shadow-md min-w-0"
        >
          {/* Left Square Wallet Icon Badge */}
          <div className="flex size-6 items-center justify-center rounded-md bg-bg-inset border border-border-subtle text-primary-coral group-hover:border-primary-coral/40 transition-colors shrink-0">
            <Wallet className="size-3" />
          </div>

          {/* Account Label & Truncated Address */}
          <div className="flex flex-col text-left min-w-0 flex-1">
            <span className="text-[8px] font-medium uppercase tracking-wider text-text-tertiary leading-none mb-0.5 truncate">
              Your account
            </span>
            <span className="text-[11px] font-semibold font-mono text-text-primary leading-none truncate">
              {truncatedAddress}
            </span>
          </div>

          {/* Chevrons Up Down Icon */}
          <ChevronsUpDown className="size-3 text-text-tertiary group-hover:text-text-primary transition-colors shrink-0" />
        </button>

        {dropdownOpen && (
          <div className="absolute right-0 mt-2 w-52 rounded-2xl border border-white/15 bg-bg-elevated/95 p-2 shadow-[0_16px_50px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-3xl z-50">
            <button
              onClick={handleCopy}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-inset hover:text-text-primary transition-colors cursor-pointer"
            >
              <Copy className="size-3.5" />
              {copied ? 'Copied!' : 'Copy Address'}
            </button>
            <button
              onClick={handleDisconnect}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-status-error hover:bg-status-error/10 transition-colors cursor-pointer"
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
        icon={<Wallet className="size-3.5" />}
        onClick={() => setIsOpen(true)}
        className="h-8 text-xs pl-10 pr-4"
      >
        <span>Connect Wallet</span>
      </Button>

      <Modal open={isOpen} onOpenChange={setIsOpen} title="Connect Wallet">
        <div className="space-y-3">
          <p className="text-xs text-text-tertiary">
            Select a Solana wallet to connect to Flux platform:
          </p>
          <div className="grid gap-2">
            {wallets.map((w) => (
              <Button
                key={w.adapter.name}
                type="button"
                variant="outline"
                onClick={() => handleSelectWallet(w.adapter.name)}
                className="h-auto w-full items-center justify-between bg-bg-inset px-4 py-3 text-left transition-[border-color,background-color] hover:border-primary-coral/50 hover:bg-bg-elevated font-normal cursor-pointer"
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
            ))}

            {wallets.length === 0 && (
              <p className="rounded-xl border border-border-subtle/50 bg-bg-inset/40 px-4 py-3 text-xs text-text-tertiary">
                No wallet extension detected. Install a Solana wallet extension to continue.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </>
  )
}
