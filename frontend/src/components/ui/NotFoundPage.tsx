import { Link, useNavigate } from '@tanstack/react-router'
import { Compass, ArrowLeft, Home, Sparkles, Trophy, ArrowDownUp } from 'lucide-react'
import { SweepButton } from './SweepButton'
import { Button } from './button'

export function NotFoundPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-4">
      <div className="mx-auto flex max-w-xl w-full flex-col items-center justify-center rounded-2xl border border-border-subtle bg-bg-elevated/80 p-8 text-center shadow-2xl backdrop-blur-2xl space-y-6 relative overflow-hidden">
        {/* Ambient Gradient Background Glow */}
        <div className="absolute -top-20 -right-20 size-56 rounded-full bg-primary-coral/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 size-56 rounded-full bg-primary-gold/10 blur-3xl pointer-events-none" />

        {/* Floating Compass Badge */}
        <div className="flex size-16 items-center justify-center rounded-full bg-primary-coral/10 text-primary-coral border border-primary-coral/20 shadow-lg shadow-primary-coral/10">
          <Compass className="size-8 animate-pulse" />
        </div>

        {/* 404 Hero Number & Titles */}
        <div>
          <h1 className="text-7xl font-extrabold tracking-tighter bg-gradient-to-r from-primary-coral via-primary-gold to-emerald-400 bg-clip-text text-transparent font-mono">
            404
          </h1>
          <h2 className="mt-2 text-xl font-bold tracking-tight text-text-primary">
            Page Not Found
          </h2>
          <p className="mt-1.5 text-xs text-text-tertiary leading-relaxed max-w-sm mx-auto">
            The page, vault position, or route you are looking for doesn't exist, has been relocated, or is private.
          </p>
        </div>

        {/* Quick Navigation Cards */}
        <div className="grid grid-cols-3 gap-3 w-full pt-1">
          <Link
            to="/portfolio"
            className="flex flex-col items-center justify-center rounded-xl border border-border-subtle/80 bg-bg-inset/60 p-3 hover:border-primary-coral/40 hover:bg-bg-inset transition-colors group cursor-pointer"
          >
            <Sparkles className="size-4 text-primary-coral mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-text-primary">Dashboard</span>
            <span className="text-[10px] text-text-tertiary">Portfolio PnL</span>
          </Link>

          <Link
            to="/invest"
            className="flex flex-col items-center justify-center rounded-xl border border-border-subtle/80 bg-bg-inset/60 p-3 hover:border-primary-gold/40 hover:bg-bg-inset transition-colors group cursor-pointer"
          >
            <Trophy className="size-4 text-primary-gold mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-text-primary">Invest</span>
            <span className="text-[10px] text-text-tertiary">Top Vaults</span>
          </Link>

          <Link
            to="/trade"
            className="flex flex-col items-center justify-center rounded-xl border border-border-subtle/80 bg-bg-inset/60 p-3 hover:border-emerald-400/40 hover:bg-bg-inset transition-colors group cursor-pointer"
          >
            <ArrowDownUp className="size-4 text-emerald-400 mb-1 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-bold text-text-primary">Trade</span>
            <span className="text-[10px] text-text-tertiary">AMM Swaps</span>
          </Link>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 w-full">
          <Link to="/">
            <SweepButton icon={<Home className="size-4" />} className="h-10 text-xs font-bold">
              Return Home
            </SweepButton>
          </Link>
          <Button
            variant="outline"
            onClick={() => navigate({ to: '..' })}
            className="h-10 px-5 text-xs font-semibold text-text-secondary hover:text-text-primary border-border-medium bg-bg-inset gap-2 cursor-pointer"
          >
            <ArrowLeft className="size-4" />
            Go Back
          </Button>
        </div>
      </div>
    </div>
  )
}
