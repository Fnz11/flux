import type { ChartView } from './metric-chart'
import { LineChart, BarChart2 } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

export interface PeriodOption {
  label: string
  points?: number
}

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

export function PeriodSelect({
  value,
  options,
  onChange,
  accentText,
}: {
  value: string
  options: PeriodOption[]
  onChange: (opt: PeriodOption) => void
  accentText?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(val) => {
        const found = options.find((o) => o.label === val)
        if (found) onChange(found)
      }}
    >
      <SelectTrigger
        className="h-6 w-auto gap-1 rounded-lg border-border-subtle bg-bg-inset px-2 py-0 text-[10px] font-medium text-text-secondary transition-colors hover:border-border-medium hover:text-text-primary focus:ring-0 cursor-pointer shrink-0"
      >
        <SelectValue placeholder={value} style={{ color: accentText }} />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[7.5rem] rounded-xl border-border-medium bg-bg-elevated text-text-primary shadow-xl">
        {options.map((o) => (
          <SelectItem key={o.label} value={o.label} className="text-xs text-text-secondary focus:bg-bg-inset focus:text-text-primary cursor-pointer">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
