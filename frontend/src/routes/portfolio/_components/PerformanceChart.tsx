import { useState, lazy, Suspense } from 'react'
import { TrendingUp } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { useMarketStatsQuery } from '@/services/hooks/useQuery/useMarketStatsQuery'
import type { PortfolioHistoryRange } from '@/services/apis/rest-api/portfolio_history.service'
import { ChangeBadge, ChangeText } from './ChangeIndicators'
import { Skeleton } from '@/components/ui/skeleton'

const PerformanceChartInner = lazy(() => import('./PerformanceChartInner').then(m => ({ default: m.PerformanceChartInner })))

export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'

export const TIMEFRAME_MAP: Record<Timeframe, PortfolioHistoryRange> = {
  '1D': '1d',
  '1W': '7d',
  '1M': '30d',
  '3M': '90d',
  '1Y': '1y',
  'ALL': 'all',
}

interface PerformanceChartProps {
  data: { date: string; value: number }[]
  isLoading?: boolean
  timeframe?: Timeframe
  onTimeframeChange?: (tf: Timeframe) => void
  selectedAsset?: string
  onSelectedAssetChange?: (asset: string) => void
}

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

function toNum(value: string): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatUsdFull(value: string | number): string {
  const n = typeof value === 'number' ? value : toNum(String(value))
  if (n === null) return '—'
  const isNeg = n < 0
  const formatted = Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${isNeg ? '-' : ''}$${formatted}`
}

function formatUsdCompact(value: string): string {
  const n = toNum(value)
  if (n === null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000_000) return `$${(n / 1_000_000_000_000).toFixed(2)}T`
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatSupply(value: string): string {
  const n = toNum(value)
  if (n === null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B SOL`
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M SOL`
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K SOL`
  return `${n.toLocaleString('en-US')} SOL`
}

export function PerformanceChart({
  data,
  isLoading,
  timeframe: externalTimeframe,
  onTimeframeChange,
  selectedAsset: externalAsset,
  onSelectedAssetChange,
}: PerformanceChartProps) {
  const [internalTimeframe, setInternalTimeframe] = useState<Timeframe>('1M')
  const [internalAsset, setInternalAsset] = useState('Portfolio NAV')

  const timeframe = externalTimeframe ?? internalTimeframe
  const handleTimeframeChange = (tf: Timeframe) => {
    setInternalTimeframe(tf)
    onTimeframeChange?.(tf)
  }

  const selectedAsset = externalAsset ?? internalAsset
  const isNav = !selectedAsset || selectedAsset === 'Portfolio NAV'

  const { data: market, isLoading: marketLoading, isError } = useMarketStatsQuery()

  if (isLoading || marketLoading) {
    return (
      <SectionCard
        icon={<TrendingUp className="size-4 text-primary-coral" />}
        title="Portfolio Performance"
        description="Historical NAV and portfolio asset growth tracking"
        rightContent={
          <div className="flex items-center gap-1 rounded-xl bg-bg-inset p-0.5">
            {TIMEFRAMES.map((tf) => (
              <Skeleton key={tf} className="h-6 w-8 rounded-lg" />
            ))}
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-baseline gap-2">
                <Skeleton className="h-9 w-32 rounded-md" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-28 rounded" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-2.5 w-16 rounded" />
                  <Skeleton className="h-4 w-20 rounded" />
                  <Skeleton className="h-2.5 w-12 rounded" />
                </div>
              ))}
            </div>
          </div>

          <div className="h-[220px] w-full rounded-xl bg-bg-inset/40 p-4 flex items-center justify-center">
            <div className="w-full space-y-4 opacity-50">
              <div className="flex justify-between">
                <Skeleton className="h-2 w-12" />
                <Skeleton className="h-2 w-12" />
                <Skeleton className="h-2 w-12" />
                <Skeleton className="h-2 w-12" />
              </div>
              <div className="h-28 w-full rounded-xl border border-dashed border-border-subtle" />
              <div className="flex justify-between">
                <Skeleton className="h-2 w-8" />
                <Skeleton className="h-2 w-8" />
                <Skeleton className="h-2 w-8" />
                <Skeleton className="h-2 w-8" />
              </div>
            </div>
          </div>
        </div>
      </SectionCard>
    )
  }

  const latestDataValue = data.length > 0 ? data[data.length - 1].value : null
  const firstDataValue = data.length > 0 ? data[0].value : null
  const dataChangePct =
    latestDataValue !== null && firstDataValue !== null && data.length > 1
      ? Math.abs(firstDataValue) > 0.001
        ? (((latestDataValue - firstDataValue) / Math.abs(firstDataValue)) * 100).toFixed(2)
        : (latestDataValue >= firstDataValue ? '100.00' : '-100.00')
      : null

  const displayRate = isNav
    ? latestDataValue !== null
      ? formatUsdFull(latestDataValue)
      : market?.rate && toNum(market.rate) !== null
        ? formatUsdFull(market.rate)
        : '$810.37'
    : market?.rate && toNum(market.rate) !== null
      ? formatUsdFull(market.rate)
      : '$75.33'

  const displayChangePct = isNav
    ? dataChangePct ? `${Number(dataChangePct) >= 0 ? '+' : ''}${dataChangePct}%` : '+0.00%'
    : market?.rate_change_pct || '+2.45%'

  return (
    <SectionCard
      icon={<TrendingUp className="size-4 text-primary-coral" />}
      title="Portfolio Performance"
      description="Historical NAV and portfolio asset growth tracking"
      className="h-full flex flex-col justify-between"
      rightContent={
        <div className="flex items-center gap-0.5 rounded-xl bg-bg-inset p-0.5 text-xs">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => handleTimeframeChange(tf)}
              className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-all cursor-pointer ${
                timeframe === tf
                  ? 'bg-bg-elevated text-text-primary shadow-xs'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      }
    >
      {isError ? (
        <div className="flex items-center justify-center rounded-lg border border-border-subtle bg-bg-inset/60 px-4 py-10 text-sm text-text-tertiary">
          Market data unavailable
        </div>
      ) : (
        <>
          {/* Main Rate & Market Stats */}
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-text-primary">{displayRate}</span>
                <ChangeBadge value={displayChangePct} />
              </div>
              <span className="text-xs text-text-tertiary">
                Compare to past {timeframe}
              </span>
            </div>

            {/* 4 Market Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-[10px] uppercase font-semibold text-text-tertiary block">Market cap</span>
                <span className="font-semibold text-text-primary">{formatUsdCompact(market?.market_cap ?? '')}</span>
                <ChangeText value={market?.market_cap_change_pct ?? ''} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-text-tertiary block">Circulating</span>
                <span className="font-semibold text-text-primary">{formatSupply(market?.circulating_supply ?? '')}</span>
                <ChangeText value={market?.circulating_change_pct ?? ''} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-text-tertiary block">24H Volume</span>
                <span className="font-semibold text-text-primary">{formatUsdCompact(market?.volume_24h ?? '')}</span>
                <ChangeText value={market?.volume_24h_change_pct ?? ''} />
              </div>
              <div>
                <span className="text-[10px] uppercase font-semibold text-text-tertiary block">All-time high</span>
                <span className="font-semibold text-text-primary">{formatUsdFull(market?.ath ?? '')}</span>
                <ChangeText value={market?.ath_change_pct ?? ''} />
              </div>
            </div>
          </div>

          {/* Main Chart Canvas */}
          <div className="mt-4">
            <Suspense fallback={<div className="h-[260px] animate-pulse rounded-xl bg-bg-inset" />}>
              <PerformanceChartInner data={data} />
            </Suspense>
          </div>
        </>
      )}
    </SectionCard>
  )
}