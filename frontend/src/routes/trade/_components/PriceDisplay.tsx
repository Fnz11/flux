import { cn } from '@/lib/utils'

interface PriceState {
  price: number
  confidence: number
  status: 'loading' | 'live' | 'stale' | 'error' | 'offline'
  lastUpdated: Date | null
}

interface PriceDisplayProps {
  data: PriceState
  label?: string
}

const statusConfig = {
  loading: { dot: 'bg-status-warn', text: 'Loading...', pulse: true },
  live: { dot: 'bg-status-success', text: 'Live', pulse: false },
  stale: { dot: 'bg-status-warn', text: 'Stale', pulse: false },
  error: { dot: 'bg-status-error', text: 'Error', pulse: false },
  offline: { dot: 'bg-text-muted', text: 'Offline', pulse: false },
}

export function PriceDisplay({ data, label = 'Pyth Oracle Price' }: PriceDisplayProps) {
  const cfg = statusConfig[data.status]

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-text-tertiary">{label}</p>
        <div className="flex items-center gap-1.5">
          <span
            className={cn('size-2 rounded-full', cfg.dot, cfg.pulse && 'animate-pulse')}
          />
          <span className="text-xs text-text-muted">{cfg.text}</span>
        </div>
      </div>

      {data.status === 'loading' ? (
        <div className="mt-2 h-7 w-32 animate-pulse rounded-xl bg-bg-inset" />
      ) : data.status === 'error' || data.status === 'offline' ? (
        <p className="mt-2 text-sm text-text-tertiary">Price unavailable</p>
      ) : (
        <>
          <p className="mt-1 font-mono text-2xl font-semibold tracking-tight text-text-primary">
            ${data.price.toFixed(6)}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-text-tertiary">
            <span>±{data.confidence.toFixed(6)}</span>
            {data.lastUpdated && (
              <span>Updated {timeAgo(data.lastUpdated)}</span>
            )}
            {data.status === 'stale' && (
              <span className="text-status-warn">{'>'}60s old</span>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 5) return 'just now'
  if (secs < 60) return `${secs}s ago`
  return `${Math.floor(secs / 60)}m ago`
}

export type { PriceState }
