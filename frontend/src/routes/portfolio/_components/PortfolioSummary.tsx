import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { Wallet, TrendingUp, Sparkles, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app-store'
import { Card } from '@/components/ui/card'

export function PortfolioSummary() {
  const { totalInvested, totalValue, totalPnl, totalPnlPercent } = usePortfolioPnl()
  const setMode = useAppStore((s) => s.setMode)
  const navigate = useNavigate()

  // Format balance string into integer and fraction parts
  const formattedValue = totalValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [valInt, valDec] = formattedValue.split('.')

  const handleBecomeManager = () => {
    setMode(true)
    navigate({ to: '/' })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-12 items-stretch">
      {/* 1. Account Balance Card (Col-span 5) */}
      <Card className="lg:col-span-5 relative flex flex-col justify-between overflow-hidden p-5">
        {/* Card Header & Action Pills */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            <Wallet className="size-4 text-primary-coral" />
            <span>Account balance</span>
          </div>

          <div className="flex items-center gap-1.5">
            <Link to="/vaults">
              <button
                type="button"
                className="rounded-full bg-gradient-to-r from-primary-coral to-primary-amber px-3 py-1 text-xs font-bold text-black shadow-md hover:brightness-110 transition-[filter] cursor-pointer"
              >
                Deposit
              </button>
            </Link>
            <Link to="/payout">
              <button
                type="button"
                className="rounded-full border border-border-medium bg-bg-inset px-3 py-1 text-xs font-medium text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                Withdraw
              </button>
            </Link>
          </div>
        </div>

        {/* Big Balance Metric */}
        <div className="mt-4">
          <div className="flex items-baseline">
            <span className="text-4xl font-bold tracking-tight text-text-primary">
              ${valInt}
            </span>
            <span className="text-2xl font-semibold text-text-tertiary">.{valDec}</span>
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
              <ArrowUpRight className="size-3.5" />
              +28.32%
            </span>
            <span className="text-xs text-text-tertiary">Compare to last month</span>
          </div>
        </div>
      </Card>

      {/* 2. Profit & Losses Card (Col-span 4) */}
      <Card className="lg:col-span-4 relative flex flex-col justify-between overflow-hidden p-5">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            <div className="flex items-center gap-2">
              <TrendingUp className="size-4 text-emerald-400" />
              <span>Profit and losses</span>
            </div>
            <span className="text-[10px] text-text-muted">Today's PnL</span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-text-primary">
              ${totalPnl >= 0 ? '+' : ''}{totalPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold',
                totalPnlPercent >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400',
              )}
            >
              {totalPnlPercent >= 0 ? '▲' : '▼'} {Math.abs(totalPnlPercent).toFixed(2)}%
            </span>
            <span className="text-xs font-medium text-emerald-400">+$568.90</span>
          </div>
        </div>

        {/* Embedded Green Area Sparkline Graph */}
        <div className="mt-3 h-14 w-full">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10B981" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 35 C 15 32, 25 38, 40 22 C 55 8, 65 25, 80 10 C 90 2, 95 12, 100 5 L 100 40 L 0 40 Z"
              fill="url(#pnlGrad)"
            />
            <path
              d="M 0 35 C 15 32, 25 38, 40 22 C 55 8, 65 25, 80 10 C 90 2, 95 12, 100 5"
              fill="none"
              stroke="#10B981"
              strokeWidth="2.5"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </Card>

      {/* 3. Become a Manager Card (Col-span 3) */}
      <Card className="lg:col-span-3 relative flex flex-col justify-between overflow-hidden border-primary-coral/30 bg-gradient-to-br from-bg-elevated via-bg-elevated to-primary-coral/10 p-5">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-primary-coral">
            <Sparkles className="size-4" />
            <span>MANAGER ACCESS</span>
          </div>
          <h4 className="mt-2 text-sm font-bold leading-snug text-text-primary">
            Become a Manager
          </h4>
          <p className="mt-1 text-xs text-text-tertiary leading-relaxed">
            Create & manage your own vaults to earn performance & management fees.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-start gap-2">
          <button
            type="button"
            onClick={handleBecomeManager}
            className="rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-md hover:bg-neutral-200 transition-colors cursor-pointer"
          >
            Become a manager
          </button>
        </div>
      </Card>
    </div>
  )
}
