import { memo, useEffect, useMemo, useState } from 'react'
import { AllocationCustomTooltip, type DataItem } from './AllocationCustomTooltip'

const VAULT_PALETTE = [
  '#FF6B35', // Coral
  '#8B5CF6', // Violet
  '#38BDF8', // Sky Cyan
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#6366F1', // Indigo
  '#14B8A6', // Teal
]

export interface AllocationChartInnerProps {
  data: DataItem[]
}

export const AllocationChartInner = memo(function AllocationChartInner({ data }: AllocationChartInnerProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const sorted = useMemo(() => [...data].sort((a, b) => b.value - a.value), [data])
  const colored = sorted.map((d, i) => ({
    ...d,
    color: d.color || VAULT_PALETTE[i % VAULT_PALETTE.length],
    _total: total,
  }))

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

  if (!Recharts) {
    return <div className="h-[240px] w-[240px] shrink-0 animate-pulse rounded-full border-4 border-bg-elevated" />
  }

  const { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } = Recharts

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6 w-full h-full py-1">
      {/* Donut Chart with Center Label */}
      <div className="relative size-60 lg:size-64 shrink-0 flex items-center justify-center">
        <div className="absolute inset-0 z-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] text-text-tertiary font-mono uppercase tracking-wider leading-tight">Vaults</span>
          <span className="text-xl font-bold text-text-primary font-mono">{colored.length}</span>
        </div>

        <ResponsiveContainer width="100%" height="100%" className="relative z-10">
          <PieChart>
            <Pie
              data={colored}
              cx="50%"
              cy="50%"
              innerRadius={68}
              outerRadius={104}
              paddingAngle={3}
              dataKey="value"
              stroke="#16161b"
              strokeWidth={2}
            >
              {colored.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              content={<AllocationCustomTooltip />}
              wrapperStyle={{ zIndex: 100, pointerEvents: 'none', outline: 'none' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Legend Items List */}
      <div className="flex-1 w-full space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
        {colored.map((entry) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0'
          return (
            <div
              key={entry.name}
              className="flex items-center justify-between rounded-lg bg-bg-inset/50 px-3.5 py-2.5 border border-border-subtle/50 text-xs hover:border-border-medium transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span className="size-2.5 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: entry.color }} />
                <span className="truncate font-semibold text-text-primary">{entry.name}</span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 font-mono text-[11px]">
                <span className="font-bold text-text-primary">
                  ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="font-bold text-primary-gold bg-primary-gold/10 px-1.5 py-0.5 rounded border border-primary-gold/20">
                  {pct}%
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})
