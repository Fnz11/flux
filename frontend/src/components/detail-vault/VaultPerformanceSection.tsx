import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getVaultSparkline, type VaultSparklineRange } from '@/services/apis/rest-api/vault_sparkline.service'
import { MetricChart, type ChartSeries, type ChartView } from '@/components/ui/metric-chart'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { SectionCard } from '@/components/ui/SectionCard'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/EmptyState'
import { TrendingUp, LineChart, BarChart2, Loader2 } from 'lucide-react'
import type { Vault } from '@/types'

export interface VaultPerformanceSectionProps {
  vault: Vault
}

const currencyFormatter = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
})

export function VaultPerformanceSection({ vault }: VaultPerformanceSectionProps) {
  const [range, setRange] = useState<VaultSparklineRange>('30d')
  const [view, setView] = useState<ChartView>('curve')

  const { data: sparklineData = [], isLoading } = useQuery({
    queryKey: ['vaultSparklineFull', vault.id, range],
    queryFn: () => getVaultSparkline(vault.id || vault.address, range),
    enabled: Boolean(vault.id || vault.address),
  })

  const seriesData = useMemo(() => {
    if (sparklineData.length > 0) {
      return sparklineData.map((pt) => ({
        date: pt.date || '',
        value: pt.value,
      }))
    }
    if (!vault.tvl || vault.tvl <= 0) return []
    const pointsCount = range === '7d' ? 7 : range === '90d' ? 90 : 30
    const now = Date.now()
    const dayMs = 86400000
    return Array.from({ length: pointsCount }).map((_, i) => {
      const d = new Date(now - (pointsCount - 1 - i) * dayMs)
      return {
        date: d.toISOString(),
        value: vault.tvl,
      }
    })
  }, [sparklineData, vault.tvl, range])

  const chartSeries: ChartSeries[] = useMemo(() => [
    {
      name: 'TVL',
      data: seriesData,
      color: '#FF6B35',
    },
  ], [seriesData])

  const firstVal = seriesData.length > 0 ? seriesData[0].value : 0
  const lastVal = seriesData.length > 0 ? seriesData[seriesData.length - 1].value : (vault.tvl || 0)
  const diff = lastVal - firstVal
  const percentChange = firstVal > 0 ? (diff / firstVal) * 100 : 0
  const isPositive = diff >= 0

  return (
    <SectionCard
      icon={<TrendingUp className="size-4 text-primary-coral" />}
      title="Historical Performance & TVL Growth"
      description="On-chain assets under management trajectory over selected timeframe."
      rightContent={
        <div className="flex flex-wrap items-center gap-3">
          <SegmentedControl
            options={['7d', '30d', '90d'] as VaultSparklineRange[]}
            value={range}
            onChange={(r) => setRange(r as VaultSparklineRange)}
            className="w-auto"
          />

          <div className="flex items-center rounded-xl bg-bg-inset p-1 border border-border-subtle">
            <button
              type="button"
              onClick={() => setView('curve')}
              aria-label="Curve chart view"
              className={`rounded-lg p-1 text-xs transition-colors ${
                view === 'curve'
                  ? 'bg-bg-elevated text-primary-coral shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              <LineChart className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView('bar')}
              aria-label="Bar chart view"
              className={`rounded-lg p-1 text-xs transition-colors ${
                view === 'bar'
                  ? 'bg-bg-elevated text-primary-coral shadow-sm'
                  : 'text-text-tertiary hover:text-text-primary'
              }`}
            >
              <BarChart2 className="size-3.5" />
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Performance Metric Row */}
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-4 border-white/8 bg-bg-inset/30">
            <p className="text-xs text-text-tertiary">Current Valuation</p>
            <p className="mt-1 font-mono text-2xl font-bold text-text-primary">
              ${(vault.tvl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-[11px] text-text-muted">Total USD asset value</p>
          </Card>

          <Card className="p-4 border-white/8 bg-bg-inset/30">
            <p className="text-xs text-text-tertiary">{range.toUpperCase()} Change</p>
            <p className={`mt-1 font-mono text-2xl font-bold ${isPositive ? 'text-status-success' : 'text-status-error'}`}>
              {isPositive ? '+' : ''}${Math.abs(diff).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <p className="mt-1 text-[11px] text-text-muted">
              {isPositive ? '+' : ''}{percentChange.toFixed(2)}% over period
            </p>
          </Card>

          <Card className="p-4 border-white/8 bg-bg-inset/30">
            <p className="text-xs text-text-tertiary">Status & Capacity</p>
            <p className="mt-1 font-mono text-2xl font-bold text-text-primary">
              {vault.status}
            </p>
            <p className="mt-1 text-[11px] text-text-muted">
              {vault.maxCapacity ? `Cap: $${(vault.maxCapacity).toLocaleString()}` : 'Uncapped capacity'}
            </p>
          </Card>
        </div>

        {/* Chart Viewport */}
        <div className="rounded-2xl border border-white/8 bg-bg-inset/20 p-4 min-h-[340px] flex items-center justify-center">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center space-y-2 text-text-tertiary py-16">
              <Loader2 className="size-6 animate-spin text-primary-coral" />
              <p className="text-xs">Loading TVL trajectory...</p>
            </div>
          ) : seriesData.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<TrendingUp className="size-full text-text-muted" />}
                title="No History Available"
                description="Performance chart will populate once on-chain trades and deposits occur."
                size="sm"
              />
            </div>
          ) : (
            <div className="w-full h-80">
              <MetricChart
                series={chartSeries}
                view={view}
                height={320}
                yFormatter={(val) => `$${currencyFormatter.format(val)}`}
                xFormatter={(dateStr) => {
                  try {
                    return dateFormatter.format(new Date(dateStr))
                  } catch {
                    return dateStr
                  }
                }}
              />
            </div>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
