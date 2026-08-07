import { Wallet, Coins, TrendingUp, ArrowUpRight } from 'lucide-react'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { useWallet } from '@solana/wallet-adapter-react'
import { cn } from '@/lib/utils'
import { Card } from '@/components/ui/card'

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
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-coral/10 px-2.5 py-0.5 text-[10px] font-bold text-primary-coral border border-primary-coral/20">
            Active Capital
          </span>
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
          <span className="inline-flex items-center gap-1 rounded-full bg-primary-gold/10 px-2.5 py-0.5 text-[10px] font-bold text-primary-gold border border-primary-gold/20">
            Live NAV
          </span>
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
      <Card className="relative flex flex-col justify-between overflow-hidden p-5 group hover:border-emerald-500/40 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-tertiary">
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <TrendingUp className="size-3.5" />
            </div>
            <span>Net Profit / Loss</span>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold border',
              isPositivePnl
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border-rose-500/30',
            )}
          >
            {isPositivePnl ? <ArrowUpRight className="size-3" /> : '▼'}
            {isPositivePnl ? '+' : ''}{totalPnlPercent.toFixed(2)}%
          </span>
        </div>

        <div className="mt-4">
          <div className="flex items-baseline">
            <span className={cn('text-3xl font-bold tracking-tight', isPositivePnl ? 'text-emerald-400' : 'text-rose-400')}>
              {isPositivePnl ? '+' : '-'}${pnl.intPart}
            </span>
            <span className={cn('text-xl font-semibold', isPositivePnl ? 'text-emerald-500/70' : 'text-rose-500/70')}>.{pnl.decPart}</span>
          </div>
          <p className="mt-1 text-xs text-text-tertiary">All-time yield earnings</p>
        </div>

        {/* Embedded Green Area Sparkline Graph */}
        <div className="absolute bottom-0 left-0 right-0 h-10 w-full pointer-events-none opacity-40">
          <svg className="h-full w-full overflow-visible" viewBox="0 0 100 30" preserveAspectRatio="none">
            <defs>
              <linearGradient id="investPnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={isPositivePnl ? '#10B981' : '#F43F5E'} stopOpacity="0.5" />
                <stop offset="100%" stopColor={isPositivePnl ? '#10B981' : '#F43F5E'} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path
              d="M 0 25 C 20 22, 35 28, 50 15 C 65 5, 80 18, 100 8 L 100 30 L 0 30 Z"
              fill="url(#investPnlGrad)"
            />
            <path
              d="M 0 25 C 20 22, 35 28, 50 15 C 65 5, 80 18, 100 8"
              fill="none"
              stroke={isPositivePnl ? '#10B981' : '#F43F5E'}
              strokeWidth="2"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
        </div>
      </Card>
    </div>
  )
}
