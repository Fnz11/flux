import { useState } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { Menu, X } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { Button } from '@/components/ui/button'
import { WalletConnectButton } from '@/components/ui/WalletConnectButton'
import { cn } from '@/lib/utils'

const managerLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/vaults', label: 'Vaults' },
  { to: '/payout', label: 'Payout' },
  { to: '/trade', label: 'Trade' },
] as const

const investLinks = [
  { to: '/', label: 'Dashboard' },
  { to: '/invest', label: 'Invest' },
  { to: '/portfolio', label: 'Portfolio' },
] as const

export function NavBar() {
  const isManager = useAppStore((s) => s.isManager)
  const setMode = useAppStore((s) => s.setMode)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const links = isManager ? managerLinks : investLinks
  const managerActive = isManager
  const investActive = !isManager

  const closeMenu = () => setMobileMenuOpen(false)

  const handleModeSwitch = (managerMode: boolean) => {
    setMode(managerMode)
    if (!managerMode && location.pathname.startsWith('/trade')) {
      navigate({ to: '/invest' })
    }
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-12 items-center border-b border-border-subtle bg-bg-surface/80 backdrop-blur-xl">
      <div className="container-main flex w-full items-center justify-between">
        <Link to="/" onClick={closeMenu} className="flex items-center gap-1.5">
          <div className="flex size-6 items-center justify-center rounded bg-gradient-to-r from-primary-coral to-primary-gold">
            <span className="text-[10px] font-bold text-black">F</span>
          </div>
          <span className="text-sm font-semibold tracking-tight text-text-primary">FBYT</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-0.5 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeProps={{ className: 'bg-bg-elevated text-text-primary font-medium' }}
              inactiveProps={{ className: 'text-text-tertiary hover:text-text-primary hover:bg-bg-elevated/60' }}
              className="rounded-xl px-2 py-1 text-[11px] font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        {/* Desktop & Mobile Wallet + Mode Controls */}
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex overflow-hidden rounded-xl border border-border-medium bg-bg-inset p-0.5">
            <Button
              variant={managerActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleModeSwitch(true)}
              className={cn('h-6 px-2 text-[10px]', managerActive ? 'shadow-sm' : '')}
            >
              Manager
            </Button>
            <Button
              variant={investActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => handleModeSwitch(false)}
              className={cn('h-6 px-2 text-[10px]', investActive ? 'bg-primary-gold hover:bg-primary-gold/90 shadow-sm' : '')}
            >
              Invest
            </Button>
          </div>

          <WalletConnectButton />

          {/* Mobile hamburger button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="size-7 md:hidden text-text-secondary hover:text-text-primary"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </Button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-x-0 top-16 z-40 border-b border-border-medium bg-bg-surface/95 p-4 backdrop-blur-2xl md:hidden animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between pb-2 border-b border-border-subtle sm:hidden">
              <span className="text-xs text-text-tertiary font-medium">Mode:</span>
              <div className="flex overflow-hidden rounded-xl border border-border-medium bg-bg-inset p-0.5">
                <Button
                  variant={managerActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    handleModeSwitch(true)
                    closeMenu()
                  }}
                  className={managerActive ? 'shadow-sm text-xs' : 'text-xs'}
                >
                  Manager
                </Button>
                <Button
                  variant={investActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => {
                    handleModeSwitch(false)
                    closeMenu()
                  }}
                  className={investActive ? 'bg-primary-gold hover:bg-primary-gold/90 shadow-sm text-xs' : 'text-xs'}
                >
                  Invest
                </Button>
              </div>
            </div>

            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  onClick={closeMenu}
                  activeProps={{ className: 'bg-bg-elevated text-text-primary font-semibold' }}
                  inactiveProps={{ className: 'text-text-tertiary hover:text-text-primary hover:bg-bg-elevated' }}
                  className="rounded-xl px-4 py-3 text-base font-medium transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  )
}
