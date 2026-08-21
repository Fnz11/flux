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
    payload: DataItem & { _total: number; color: string }
  }>
}

export function AllocationCustomTooltip({ active, payload }: AllocationCustomTooltipProps) {
  if (!active || !payload?.length || !payload[0]) return null
  const entry = payload[0]
  const total = entry.payload._total || 1
  const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0'
  const color = entry.payload.color || '#FF6B35'

  return (
    <div className="rounded-xl border border-white/15 bg-bg-elevated/95 p-2.5 shadow-2xl backdrop-blur-md text-xs">
      <div className="flex items-center gap-2 mb-1">
        <span className="size-2 rounded-full ring-2 ring-white/10 shrink-0" style={{ backgroundColor: color }} />
        <span className="font-bold text-text-primary">{entry.name}</span>
      </div>
      <div className="space-y-0.5 font-mono text-[11px]">
        <p className="text-text-secondary">
          ${entry.value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({pct}%)
        </p>
      </div>
    </div>
  )
}
