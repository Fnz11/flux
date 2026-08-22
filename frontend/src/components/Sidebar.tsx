import { useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useAppStore } from '../stores/app-store'
import { toastInfo } from '@/lib/toast'
import { WalletConnectButton } from '@/components/ui/WalletConnectButton'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import { managerLinks, investLinks, campaignLinks } from '@/constants/navigation'

const handleComingSoon = (label: string) => {
  toastInfo(`${label} is on its way.`)
}

export function Sidebar() {
  const isManager = useAppStore((s) => s.isManager)
  const setMode = useAppStore((s) => s.setMode)
  const currentUser = useAppStore((s) => s.currentUser)
  const navigate = useNavigate()
  
  const [isCollapsed, setIsCollapsed] = useState(false)

  const links = isManager ? managerLinks : investLinks
  const managerActive = isManager
  const investActive = !isManager

  const handleModeSwitch = (managerMode: boolean) => {
    setMode(managerMode)
    navigate({ to: '/' })
  }

  return (
    <aside 
      className={cn(
        "z-50 hidden md:flex flex-col border-r border-border-subtle/80 bg-bg-surface/60 backdrop-blur-3xl shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_-1px_0_0_rgba(255,255,255,0.03)] overflow-y-auto transition-all duration-300 shrink-0",
        isCollapsed ? "w-16" : "w-50"
      )}
    >
      <div className={cn("flex h-16 items-center justify-between", isCollapsed ? "px-0 justify-center" : "px-2")}>
        <Link to="/" className="flex items-center gap-2.5">
          <div className={cn("flex items-center justify-center shrink-0", isCollapsed ? "size-6" : "size-8")}>
            <img src="/logo.png" alt="Flux Logo" className="w-full h-full object-contain" />
          </div>
          {!isCollapsed && <span className="text-lg font-bold tracking-tight text-text-primary">Flux</span>}
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
        <div className="px-3 py-2 w-full">
          <WalletConnectButton />
        </div>
      )}

      <nav className={cn("flex-1 space-y-6 py-4", isCollapsed ? "px-2" : "px-2")}>
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
                  isCollapsed ? "justify-center size-9" : "gap-3 px-2 py-1.5 text-[13px] mx-2"
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
              <button
                key={link.label}
                type="button"
                onClick={() => handleComingSoon(link.label)}
                className={cn(
                  "flex items-center text-text-tertiary hover:text-text-primary transition-colors cursor-pointer rounded-lg",
                  isCollapsed ? "justify-center size-9" : "gap-3 px-3 py-1.5 text-[13px] mx-2"
                )}
              >
                <link.icon className="size-4 shrink-0" />
                {!isCollapsed && link.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {currentUser && (
        <div className={cn("mt-auto border-t border-white/10", isCollapsed ? "p-1" : "p-4")}>
          {!isCollapsed ? (
            <div>
              <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-text-muted">App Mode</p>
              <div className="flex overflow-hidden rounded-xl border border-border-medium bg-bg-inset/50 p-1 backdrop-blur-sm">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleModeSwitch(true)}
                  className={cn(
                    'h-7 flex-1 text-[11px] font-semibold transition-all',
                    managerActive
                      ? 'bg-gradient-to-r from-primary-coral to-primary-amber text-white shadow-sm shadow-primary-coral/20 font-bold hover:brightness-110'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-transparent'
                  )}
                >
                  Manager
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleModeSwitch(false)}
                  className={cn(
                    'h-7 flex-1 text-[11px] font-semibold transition-all',
                    investActive
                      ? 'bg-gradient-to-r from-primary-coral to-primary-amber text-white shadow-sm shadow-primary-coral/20 font-bold hover:brightness-110'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-transparent'
                  )}
                >
                  Invest
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2 items-center py-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleModeSwitch(true)}
                className={cn('size-8 rounded-full transition-all', managerActive ? 'bg-gradient-to-r from-primary-coral to-primary-amber text-white shadow-sm font-bold hover:brightness-110' : 'text-text-tertiary')}
                title="Manager Mode"
              >
                M
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleModeSwitch(false)}
                className={cn('size-8 rounded-full transition-all', investActive ? 'bg-gradient-to-r from-primary-coral to-primary-amber text-white shadow-sm font-bold hover:brightness-110' : 'text-text-tertiary')}
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
