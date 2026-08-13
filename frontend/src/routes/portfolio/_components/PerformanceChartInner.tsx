import { memo, useEffect, useState } from 'react'
import { PerformanceCustomTooltip } from './PerformanceCustomTooltip'

interface PerformanceChartInnerProps {
  data: { date: string; value: number }[]
}

export const PerformanceChartInner = memo(function PerformanceChartInner({ data }: PerformanceChartInnerProps) {
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
    return <div className="h-[300px] animate-pulse rounded-xl bg-bg-inset" />
  }

  const { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } = Recharts

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="performanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FA9A63" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#FA9A63" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis
            dataKey="date"
            tick={{ fill: '#737373', fontSize: 11 }}
            axisLine={{ stroke: 'rgba(255,255,255,0.08)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#737373', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v.toLocaleString()}`}
          />
          <Tooltip content={<PerformanceCustomTooltip />} />
          <Area
            type="monotone"
            dataKey="value"
            stroke="#FA9A63"
            strokeWidth={2}
            fill="url(#performanceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
})
