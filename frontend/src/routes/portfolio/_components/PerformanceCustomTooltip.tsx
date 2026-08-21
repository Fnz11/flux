export interface PerformanceCustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

export function PerformanceCustomTooltip({ active, payload, label }: PerformanceCustomTooltipProps) {
  if (!active || !payload?.length || payload[0]?.value === undefined) return null

  const val = payload[0].value
  const formatted = Math.abs(val).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const isNeg = val < 0
  const sign = isNeg ? '-' : ''

  return (
    <div className="rounded-xl border border-border-medium bg-bg-elevated/95 px-3 py-2 shadow-2xl backdrop-blur-md">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="size-2 rounded-full bg-primary-coral" />
        <span className="text-[11px] font-medium text-text-tertiary">{label}</span>
      </div>
      <p className="text-sm font-bold font-mono text-text-primary">
        {sign}${formatted}
      </p>
    </div>
  )
}

