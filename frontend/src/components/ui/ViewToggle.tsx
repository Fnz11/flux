import type { ChartView } from './metric-chart'
import { LineChart, BarChart2 } from 'lucide-react'

export function ViewToggle({
  value,
  onChange,
}: {
  value: ChartView
  onChange: (v: ChartView) => void
}) {
  return (
    <div className="inline-flex h-6 items-center rounded-lg border border-border-subtle bg-bg-inset p-0.5 text-xs shrink-0">
      <button
        type="button"
        onClick={() => onChange('curve')}
        title="Line Chart"
        className={`flex h-5 w-5 items-center justify-center rounded-md transition-all cursor-pointer ${
          value === 'curve'
            ? 'bg-bg-elevated text-text-primary shadow-xs font-semibold'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        <LineChart className="size-3" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        onClick={() => onChange('bars')}
        title="Bar Chart"
        className={`flex h-5 w-5 items-center justify-center rounded-md transition-all cursor-pointer ${
          value === 'bars'
            ? 'bg-bg-elevated text-text-primary shadow-xs font-semibold'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        <BarChart2 className="size-3" strokeWidth={1.75} />
      </button>
    </div>
  )
}
