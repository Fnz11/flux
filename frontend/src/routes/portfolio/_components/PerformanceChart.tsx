import { useState, lazy, Suspense } from 'react'
import { ChevronDown, TrendingUp } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'

const PerformanceChartInner = lazy(() => import('./PerformanceChartInner').then(m => ({ default: m.PerformanceChartInner })))

type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'

interface PerformanceChartProps {
  data: { date: string; value: number }[]
  isLoading?: boolean
}

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

export function PerformanceChart({ data, isLoading }: PerformanceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1M')
  const [selectedAsset, setSelectedAsset] = useState('SOL / USDC')

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <div className="animate-pulse h-[340px] rounded-xl bg-bg-inset" />
      </div>
    )
  }

  return (
    <SectionCard
      icon={<TrendingUp className="size-4 text-primary-coral" />}
      title="Performance"
      description="Historical NAV and portfolio asset growth tracking"
      rightContent={
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <div className="flex items-center gap-2 rounded-xl border border-border-medium bg-bg-inset px-2.5 py-1 text-xs font-bold text-text-primary cursor-pointer">
            <span className="size-2.5 rounded-full bg-gradient-to-r from-primary-coral to-primary-gold" />
            <span className="whitespace-nowrap">{selectedAsset}</span>
            <ChevronDown className="size-3 text-text-tertiary" />
          </div>

          <div className="flex items-center gap-0.5 rounded-xl bg-bg-inset p-0.5 text-xs">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => setTimeframe(tf)}
                className={`rounded-lg px-2 py-0.5 text-[11px] font-semibold transition-all cursor-pointer ${
                  timeframe === tf
                    ? 'bg-bg-elevated text-text-primary shadow-xs'
                    : 'text-text-tertiary hover:text-text-secondary'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>
      }
    >
      {/* Main Rate & Market Stats */}
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold tracking-tight text-text-primary">$75,843.52</span>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400">
              ▲ +8.32%
            </span>
          </div>
          <span className="text-xs text-text-tertiary">Compare to last month</span>
        </div>

        {/* 4 Market Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[10px] uppercase font-semibold text-text-tertiary block">Market cap</span>
            <span className="font-semibold text-text-primary">$1.86T</span>
            <span className="text-[10px] text-emerald-400 font-medium ml-1">▲ +10.4%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-text-tertiary block">Circulating</span>
            <span className="font-semibold text-text-primary">19.8M SOL</span>
            <span className="text-[10px] text-amber-400 font-medium ml-1">▼ -3.6%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-text-tertiary block">24H Volume</span>
            <span className="font-semibold text-text-primary">$63.78B</span>
            <span className="text-[10px] text-amber-400 font-medium ml-1">▼ -6.7%</span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-semibold text-text-tertiary block">All-time high</span>
            <span className="font-semibold text-text-primary">$96,091.34</span>
            <span className="text-[10px] text-emerald-400 font-medium ml-1">▲ +4.5%</span>
          </div>
        </div>
      </div>

      {/* Main Chart Canvas */}
      <div className="mt-4">
        <Suspense fallback={<div className="h-[260px] animate-pulse rounded-xl bg-bg-inset" />}>
          <PerformanceChartInner data={data} />
        </Suspense>
      </div>
    </SectionCard>
  )
}
