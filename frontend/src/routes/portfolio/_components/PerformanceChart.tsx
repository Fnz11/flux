import { useState, lazy, Suspense } from 'react'
import { Button } from '@/components/ui/button'

const PerformanceChartInner = lazy(() => import('./PerformanceChartInner').then(m => ({ default: m.PerformanceChartInner })))

type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'

interface PerformanceChartProps {
  data: { date: string; value: number }[]
  isLoading?: boolean
}

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

export function PerformanceChart({ data, isLoading }: PerformanceChartProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('1M')

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <div className="animate-pulse h-[300px] rounded-xl bg-bg-inset" />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-elevated/40 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-text-primary">Performance</h3>
        <div className="flex gap-1 rounded-xl bg-bg-inset p-0.5">
          {TIMEFRAMES.map((tf) => (
            <Button
              key={tf}
              variant={timeframe === tf ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setTimeframe(tf)}
            >
              {tf}
            </Button>
          ))}
        </div>
      </div>

      <Suspense fallback={<div className="mt-4 h-[300px] animate-pulse rounded-xl bg-bg-inset" />}>
        <PerformanceChartInner data={data} />
      </Suspense>
    </div>
  )
}
