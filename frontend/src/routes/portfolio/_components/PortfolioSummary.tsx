import { useMemo, useState, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { usePortfolioHistoryQuery } from '@/services/hooks/useQuery/usePortfolioHistoryQuery'
import { Wallet, TrendingUp, Sparkles, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Link, useNavigate } from '@tanstack/react-router'
import { useAppStore } from '@/stores/app-store'
import { Card } from '@/components/ui/card'
import { formatCurrencyParts } from '@/lib/format'

const SPARK_W = 100
const SPARK_H = 40

export function PortfolioSummary() {
  const { totalValue, totalPnl, totalPnlPercent } = usePortfolioPnl()
  const setMode = useAppStore((s) => s.setMode)
  const navigate = useNavigate()

  const { publicKey } = useWallet()
  const walletAddress = publicKey?.toBase58() ?? ''
  const { data: historyPoints = [] } = usePortfolioHistoryQuery(walletAddress)

  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const change = useMemo(() => {
    if (!historyPoints || historyPoints.length < 2) {
      return { pct: 0, delta: 0, hasData: false }
    }
    const first = historyPoints[0]?.value ?? 0
    const last = historyPoints[historyPoints.length - 1]?.value ?? 0
    const delta = last - first
    let pct = 0
    if (Math.abs(first) > 0.001) {
      pct = (delta / Math.abs(first)) * 100
    } else {
      const previousBalance = totalValue - delta
      if (previousBalance > 0) {
        pct = (delta / previousBalance) * 100
      } else if (totalValue > 0) {
        pct = delta >= 0 ? 100 : -100
      }
    }
    if (!Number.isFinite(pct) || isNaN(pct)) {
      pct = 0
    }
    return { pct, delta, hasData: true }
  }, [historyPoints, totalValue])

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
  const strokeColor = totalPnl >= 0 ? '#10B981' : '#EF4444'

  // Format balance and PnL string parts
  const balanceParts = formatCurrencyParts(totalValue)
  const pnlParts = formatCurrencyParts(totalPnl, { showSign: true })

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || historyPoints.length < 2) return
    const rect = containerRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, x / rect.width))
    const index = Math.round(pct * (historyPoints.length - 1))
    setHoverIndex(index)
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  const hoveredPoint = hoverIndex !== null ? historyPoints[hoverIndex] : null
  const hoveredPct = hoverIndex !== null && historyPoints.length > 1
    ? (hoverIndex / (historyPoints.length - 1)) * 100
    : null
  const hoveredYPct = hoverIndex !== null && hoveredPoint && values.length > 1
    ? ((SPARK_H - 4 - ((hoveredPoint.value - min) / range) * (SPARK_H - 8)) / SPARK_H) * 100
    : null

  const formattedDate = useMemo(() => {
    if (!hoveredPoint?.date) return ''
    try {
      const d = new Date(hoveredPoint.date)
      if (isNaN(d.getTime())) return hoveredPoint.date
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    } catch {
      return hoveredPoint.date
    }
  }, [hoveredPoint])

  const formattedHoverValue = useMemo(() => {
    if (!hoveredPoint) return ''
    const n = Number(hoveredPoint.value)
    if (!Number.isFinite(n)) return String(hoveredPoint.value)
    return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }, [hoveredPoint])

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
                className="rounded-lg border border-border-subtle bg-bg-inset px-2.5 py-1 text-xs font-semibold text-text-primary hover:border-primary-coral/40 transition-colors cursor-pointer"
              >
                Deposit
              </button>
            </Link>
            <button
              type="button"
              onClick={handleBecomeManager}
              className="inline-flex items-center gap-1 rounded-lg border border-primary-coral/30 bg-primary-coral/10 px-2.5 py-1 text-xs font-semibold text-primary-coral hover:bg-primary-coral/20 transition-colors cursor-pointer"
            >
              <Sparkles className="size-3" />
              <span>Become a manager</span>
            </button>
          </div>
        </div>

        {/* Balance Display with Split Sub-Units */}
        <div className="mt-4">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-bold tracking-tight text-text-primary">
              {balanceParts.symbol}{balanceParts.integer}
            </span>
            <span className="text-xl font-bold text-text-tertiary">
              .{balanceParts.fraction}
            </span>
          </div>

          {/* 30D Comparison Indicator */}
          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold',
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
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-text-primary">
              {pnlParts.full}
            </span>
          </div>

          <div className="mt-1.5 flex items-center gap-2">
            <span
              className={cn(
                'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold',
                totalPnl >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400',
              )}
            >
              {totalPnl >= 0 ? '▲' : '▼'} {Math.abs(totalPnlPercent).toFixed(2)}%
            </span>
            <span className="text-xs text-text-tertiary">All-Time</span>
          </div>
        </div>

        {/* Embedded Interactive Area Sparkline Graph */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="relative mt-3 h-14 w-full cursor-crosshair group select-none"
        >
          {hoveredPoint && hoveredPct !== null && (
            <>
              {/* Floating Tooltip Box */}
              <div
                className="absolute -top-9 z-30 rounded-lg border border-border-medium bg-bg-elevated/95 px-2.5 py-1 text-xs shadow-2xl backdrop-blur-md pointer-events-none whitespace-nowrap transition-[left,transform]"
                style={{
                  left: `${hoveredPct}%`,
                  transform:
                    hoveredPct > 70
                      ? 'translateX(-92%)'
                      : hoveredPct < 25
                        ? 'translateX(-8%)'
                        : 'translateX(-50%)',
                }}
              >
                <div className="flex items-center gap-1.5 font-mono">
                  <span className="text-[10px] text-text-tertiary font-sans">{formattedDate}</span>
                  <span className="font-bold text-text-primary text-xs">${formattedHoverValue}</span>
                </div>
              </div>

              {/* Vertical Guide Line */}
              <div
                className="absolute top-0 bottom-0 z-10 w-px border-l border-dashed border-white/20 pointer-events-none"
                style={{ left: `${hoveredPct}%` }}
              />

              {/* Perfectly round Dot indicator */}
              {hoveredYPct !== null && (
                <div
                  className="absolute z-20 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-bg-surface shadow-md pointer-events-none transition-transform"
                  style={{
                    left: `${hoveredPct}%`,
                    top: `${hoveredYPct}%`,
                    backgroundColor: strokeColor,
                  }}
                />
              )}
            </>
          )}

          <svg className="h-full w-full overflow-visible pointer-events-none" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={strokeColor} stopOpacity={0.4} />
                <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
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