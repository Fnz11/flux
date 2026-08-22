import { memo, useEffect, useState, useMemo } from 'react'
import { TOKENS } from '@/constants/tokens'

export interface VaultAssetItem {
  symbol: string
  mint?: string
  amount: number
  usdValue: number
}

export interface VaultAllocationChartProps {
  balances: VaultAssetItem[]
  totalUsdValue: number
}

interface ChartDataItem {
  name: string
  value: number
  amount: number
  color: string
  percentage: number
}

// Curated high-contrast palette tuned for dark UI
const TOKEN_PALETTE: Record<string, string> = {
  ...Object.fromEntries(TOKENS.map((t) => [t.symbol, t.color])),
  BTC: '#F59E0B',
  ETH: '#6366F1',
}

const FALLBACK_PALETTE = [
  '#FF6B35', // Coral
  '#8B5CF6', // Violet
  '#38BDF8', // Sky Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
]

function AllocationTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataItem }> }) {
  if (!active || !payload?.length || !payload[0]) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-white/15 bg-bg-surface p-2.5 shadow-2xl text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="size-2 rounded-full ring-2 ring-white/10" style={{ backgroundColor: item.color }} />
        <span className="font-bold text-text-primary">{item.name}</span>
      </div>
      <div className="space-y-0.5 font-mono text-[11px]">
        <p className="text-text-secondary">
          ${item.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({item.percentage.toFixed(1)}%)
        </p>
        <p className="text-text-tertiary">
          Amount: {item.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
        </p>
      </div>
    </div>
  )
}

export const VaultAllocationChart = memo(function VaultAllocationChart({ balances, totalUsdValue }: VaultAllocationChartProps) {
  const [Recharts, setRecharts] = useState<typeof import('recharts') | null>(null)

  useEffect(() => {
    let active = true
    import('recharts')
      .then((mod) => {
        if (active) setRecharts(mod)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const chartData = useMemo(() => {
    const hasValue = totalUsdValue > 0
    return balances
      .filter((b) => (hasValue ? (b.usdValue || 0) > 0 : b.amount > 0))
      .map((b, i) => {
        const symbolKey = b.symbol?.trim().toUpperCase() || ''
        const val = b.usdValue || 0
        const pct = hasValue ? (val / totalUsdValue) * 100 : balances.length > 0 ? 100 / balances.length : 0
        const color = TOKEN_PALETTE[symbolKey] || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]

        return {
          name: b.symbol,
          value: hasValue ? val : b.amount || 1,
          amount: b.amount,
          color,
          percentage: pct,
        }
      })
  }, [balances, totalUsdValue])

  if (!Recharts) {
    return (
      <div className="flex h-full flex-col items-center justify-center min-h-[160px] animate-pulse">
        <div className="size-28 rounded-full border-4 border-bg-elevated" />
      </div>
    )
  }

  const { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } = Recharts

  if (chartData.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-3 text-center min-h-[160px]">
        <p className="text-xs text-text-tertiary">No allocation data</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full justify-between gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
          Allocation Breakdown
        </span>
      </div>

      <div className="relative h-[130px] w-full flex items-center justify-center">
        {/* Center label inside donut - z-0 and placed behind chart tooltip */}
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[9px] text-text-tertiary font-mono uppercase tracking-wider leading-tight">Assets</span>
          <span className="text-sm font-bold text-text-primary font-mono">{chartData.length}</span>
        </div>

        <ResponsiveContainer width="100%" height="100%" className="relative z-10">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={56}
              paddingAngle={3}
              dataKey="value"
              stroke="#1a1a1f"
              strokeWidth={2}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={<AllocationTooltip />}
              wrapperStyle={{ zIndex: 100, pointerEvents: 'none', outline: 'none' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Mini Legend List */}
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 pt-2 border-t border-border-subtle/50">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="size-2 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: item.color }} />
              <span className="font-semibold text-text-primary truncate">{item.name}</span>
            </div>
            <span className="font-mono text-[10px] font-medium text-text-secondary shrink-0">
              {item.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  )
})
