import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'

interface DataItem { name: string; value: number; color: string }

interface AllocationChartInnerProps {
  data: DataItem[]
}

const DEFAULT_COLORS = ['#FA9A63', '#CDA63C', '#F6B253', '#FFD99F', '#3086ff', '#28C840', '#FF5F57', '#FFBD2E']

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const entry = payload[0]
  const total = entry.payload._total
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-elevated p-3 shadow-xl">
      <p className="text-sm font-medium text-text-primary">{entry.name}</p>
      <p className="text-sm text-text-muted font-mono">
        ${entry.value.toLocaleString()} ({((entry.value / total) * 100).toFixed(1)}%)
      </p>
    </div>
  )
}

export function AllocationChartInner({ data }: AllocationChartInnerProps) {
  const total = data.reduce((s, d) => s + d.value, 0)
  const colored = data.map((d, i) => ({
    ...d,
    color: d.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length],
    _total: total,
  }))

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
            <Tooltip content={<CustomTooltip />} />
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
}
