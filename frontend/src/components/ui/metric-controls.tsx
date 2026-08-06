import type { ChartView } from './metric-chart'
import { Button } from './button'

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
    <div className="inline-flex items-center rounded-xl border border-border-subtle bg-bg-inset p-0.5 text-xs">
      <Button
        type="button"
        variant={value === 'curve' ? 'outline' : 'ghost'}
        size="sm"
        onClick={() => onChange('curve')}
        className={`h-6 px-2 py-0.5 text-[11px] font-medium ${
          value === 'curve' ? 'bg-bg-elevated text-text-primary shadow-sm border-none' : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        Line
      </Button>
      <Button
        type="button"
        variant={value === 'bars' ? 'outline' : 'ghost'}
        size="sm"
        onClick={() => onChange('bars')}
        className={`h-6 px-2 py-0.5 text-[11px] font-medium ${
          value === 'bars' ? 'bg-bg-elevated text-text-primary shadow-sm border-none' : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        Bars
      </Button>
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
    <div className="relative inline-block text-xs">
      <select
        value={value}
        onChange={(e) => {
          const found = options.find((o) => o.label === e.target.value)
          if (found) onChange(found)
        }}
        className="appearance-none rounded-xl border border-border-subtle bg-bg-inset px-2.5 py-1 pr-6 font-medium text-text-secondary cursor-pointer hover:border-border-medium focus:outline-none"
        style={{ color: accentText }}
      >
        {options.map((o) => (
          <option key={o.label} value={o.label} className="bg-bg-elevated text-text-primary">
            {o.label}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-text-muted">
        ▼
      </span>
    </div>
  )
}
