import { useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowRight, ArrowUp, BarChart2 } from 'lucide-react'
import { Card } from './card'
import {
  MetricChart,
  type ChartSeries,
  type ChartView,
  type MetricAccent,
  type MetricSeries,
  type SeriesPoint,
} from './metric-chart'
import { ACCENTS, SERIES_COLORS, formatCompact } from './metric-chart-constants'
import { PeriodSelect, ViewToggle, type PeriodOption } from './metric-controls'
import { EmptyState } from './EmptyState'

export type { SeriesPoint, MetricSeries, MetricAccent, ChartView, PeriodOption }

export type CardSize = 'sm' | 'md' | 'lg'

export interface ProgressMetricCardProps {
  title: string
  total?: string | number
  delta?: string
  deltaLabel?: string
  percent?: string
  trend?: 'up' | 'down'
  unit?: string
  period?: string
  periodOptions?: PeriodOption[]
  onPeriodChange?: (option: PeriodOption) => void
  defaultView?: ChartView
  accent?: MetricAccent
  data?: SeriesPoint[]
  series?: MetricSeries[]
  defaultIndex?: number
  size?: CardSize
  showStats?: boolean
  valueFormatter?: (value: number) => string
  dateFormatter?: (date: string) => string
  loading?: boolean
  className?: string
}

const DEFAULT_PERIODS: PeriodOption[] = [
  { label: 'Past 7 days', points: 4 },
  { label: 'Past 14 days', points: 7 },
  { label: 'Past 30 days' },
]

const NEUTRAL_PCT = 0.5

const sliceWindow = (points: SeriesPoint[], n?: number) =>
  n && n < points.length ? points.slice(-n) : points

export function ProgressMetricCard({
  title,
  total,
  delta,
  deltaLabel = 'today',
  percent,
  trend,
  unit,
  period = 'Past 30 days',
  periodOptions,
  onPeriodChange,
  defaultView = 'curve',
  accent,
  data,
  series,
  defaultIndex,
  showStats = true,
  valueFormatter,
  dateFormatter,
  loading = false,
  className = '',
}: ProgressMetricCardProps) {
  const gridId = `grid-${useId().replace(/:/g, '')}`

  const periods = periodOptions ?? DEFAULT_PERIODS
  const [selectedLabel, setSelectedLabel] = useState(period)
  const [view, setView] = useState<ChartView>(defaultView)

  const baseSeries: MetricSeries[] = useMemo(
    () => (series?.length ? series : [{ name: title, data: data ?? [], accent }]),
    [series, data, title, accent],
  )

  const selectedOption =
    periods.find((p) => p.label === selectedLabel) ?? periods[periods.length - 1]

  const visibleSeries = useMemo(
    () => baseSeries.map((s) => ({ ...s, data: sliceWindow(s.data, selectedOption?.points) })),
    [baseSeries, selectedOption],
  )

  const primary = visibleSeries[0]
  const isMulti = visibleSeries.length > 1
  const hasData = (primary?.data.length ?? 0) >= 2

  const stats = useMemo(() => {
    const vals = primary?.data.map((d) => d.value) ?? []
    const sum = vals.reduce((a, b) => a + b, 0)
    const first = vals[0] ?? 0
    const last = vals[vals.length - 1] ?? 0
    const prev = vals[vals.length - 2] ?? first
    const net = last - first
    return {
      sum,
      net,
      pct: first ? (net / first) * 100 : 0,
      step: last - prev,
      peak: vals.length ? Math.max(...vals) : 0,
      low: vals.length ? Math.min(...vals) : 0,
      avg: vals.length ? sum / vals.length : 0,
    }
  }, [primary])

  const resolvedTrend: 'up' | 'down' | 'flat' =
    trend ?? (Math.abs(stats.pct) < NEUTRAL_PCT ? 'flat' : stats.net >= 0 ? 'up' : 'down')
  const resolvedAccent: MetricAccent =
    accent ?? (resolvedTrend === 'up' ? 'emerald' : resolvedTrend === 'down' ? 'rose' : 'neutral')
  const color = ACCENTS[resolvedAccent]
  const TrendIcon =
    resolvedTrend === 'flat' ? ArrowRight : resolvedTrend === 'down' ? ArrowDown : ArrowUp

  const fmtCompact = valueFormatter ?? formatCompact
  const fmtFull = valueFormatter ?? ((n: number) => n.toLocaleString() + (unit ? ` ${unit}` : ''))
  const fmtDate = dateFormatter ?? ((d: string) => d)
  const sign = (n: number) => (n >= 0 ? '+' : '−') + fmtCompact(Math.abs(n))

  const displayTotal = total ?? fmtCompact(stats.sum)
  const displayDelta = delta ?? sign(stats.step)
  const displayPercent = percent ?? `${Math.abs(stats.pct).toFixed(1)}%`

  const chartSeries: ChartSeries[] = visibleSeries.map((s, i) => ({
    name: s.name,
    data: s.data,
    color: s.accent
      ? ACCENTS[s.accent].stroke
      : isMulti
        ? SERIES_COLORS[i % SERIES_COLORS.length]
        : color.stroke,
  }))

  const handlePeriodChange = (option: PeriodOption) => {
    setSelectedLabel(option.label)
    onPeriodChange?.(option)
  }

  if (loading) {
    return (
      <Card className={`relative flex h-full min-h-[195px] w-full flex-col justify-between overflow-hidden p-4 ${className}`}>
        <div className="flex items-center justify-between">
          <div className="h-3.5 w-24 animate-pulse rounded bg-bg-inset" />
          <div className="h-4 w-16 animate-pulse rounded bg-bg-inset" />
        </div>
        <div className="mt-3 h-8 w-28 animate-pulse rounded-lg bg-bg-inset" />
        <div className="mt-auto h-16 w-full animate-pulse rounded-lg bg-bg-inset/40" />
      </Card>
    )
  }

  if (!hasData) {
    return (
      <Card className={`relative flex h-full min-h-[195px] w-full flex-col justify-between overflow-hidden p-4 ${className}`}>
        <div className="relative z-10 flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary">
            {title}
          </span>
        </div>
        <div className="relative z-10 flex flex-1 items-center justify-center my-3">
          <EmptyState
            size="sm"
            icon={<BarChart2 className="size-full" />}
            title="No data yet"
            description="Metrics will appear once data is available."
          />
        </div>
      </Card>
    )
  }

  return (
    <Card className={`relative flex h-full min-h-[195px] w-full flex-col justify-between overflow-hidden p-4 shadow-sm transition-all hover:border-white/25 ${className}`}>
      {/* Background Dot Pattern (Subtle) */}
      <div
        className="pointer-events-none absolute inset-0 text-text-primary/[0.03]"
        aria-hidden
      >
        <svg className="h-full w-full">
          <defs>
            <pattern id={gridId} width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="1.5" cy="1.5" r="1" fill="currentColor" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${gridId})`} />
        </svg>
      </div>

      {/* TOP HEADER ROW: Title & Controls */}
      <div className="relative z-10 flex items-start justify-between gap-1.5">
        <div className="min-w-0">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-tertiary truncate block">
            {title}
          </span>
          <div className="mt-0.5 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-text-primary">
              {displayTotal}
            </span>
            <span
              className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold shrink-0"
              style={{ color: color.text, backgroundColor: `${color.stroke}18` }}
            >
              <TrendIcon size={10} strokeWidth={2.5} />
              {displayPercent}
            </span>
          </div>
        </div>

        {/* Controls: View Toggle & Period Selector */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1">
          <ViewToggle value={view} onChange={setView} />
          <PeriodSelect
            value={selectedLabel}
            options={periods}
            onChange={handlePeriodChange}
            accentText={color.text}
          />
        </div>
      </div>

      {/* MIDDLE: Bounded Chart Graphic Area (Interactive Hover) */}
      <div className="relative z-10 my-2 h-16 w-full overflow-hidden rounded-md">
        <MetricChart
          series={chartSeries}
          view={view}
          valueFormatter={fmtFull}
          dateFormatter={fmtDate}
        />
      </div>

      {/* BOTTOM FOOTER ROW: Stacked Values & Labels (No horizontal overflow!) */}
      <div className="relative z-10 grid grid-cols-4 gap-1 border-t border-border-subtle/40 pt-2.5">
        <div className="flex flex-col min-w-0">
          <span className="font-bold text-[12px] truncate" style={{ color: color.text }}>
            {displayDelta}
          </span>
          <span className="text-[10px] text-text-tertiary truncate">{deltaLabel}</span>
        </div>

        {showStats && (
          <>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-[12px] text-text-primary truncate">{fmtCompact(stats.peak)}</span>
              <span className="text-[10px] text-text-muted truncate">peak</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-[12px] text-text-primary truncate">{fmtCompact(stats.low)}</span>
              <span className="text-[10px] text-text-muted truncate">low</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-semibold text-[12px] text-text-primary truncate">{fmtCompact(Math.round(stats.avg))}</span>
              <span className="text-[10px] text-text-muted truncate">avg</span>
            </div>
          </>
        )}
      </div>
    </Card>
  )
}

export default ProgressMetricCard
