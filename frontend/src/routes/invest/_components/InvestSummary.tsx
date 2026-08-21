import { Wallet, Coins, TrendingUp, TrendingDown, ArrowUpRight } from 'lucide-react'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { usePortfolioHistoryQuery } from '@/services/hooks/useQuery/usePortfolioHistoryQuery'
import { useWallet } from '@solana/wallet-adapter-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

function formatNum(num: number) {
  const absNum = Math.abs(num)
  const str = absNum.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const [intPart, decPart] = str.split('.')
  return { intPart, decPart }
}

export function InvestSummary() {
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58()
  const { totalInvested, totalValue, totalPnl, totalPnlPercent } = usePortfolioPnl(walletAddress)
  const { data: history = [] } = usePortfolioHistoryQuery(walletAddress ?? '')

  const historyValues = history.reduce<number[]>((acc, point) => {
    const val = Number(point.value)
    if (!Number.isNaN(val)) acc.push(val)
    return acc
  }, [])
  const hasHistory = historyValues.length > 1

  const historyMin = Math.min(...historyValues)
  const historyMax = Math.max(...historyValues)
  const historyRange = historyMax - historyMin || 1
  const historyLine = historyValues
    .map((val, idx) => {
      const x = (idx / Math.max(historyValues.length - 1, 1)) * 100
      const y = 32 - ((val - historyMin) / historyRange) * 24 - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const invested = formatNum(totalInvested)
  const val = formatNum(totalValue)
  const pnl = formatNum(totalPnl)
  const isPositivePnl = totalPnl >= 0

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
      {/* 1. Total Invested Card */}
      <Card className="relative flex flex-col justify-between overflow-hidden p-5 group hover:border-primary-coral/40 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary-coral/10 text-primary-coral border border-primary-coral/20">
              <Wallet className="size-3.5" />
            </div>
            <span>Total Invested</span>
          </div>
          <Badge variant="coral" className="text-[10px]">
            Active Capital
          </Badge>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline">
            <span className="text-3xl font-bold tracking-tight text-text-primary">
              ${invested.intPart}
            </span>
            <span className="text-xl font-semibold text-text-tertiary">.{invested.decPart}</span>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">Principal deposited across Solana vaults</p>
        </div>
      </Card>

      {/* 2. Portfolio Value Card */}
      <Card className="relative flex flex-col justify-between overflow-hidden p-5 group hover:border-primary-gold/40 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary-gold/10 text-primary-gold border border-primary-gold/20">
              <Coins className="size-3.5" />
            </div>
            <span>Portfolio Value</span>
          </div>
          <Badge variant="gold" className="text-[10px]">
            Live NAV
          </Badge>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline">
            <span className="text-3xl font-bold tracking-tight text-text-primary">
              ${val.intPart}
            </span>
            <span className="text-xl font-semibold text-text-tertiary">.{val.decPart}</span>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">Real-time vault share valuation</p>
        </div>
      </Card>

      {/* 3. Net Profit / Loss Card */}
      <Card
        className={cn(
          'relative flex flex-col justify-between overflow-hidden p-5 transition-colors',
          isPositivePnl ? 'hover:border-status-success/40' : 'hover:border-status-error/40',
        )}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
            <div
              className={cn(
                'flex size-7 items-center justify-center rounded-lg border',
                isPositivePnl
                  ? 'bg-status-success/10 text-status-success border-status-success/20'
                  : 'bg-status-error/10 text-status-error border-status-error/20',
              )}
            >
              {isPositivePnl ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            </div>
            <span>Net Profit / Loss</span>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold border font-mono',
              isPositivePnl
                ? 'bg-status-success/15 text-status-success border-status-success/30'
                : 'bg-status-error/15 text-status-error border-status-error/30',
            )}
          >
            {isPositivePnl ? <ArrowUpRight className="size-3" /> : '▼'}
            {isPositivePnl ? '+' : ''}{Math.abs(totalPnlPercent).toFixed(2)}%
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline">
            <span className={cn('text-3xl font-bold tracking-tight', isPositivePnl ? 'text-status-success' : 'text-status-error')}>
              {isPositivePnl ? '+' : '-'}${pnl.intPart}
            </span>
            <span className={cn('text-xl font-semibold', isPositivePnl ? 'text-status-success' : 'text-status-error')}>.{pnl.decPart}</span>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">All-time yield earnings</p>
        </div>

        {/* Embedded Sparkline Graph with Smooth Curve & Gradient */}
        <div className="mt-3 h-8 w-full overflow-hidden opacity-60">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 100 32" preserveAspectRatio="none">
            <defs>
              <linearGradient id="investPnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositivePnl ? '#00E676' : '#FF334B'} stopOpacity={0.4} />
                <stop offset="100%" stopColor={isPositivePnl ? '#00E676' : '#FF334B'} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            {hasHistory ? (
              <>
                <polygon
                  points={`0,32 ${historyLine} 100,32`}
                  fill="url(#investPnlGrad)"
                />
                <polyline
                  points={historyLine}
                  fill="none"
                  stroke={isPositivePnl ? '#00E676' : '#FF334B'}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </>
            ) : (
              <line x1="0" y1="16" x2="100" y2="16" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="3 3" />
            )}
          </svg>
        </div>
      </Card>
    </div>
  )
}
