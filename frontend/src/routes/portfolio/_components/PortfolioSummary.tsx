import { useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { usePortfolioHistoryQuery } from '@/services/hooks/useQuery/usePortfolioHistoryQuery'
import { Wallet, TrendingUp, Sparkles, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app-store'
import { Card } from '@/components/ui/card'

const SPARK_W = 100
const SPARK_H = 40

export function PortfolioSummary() {
  const { totalValue, totalPnl, totalPnlPercent } = usePortfolioPnl()
  const setMode = useAppStore((s) => s.setMode)
  const navigate = useNavigate()

  const { publicKey } = useWallet()
  const walletAddress = publicKey?.toBase58() ?? ''
  const { data: historyPoints = [] } = usePortfolioHistoryQuery(walletAddress)

  const change = useMemo(() => {
    if (historyPoints.length < 2) {
      return { pct: 0, delta: 0, hasData: false }
    }
    const first = historyPoints[0].value
    const last = historyPoints[historyPoints.length - 1].value
    const pct = first !== 0 ? ((last - first) / first) * 100 : 0
    return { pct, delta: last - first, hasData: true }
  }, [historyPoints])

  const positive = change.delta >= 0
  const values = historyPoints.map((p) => p.value)
  const min = values.length ? Math.min(...values) : 0
  const max = values.length ? Math.max(...values) : 0
  const range = max - min || 1

  const sparkPoints = values.length > 1
    ? values.map((v, i) => {
        const x = (i / (values.length - 1)) * SPARK_W
        const y = SPARK_H - 4 - ((v - min) / range) * (SPARK_H - 8)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
    : []

  const sparkLine = sparkPoints.length ? `M 0 ${SPARK_H} L ${sparkPoints.join(' L ')} L ${SPARK_W} ${SPARK_H} Z` : ''
  const sparkPath = sparkPoints.length ? `M ${sparkPoints.join(' L ')}` : ''
  const strokeColor = positive ? '#10B981' : '#EF4444'

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
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold',
                change.hasData
                  ? positive
                    ? 'bg-emerald-500/15 text-emerald-400'
                    : 'bg-rose-500/15 text-rose-400'
                  : 'bg-bg-inset text-text-muted',
              )}
            >
              {change.hasData && positive && <ArrowUpRight className="size-3.5" />}
              {change.hasData ? `${change.pct >= 0 ? '+' : ''}${change.pct.toFixed(2)}%` : '--'}
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
            <span
              className={cn(
                'text-xs font-medium',
                change.hasData
                  ? positive
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                  : 'text-text-muted',
              )}
            >
              {change.hasData
                ? `${change.delta >= 0 ? '+' : ''}$${change.delta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : '$0.00'}
            </span>
          </div>
        </div>

        {/* Embedded Green Area Sparkline Graph */}
        <div className="mt-3 h-14 w-full">
          <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity="0.4" />
                <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            {sparkLine && (
              <path
                d={sparkLine}
                fill="url(#pnlGrad)"
              />
            )}
            {sparkPath && (
              <path
                d={sparkPath}
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            )}
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
            Create &amp; manage your own vaults to earn performance &amp; management fees.
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