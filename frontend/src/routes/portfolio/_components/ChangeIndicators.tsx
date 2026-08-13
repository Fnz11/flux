import { cn } from '@/lib/utils'

function toNum(val: string): number | null {
  const n = parseFloat(val)
  return isNaN(n) ? null : n
}

export function ChangeBadge({ value }: { value: string }) {
  const n = toNum(value)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold',
        n === null
          ? 'bg-bg-inset text-text-tertiary'
          : n >= 0
          ? 'bg-emerald-500/15 text-emerald-400'
          : 'bg-amber-500/15 text-amber-400',
      )}
    >
      {n === null ? '—' : `${n >= 0 ? '▲' : '▼'} ${Math.abs(n).toFixed(2)}%`}
    </span>
  )
}

export function ChangeText({ value }: { value: string }) {
  const n = toNum(value)
  return (
    <span
      className={cn(
        'text-[10px] font-medium ml-1',
        n === null
          ? 'text-text-tertiary'
          : n >= 0
          ? 'text-emerald-400'
          : 'text-amber-400',
      )}
    >
      {n === null ? '—' : `${n >= 0 ? '▲' : '▼'} ${Math.abs(n).toFixed(2)}%`}
    </span>
  )
}
