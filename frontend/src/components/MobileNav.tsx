"use client"

import { useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { LazyMotion, domAnimation, m, AnimatePresence } from 'framer-motion'
import {
  Menu,
  User,
  LogOut,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  Shield,
  Zap,
  Search,
  SlidersHorizontal,
  LayoutDashboard,
  Wallet,
  ArrowRightLeft,
  BookOpen,
  Gift,
  Medal,
} from 'lucide-react'
import { useWallet } from '@solana/wallet-adapter-react'
import { useAppStore } from '@/stores/app-store'
import { usePortfolioStore, useVaultStore } from '@/stores'
import { toastInfo, toastSuccess } from '@/lib/toast'
import { WalletConnectButton } from '@/components/ui/WalletConnectButton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { SOLSCAN_CLUSTER } from '@/constants'
import { managerLinks, investLinks } from '@/constants/navigation'

const campaignLinks = [
  { label: 'Learn & Earn', icon: BookOpen },
  { label: 'Airdrops', icon: Gift },
  { label: 'Rewards', icon: Medal },
] as const

function truncateAddress(address: string): string {
  if (!address) return ''
  return `${address.slice(0, 6)}...${address.slice(-6)}`
}

function getActiveIndex(pathname: string, drawerType: 'menu' | 'profile' | null): number {
  if (!drawerType) {
    if (pathname === '/') return 0
    if (pathname.startsWith('/vaults') || pathname.startsWith('/invest')) return 1
    return -1
  }
  if (drawerType === 'menu') return 2
  if (drawerType === 'profile') return 3
  return -1
}

function handleComingSoon(label: string) {
  toastInfo(`${label} is coming soon!`)
}

const emptySubscribe = () => () => {}

interface MobileMenuContentProps {
  currentUser: string | null
  isManager: boolean
  links: typeof managerLinks | typeof investLinks
  onModeSwitch: (managerMode: boolean) => void
  onClose: () => void
  onOpenSearch: () => void
}

function MobileMenuContent({
  currentUser,
  isManager,
  links,
  onModeSwitch,
  onClose,
  onOpenSearch,
}: MobileMenuContentProps) {
  return (
    <>
      {/* Mode Switcher */}
      {currentUser && (
        <div className="rounded-2xl border border-border-medium/80 bg-bg-inset/50 p-3 backdrop-blur-md">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
              Mode Selection
            </span>
            <span className="text-[10px] font-mono text-primary-gold">
              {isManager ? 'Vault Manager' : 'Investor'}
            </span>
          </div>
          <div className="flex rounded-xl border border-border-subtle bg-bg-elevated p-1">
            <button
              type="button"
              onClick={() => onModeSwitch(true)}
              className={cn(
                'flex-1 py-2 text-xs font-semibold rounded-lg transition-[background-color,border-color,color,box-shadow] cursor-pointer',
                isManager
                  ? 'bg-bg-surface text-text-primary shadow-md border border-border-subtle'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              Manager Mode
            </button>
            <button
              type="button"
              onClick={() => onModeSwitch(false)}
              className={cn(
                'flex-1 py-2 text-xs font-semibold rounded-lg transition-[background-color,border-color,color,box-shadow] cursor-pointer',
                !isManager
                  ? 'bg-primary-gold text-black shadow-md'
                  : 'text-text-tertiary hover:text-text-secondary'
              )}
            >
              Invest Mode
            </button>
          </div>
        </div>
      )}

      {/* Quick Search Button */}
      <button
        type="button"
        onClick={() => {
          onClose()
          onOpenSearch()
        }}
        className="w-full flex items-center justify-between px-4 py-3 rounded-2xl border border-border-medium/80 bg-bg-inset/40 text-text-secondary hover:text-text-primary hover:bg-bg-elevated transition-colors group cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <Search className="size-4 text-text-muted group-hover:text-primary-gold transition-colors" />
          <span className="text-xs font-medium">Search vaults & assets...</span>
        </div>
        <kbd className="px-2 py-0.5 text-[10px] font-mono rounded-md bg-bg-surface border border-border-subtle text-text-tertiary">
          Search
        </kbd>
      </button>

      {/* Navigation Links */}
      <div>
        <h4 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Protocol Pages
        </h4>
        <div className="grid gap-1.5">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              onClick={onClose}
              activeProps={{
                className: 'bg-bg-elevated text-primary-gold border-border-subtle/80 shadow-sm font-semibold',
              }}
              inactiveProps={{
                className: 'text-text-secondary hover:text-text-primary hover:bg-bg-inset/60 border-transparent',
              }}
              className="flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium border transition-colors"
            >
              <div className="flex items-center gap-3">
                <link.icon className="size-4 text-text-tertiary shrink-0" />
                <span>{link.label}</span>
              </div>
              <ChevronRight className="size-4 text-text-tertiary" />
            </Link>
          ))}
        </div>
      </div>

      {/* Campaign Section */}
      <div>
        <h4 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          Rewards & Campaigns
        </h4>
        <div className="grid gap-1.5">
          {campaignLinks.map((link) => (
            <button
              key={link.label}
              type="button"
              onClick={() => handleComingSoon(link.label)}
              className="flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-medium border border-transparent text-text-secondary hover:text-text-primary hover:bg-bg-inset/60 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <link.icon className="size-4 text-text-tertiary shrink-0" />
                <span>{link.label}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-gold/15 text-primary-gold border border-primary-gold/30 font-mono">
                Soon
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}

interface MobileProfileContentProps {
  address: string
  truncatedAddress: string
  isManager: boolean
  copied: boolean
  onCopyAddress: () => void
  onDisconnectWallet: () => void
  onNavigate: (path: string) => void
}

function MobileProfileContent({
  address,
  truncatedAddress,
  isManager,
  copied,
  onCopyAddress,
  onDisconnectWallet,
  onNavigate,
}: MobileProfileContentProps) {
  if (!address) {
    return (
      <div className="rounded-2xl border border-border-medium bg-bg-inset/40 p-5 text-center space-y-3">
        <div className="size-12 rounded-2xl bg-primary-gold/15 border border-primary-gold/30 flex items-center justify-center text-primary-gold mx-auto shadow-md">
          <Wallet className="size-6" />
        </div>
        <div>
          <h4 className="text-sm font-bold text-text-primary">Connect Solana Wallet</h4>
          <p className="text-xs text-text-tertiary mt-1 max-w-[42ch] mx-auto">
            Connect your Solana wallet to invest in liquidity vaults, track portfolio yield, and rebalance AMM positions.
          </p>
        </div>
        <div className="pt-2">
          <WalletConnectButton />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Connected Card */}
      <div className="rounded-2xl border border-border-medium bg-bg-inset/60 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary-gold/15 text-primary-gold border border-primary-gold/30">
              <Zap className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-text-primary">Connected Account</p>
              <p className="text-[10px] text-status-success flex items-center gap-1.5 font-mono">
                <span className="size-1.5 rounded-full bg-status-success animate-pulse" />
                Connected
              </p>
            </div>
          </div>
          <span className="text-[10px] font-semibold px-2.5 py-1 rounded-lg bg-bg-elevated border border-border-subtle text-text-secondary uppercase">
            {isManager ? 'Manager' : 'Investor'}
          </span>
        </div>

        <div className="p-3 rounded-xl bg-bg-elevated border border-border-subtle/80 flex items-center justify-between">
          <span className="font-mono text-xs font-semibold text-text-primary">
            {truncatedAddress}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onCopyAddress}
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-inset transition-colors cursor-pointer"
              title="Copy address"
            >
              {copied ? <Check className="size-4 text-status-success" /> : <Copy className="size-4" />}
            </button>
            <a
              href={`https://solscan.io/account/${address}?cluster=${SOLSCAN_CLUSTER}`}
              target="_blank"
              rel="noreferrer"
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-inset transition-colors"
              title="View on Solscan"
            >
              <ExternalLink className="size-4" />
            </a>
          </div>
        </div>
      </div>

      {/* Direct Shortcuts */}
      <div className="grid grid-cols-2 gap-2.5">
        <Button
          type="button"
          variant="outline"
          onClick={() => onNavigate(isManager ? '/vaults' : '/portfolio')}
          className="h-11 justify-start gap-2 bg-bg-inset/40 text-xs font-semibold border-border-medium hover:border-primary-gold/40"
        >
          <Shield className="size-4 text-primary-gold" />
          <span>{isManager ? 'My Vaults' : 'My Portfolio'}</span>
        </Button>

        <Button
          type="button"
          variant="outline"
          onClick={() => onNavigate(isManager ? '/trade' : '/invest')}
          className="h-11 justify-start gap-2 bg-bg-inset/40 text-xs font-semibold border-border-medium hover:border-primary-coral/40"
        >
          <ArrowRightLeft className="size-4 text-primary-coral" />
          <span>{isManager ? 'Trade Console' : 'Invest Vaults'}</span>
        </Button>
      </div>

      {/* Disconnect Button */}
      <Button
        type="button"
        variant="destructive"
        onClick={onDisconnectWallet}
        className="w-full h-11 justify-center gap-2 text-xs font-semibold mt-2"
      >
        <LogOut className="size-4" />
        <span>Disconnect Wallet</span>
      </Button>
    </div>
  )
}

export function MobileNav() {
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
  const [drawerType, setDrawerType] = useState<'menu' | 'profile' | null>(null)
  const [copied, setCopied] = useState(false)
  const [_searchOpen, setSearchOpen] = useState(false)

  const navigate = useNavigate()
  const location = useLocation()

  const isManager = useAppStore((s) => s.isManager)
  const setMode = useAppStore((s) => s.setMode)
  const currentUser = useAppStore((s) => s.currentUser)
  const setCurrentUser = useAppStore((s) => s.setCurrentUser)

  const { publicKey, connected, disconnect } = useWallet()

  const links = isManager ? managerLinks : investLinks
  const address = publicKey?.toBase58() || currentUser || ''
  const truncatedAddress = truncateAddress(address)

  // Primary action link based on mode
  const primaryVaultLink = isManager ? '/vaults' : '/invest'

  // Calculate active tab index (0: Dashboard, 1: Vaults/Invest, 2: Menu, 3: Profile)
  const activeIndex = getActiveIndex(location.pathname, drawerType)

  const handleNavClick = (path: string) => {
    setDrawerType(null)
    navigate({ to: path as never })
  }

  const handleModeSwitch = (managerMode: boolean) => {
    setMode(managerMode)
    if (!managerMode && location.pathname.startsWith('/trade')) {
      navigate({ to: '/invest' })
    }
  }

  const handleCopyAddress = async () => {
    if (!address) return
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      toastSuccess('Wallet address copied!')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleDisconnectWallet = async () => {
    try {
      if (connected) {
        await disconnect()
      }
      usePortfolioStore.getState().reset()
      useVaultStore.getState().reset()
      setCurrentUser(null)
      setDrawerType(null)
      toastInfo('Wallet disconnected')
    } catch (err) {
      console.error('Disconnect error:', err)
    }
  }

  return (
    <LazyMotion features={domAnimation}>
      {/* Mobile Floating Liquid-Glass Navigation Bar */}
      <div className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-[94%] max-w-sm px-1 pointer-events-auto">
        <div className="relative flex items-center justify-around bg-bg-surface/85 backdrop-blur-3xl shadow-[0_12px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.12)] rounded-full px-2 py-1.5 border border-white/10">
          
          {/* Item 1: Dashboard */}
          <m.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleNavClick('/')}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-medium transition-colors cursor-pointer rounded-full z-10",
              activeIndex === 0 ? "text-primary-gold" : "text-text-tertiary hover:text-text-primary"
            )}
          >
            <LayoutDashboard className="size-5 shrink-0" />
            <span className="text-[10px] mt-0.5 font-medium truncate tracking-tight">Home</span>
          </m.button>

          {/* Item 2: Vaults / Invest */}
          <m.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => handleNavClick(primaryVaultLink)}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-medium transition-colors cursor-pointer rounded-full z-10",
              activeIndex === 1 ? "text-primary-gold" : "text-text-tertiary hover:text-text-primary"
            )}
          >
            <Wallet className="size-5 shrink-0" />
            <span className="text-[10px] mt-0.5 font-medium truncate tracking-tight">
              {isManager ? 'Vaults' : 'Invest'}
            </span>
          </m.button>

          {/* Item 3: Menu Drawer */}
          <m.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setDrawerType((prev) => (prev === 'menu' ? null : 'menu'))}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-medium transition-colors cursor-pointer rounded-full z-10",
              activeIndex === 2 ? "text-primary-gold" : "text-text-tertiary hover:text-text-primary"
            )}
          >
            <Menu className="size-5 shrink-0" />
            <span className="text-[10px] mt-0.5 font-medium truncate tracking-tight">Menu</span>
          </m.button>

          {/* Item 4: Profile Drawer */}
          <m.button
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => setDrawerType((prev) => (prev === 'profile' ? null : 'profile'))}
            className={cn(
              "relative flex flex-col items-center justify-center flex-1 py-1.5 text-xs font-medium transition-colors cursor-pointer rounded-full z-10",
              activeIndex === 3 ? "text-primary-gold" : "text-text-tertiary hover:text-text-primary"
            )}
          >
            <div className="relative">
              <User className="size-5 shrink-0" />
              {address && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-status-success ring-2 ring-bg-surface" />
              )}
            </div>
            <span className="text-[10px] mt-0.5 font-medium truncate tracking-tight">Account</span>
          </m.button>

          {/* Sliding Liquid-Glass Active Highlight Pill */}
          {activeIndex >= 0 && (
            <m.div
              layout
              layoutId="mobile-nav-active-pill"
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              style={{
                left: `${activeIndex * 25}%`,
                width: '25%',
              }}
              className="absolute top-1 bottom-1 rounded-full bg-gradient-to-r from-primary-gold/20 to-primary-coral/20 border border-primary-gold/40 shadow-[0_0_20px_rgba(245,158,11,0.2)] pointer-events-none"
            />
          )}
        </div>
      </div>

      {/* Slide-Up Drawer Overlay & Sheet */}
      <AnimatePresence>
        {drawerType && mounted && typeof document !== 'undefined' && createPortal(
          <>
            <m.div
              key="mobile-nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerType(null)}
              className="md:hidden fixed inset-0 z-[199] bg-black/80 backdrop-blur-xl"
            />
            <m.div
              key="mobile-nav-sheet"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-[200] min-h-[60vh] max-h-[88vh] rounded-t-[32px] border-t border-white/20 bg-bg-surface/95 backdrop-blur-3xl p-5 shadow-[0_-16px_50px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.18)] flex flex-col overflow-hidden"
            >
              {/* Drawer Top Handle Pill */}
              <div className="w-10 h-1.25 rounded-full bg-border-medium/80 mx-auto mb-4 shrink-0" />

              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3.5 border-b border-border-subtle/80 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-xl bg-primary-gold/15 text-primary-gold border border-primary-gold/30">
                    {drawerType === 'menu' ? <SlidersHorizontal className="size-4" /> : <User className="size-4" />}
                  </div>
                  <div>
                    <h3 className="text-base font-bold tracking-tight text-text-primary">
                      {drawerType === 'menu' ? 'Navigation Menu' : 'Account & Wallet'}
                    </h3>
                    <p className="text-[11px] text-text-tertiary">
                      {drawerType === 'menu' ? 'Flux Protocol' : 'Connected Session'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto py-4 space-y-5">
                {drawerType === 'menu' ? (
                  <MobileMenuContent
                    currentUser={currentUser}
                    isManager={isManager}
                    links={links}
                    onModeSwitch={handleModeSwitch}
                    onClose={() => setDrawerType(null)}
                    onOpenSearch={() => setSearchOpen(true)}
                  />
                ) : (
                  <MobileProfileContent
                    address={address}
                    truncatedAddress={truncatedAddress}
                    isManager={isManager}
                    copied={copied}
                    onCopyAddress={handleCopyAddress}
                    onDisconnectWallet={handleDisconnectWallet}
                    onNavigate={handleNavClick}
                  />
                )}
              </div>
            </m.div>
          </>,
          document.body
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}
