import { Link } from '@tanstack/react-router'
import { useAppStore } from '../stores/app-store'
import { Button } from '@/components/ui/button'

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
  const links = isManager ? managerLinks : investLinks
  const managerActive = isManager
  const investActive = !isManager

  return (
    <header className="fixed top-0 left-0 right-0 z-50 flex h-16 items-center border-b border-border-subtle bg-bg-surface/80 backdrop-blur-xl">
      <div className="container-main flex w-full items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex size-8 items-center justify-center rounded-[5px] bg-gradient-to-r from-primary-coral to-primary-gold">
            <span className="text-xs font-bold text-black">F</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-text-primary">FBYT</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              activeProps={{ className: 'bg-bg-elevated text-text-primary' }}
              inactiveProps={{ className: 'text-text-tertiary hover:text-text-primary hover:bg-bg-elevated' }}
              className="rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-border-medium bg-bg-inset p-0.5">
            <Button
              variant={managerActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode(true)}
              className={managerActive ? 'shadow-sm' : ''}
            >
              Manager
            </Button>
            <Button
              variant={investActive ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setMode(false)}
              className={investActive ? 'bg-primary-gold hover:bg-primary-gold/90 shadow-sm' : ''}
            >
              Invest
            </Button>
          </div>
          <div className="flex size-8 items-center justify-center rounded-full bg-bg-inset text-xs font-medium text-text-tertiary">
            U
          </div>
        </div>
      </div>
    </header>
  )
}
