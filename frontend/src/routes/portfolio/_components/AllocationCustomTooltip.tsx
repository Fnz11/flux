export interface DataItem {
  name: string
  value: number
  color: string
}

export interface AllocationCustomTooltipProps {
  active?: boolean
  payload?: Array<{
    name: string
    value: number
    payload: DataItem & { _total: number }
  }>
}

export function AllocationCustomTooltip({ active, payload }: AllocationCustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null
  const entry = payload[0]
  const total = entry.payload._total || 1
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-3 shadow-xl">
      <p className="text-sm font-medium text-text-primary">{entry.name}</p>
      <p className="text-sm text-text-muted font-mono">
        ${entry.value.toLocaleString()} ({((entry.value / total) * 100).toFixed(1)}%)
      </p>
    </div>
  )
}
