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

interface VaultPerformanceSectionProps {
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

  const values = seriesData.map((d) => d.value)
  const currentVal = values.length > 0 ? values[values.length - 1] : vault.tvl
  const startVal = values.length > 0 ? values[0] : vault.tvl
  const highVal = values.length > 0 ? Math.max(...values) : vault.tvl
  const lowVal = values.length > 0 ? Math.min(...values) : vault.tvl
  const changePct = startVal > 0 ? ((currentVal - startVal) / startVal) * 100 : 0

  return (
    <SectionCard
      icon={<TrendingUp className="size-4 text-primary-coral" />}
      title="TVL & NAV Performance"
      description="Historical valuation curve, return rate, and deposit dynamics."
      rightContent={
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg bg-bg-inset/80 p-0.5 border border-border-subtle">
            <button
              type="button"
              onClick={() => setView('curve')}
              className={`rounded-md p-1 transition-colors ${view === 'curve' ? 'bg-bg-elevated text-primary-coral shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
              title="Line Curve"
            >
              <LineChart className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setView('bars')}
              className={`rounded-md p-1 transition-colors ${view === 'bars' ? 'bg-bg-elevated text-primary-coral shadow-sm' : 'text-text-tertiary hover:text-text-primary'}`}
              title="Bar Chart"
            >
              <BarChart2 className="size-3.5" />
            </button>
          </div>

          <SegmentedControl
            options={['7d', '30d', '90d'] as const}
            value={range}
            onChange={(val) => setRange(val as VaultSparklineRange)}
            className="bg-bg-inset/80 border-0 text-xs"
          />
        </div>
      }
    >
      <div className="space-y-5">
        {/* Stat Cards Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md">
            <p className="text-[11px] text-text-tertiary">Current NAV</p>
            <p className="mt-1 font-mono text-base font-semibold text-text-primary">
              ${currencyFormatter.format(currentVal)}
            </p>
          </Card>
          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md">
            <p className="text-[11px] text-text-tertiary">Period Return</p>
            <p className={`mt-1 font-mono text-base font-semibold ${changePct >= 0 ? 'text-status-success' : 'text-status-error'}`}>
              {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </p>
          </Card>
          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md">
            <p className="text-[11px] text-text-tertiary">Period High</p>
            <p className="mt-1 font-mono text-base font-semibold text-text-primary">
              ${currencyFormatter.format(highVal)}
            </p>
          </Card>
          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md">
            <p className="text-[11px] text-text-tertiary">Period Low</p>
            <p className="mt-1 font-mono text-base font-semibold text-text-primary">
              ${currencyFormatter.format(lowVal)}
            </p>
          </Card>
        </div>

        {/* Chart Canvas */}
        <div className="h-64 w-full rounded-xl bg-bg-surface/50 p-4 border border-border-subtle/50">
          {isLoading ? (
            <div className="flex h-full w-full items-center justify-center gap-2 text-xs text-text-tertiary font-mono">
              <Loader2 className="size-4 animate-spin text-primary-coral" />
              Loading performance series...
            </div>
          ) : seriesData.length === 0 ? (
            <div className="flex h-full w-full items-center justify-center">
              <EmptyState
                icon={<TrendingUp className="size-full" />}
                title="No Performance History"
                description="Performance chart will be plotted as deposits and trades occur in this vault."
                size="sm"
              />
            </div>
          ) : (
            <MetricChart
              series={chartSeries}
              view={view}
              valueFormatter={(v) => `$${currencyFormatter.format(v)}`}
              dateFormatter={(d) => (d ? dateFormatter.format(new Date(d)) : '')}
            />
          )}
        </div>
      </div>
    </SectionCard>
  )
}
