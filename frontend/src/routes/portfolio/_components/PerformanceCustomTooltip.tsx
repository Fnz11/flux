export interface PerformanceCustomTooltipProps {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}

export function PerformanceCustomTooltip({ active, payload, label }: PerformanceCustomTooltipProps) {
  if (!active || !payload?.length || payload[0]?.value === undefined) return null
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-3 shadow-xl">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="text-sm font-semibold text-text-primary font-mono">
        ${payload[0].value.toLocaleString()}
      </p>
    </div>
  )
}
