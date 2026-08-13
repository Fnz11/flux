import { memo, useEffect, useState } from 'react'
import { AllocationCustomTooltip, type DataItem } from './AllocationCustomTooltip'
import { DEFAULT_COLORS } from '@/constants/ui'

export interface AllocationChartInnerProps {
  data: DataItem[]
}

export const AllocationChartInner = memo(function AllocationChartInner({ data }: AllocationChartInnerProps) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const colored = data.map((d, i) => ({
    ...d,
    color: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
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
    return <div className="h-[220px] w-[220px] shrink-0 animate-pulse rounded-xl bg-bg-inset" />
  }

  const { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } = Recharts

  return (
    <>
      <div className="h-[220px] w-[220px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={colored}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={90}
              paddingAngle={3}
              dataKey="value"
              stroke="none"
            >
              {colored.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<AllocationCustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="flex-1 space-y-2 pt-2">
        {colored.map((entry) => (
          <div key={entry.name} className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
              <span className="truncate text-text-primary max-w-[120px]">{entry.name}</span>
            </div>
            <span className="font-mono text-xs text-text-muted">
              {((entry.value / total) * 100).toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </>
  )
})
