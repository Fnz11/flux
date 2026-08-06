import { useState } from 'react'
import { Link, useNavigate, useLocation } from '@tanstack/react-router'
import { LayoutDashboard, Wallet, LineChart, HandCoins, ArrowRightLeft, Gift, BookOpen, Medal, ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { WalletConnectButton } from '@/components/ui/WalletConnectButton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const managerLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/vaults', label: 'Vaults', icon: Wallet },
  { to: '/payout', label: 'Payout', icon: HandCoins },
  { to: '/trade', label: 'Trade', icon: ArrowRightLeft },
] as const

const investLinks = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/invest', label: 'Invest', icon: HandCoins },
  { to: '/portfolio', label: 'Portfolio', icon: LineChart },
] as const

const campaignLinks = [
  { to: '#', label: 'Learn & earn', icon: BookOpen },
  { to: '#', label: 'Airdrops', icon: Gift },
  { to: '#', label: 'Rewards', icon: Medal },
] as const

export function Sidebar() {
  const isManager = useAppStore((s) => s.isManager)
  const setMode = useAppStore((s) => s.setMode)
  const currentUser = useAppStore((s) => s.currentUser)
  const navigate = useNavigate()
  const location = useLocation()
  
  const [isCollapsed, setIsCollapsed] = useState(false)

  const links = isManager ? managerLinks : investLinks
  const managerActive = isManager
  const investActive = !isManager

  const handleModeSwitch = (managerMode: boolean) => {
    setMode(managerMode)
    if (!managerMode && location.pathname.startsWith('/trade')) {
      navigate({ to: '/invest' })
    }
  }

  return (
    <aside 
      className={cn(
        "z-50 flex flex-col border-r border-border-subtle bg-bg-surface/60 backdrop-blur-3xl overflow-y-auto transition-all duration-300 shrink-0",
        isCollapsed ? "w-16" : "w-60"
      )}
    >
      <div className={cn("flex h-16 items-center justify-between", isCollapsed ? "px-0 justify-center" : "px-5")}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className={cn("flex items-center justify-center shrink-0", isCollapsed ? "size-6" : "size-8")}>
            <img src="/logo.png" alt="FBYT Logo" className="w-full h-full object-contain" />
          </div>
          {!isCollapsed && <span className="text-lg font-bold tracking-tight text-text-primary">FBYT</span>}
        </Link>
        {!isCollapsed && (
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(true)} className="size-6 text-text-tertiary hover:text-text-primary">
            <ChevronLeft className="size-4" />
          </Button>
        )}
      </div>
      
      {isCollapsed && (
        <div className="flex justify-center pb-2">
          <Button variant="ghost" size="icon" onClick={() => setIsCollapsed(false)} className="size-6 text-text-tertiary hover:text-text-primary">
            <ChevronRight className="size-4" />
          </Button>
        </div>
      )}

      {!isCollapsed && (
        <div className="px-6 py-2">
          <WalletConnectButton />
        </div>
      )}

      <nav className={cn("flex-1 space-y-6 py-4", isCollapsed ? "px-2" : "px-4")}>
        <div>
          {!isCollapsed && (
            <h3 className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-text-muted">
              Main Menu
            </h3>
          )}
          <div className={cn("space-y-0.5", isCollapsed && "flex flex-col items-center")}>
            {links.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                activeProps={{ className: 'bg-bg-elevated text-text-primary shadow-sm border border-border-subtle/50' }}
                inactiveProps={{ className: 'text-text-tertiary hover:text-text-primary border border-transparent' }}
                className={cn(
                  "flex items-center rounded-lg transition-all",
                  isCollapsed ? "justify-center size-9" : "gap-3 px-3 py-2 text-[13px] mx-2"
                )}
                title={isCollapsed ? link.label : undefined}
              >
                <link.icon className="size-4 shrink-0" />
                {!isCollapsed && link.label}
              </Link>
            ))}
          </div>
        </div>

        <div>
          {!isCollapsed && (
            <h3 className="mb-2 px-3 text-[11px] font-medium uppercase tracking-wider text-text-muted">
              Campaign
            </h3>
          )}
          <div className={cn("space-y-0.5", isCollapsed && "flex flex-col items-center")}>
            {campaignLinks.map((link) => (
              <a
                key={link.label}
                href={link.to}
                className={cn(
                  "flex items-center text-text-tertiary hover:text-text-primary transition-colors cursor-not-allowed opacity-70 rounded-lg",
                  isCollapsed ? "justify-center size-9" : "gap-3 px-3 py-2 text-[13px] mx-2"
                )}
                title={`Coming Soon: ${link.label}`}
              >
                <link.icon className="size-4 shrink-0" />
                {!isCollapsed && link.label}
              </a>
            ))}
          </div>
        </div>
      </nav>

      {currentUser && (
        <div className={cn("mt-auto border-t border-border-subtle", isCollapsed ? "p-1" : "p-4")}>
          {!isCollapsed ? (
            <div>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">App Mode</p>
              <div className="flex overflow-hidden rounded-xl border border-border-medium bg-bg-inset/50 p-1 backdrop-blur-sm">
                <Button
                  variant={managerActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleModeSwitch(true)}
                  className={cn('h-7 flex-1 text-[11px]', managerActive ? 'shadow-sm text-text-primary bg-bg-elevated' : 'text-text-tertiary hover:text-text-secondary')}
                >
                  Manager
                </Button>
                <Button
                  variant={investActive ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => handleModeSwitch(false)}
                  className={cn('h-7 flex-1 text-[11px]', investActive ? 'bg-primary-gold hover:bg-primary-gold/90 shadow-sm text-black' : 'text-text-tertiary hover:text-text-secondary')}
                >
                  Invest
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 items-center py-2">
              <Button
                variant={managerActive ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleModeSwitch(true)}
                className={cn('size-8 rounded-full', managerActive ? 'bg-bg-elevated text-text-primary' : 'text-text-tertiary')}
                title="Manager Mode"
              >
                M
              </Button>
              <Button
                variant={investActive ? 'default' : 'ghost'}
                size="icon"
                onClick={() => handleModeSwitch(false)}
                className={cn('size-8 rounded-full', investActive ? 'bg-primary-gold text-black' : 'text-text-tertiary')}
                title="Invest Mode"
              >
                I
              </Button>
            </div>
          )}
        </div>
      )}
    </aside>
  )
}
