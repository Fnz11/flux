import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { Activity, ShieldCheck } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface PriceState {
  price: number
  confidence: number
  status: 'loading' | 'live' | 'stale' | 'error' | 'offline'
  lastUpdated: Date | null
}

interface PriceDisplayProps {
  data: PriceState
  label?: string
  sparkline?: number[]
}

const statusConfig = {
  live: { dot: 'bg-emerald-400', text: 'Live', pulse: true },
  stale: { dot: 'bg-amber-400', text: 'Stale', pulse: false },
  error: { dot: 'bg-rose-400', text: 'Error', pulse: false },
  offline: { dot: 'bg-text-muted', text: 'Offline', pulse: false },
}

export function PriceDisplay({ data, label = 'Pyth Oracle Price', sparkline }: PriceDisplayProps) {
  const cfg = data.status === 'loading' ? undefined : statusConfig[data.status]

  const [history, setHistory] = useState<number[]>(sparkline ?? [])
  const lastRef = useRef<number | null>(null)
  const historyRef = useRef<number[]>(sparkline ?? [])

  useEffect(() => {
    historyRef.current = sparkline ?? []
    setHistory(sparkline ?? [])
  }, [sparkline])

  useEffect(() => {
    const price = data.price
    if (!price || price <= 0 || data.status === 'loading' || data.status === 'error' || data.status === 'offline') {
      return
    }
    if (lastRef.current === price) return
    lastRef.current = price
    const next = [...historyRef.current, price]
    if (next.length > 40) next.shift()
    historyRef.current = next
    setHistory(next)
  }, [data.price, data.status])

  return (
    <Card className="p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-emerald-400" />
          <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
        </div>

        <div className="flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-bold text-emerald-400">
          <span className={cn('size-2 rounded-full', cfg?.dot || 'bg-emerald-400', cfg?.pulse && 'animate-pulse')} />
          <span>{cfg?.text || 'Live'}</span>
        </div>
      </div>

      {data.status === 'loading' ? (
        <div className="space-y-3 py-2">
          <div className="h-4 w-28 animate-pulse rounded-md bg-bg-inset" />
          <div className="h-9 w-44 animate-pulse rounded-xl bg-bg-inset" />
        </div>
      ) : data.status === 'error' || data.status === 'offline' ? (
        <p className="mt-2 text-sm text-text-tertiary">Price unavailable</p>
      ) : (
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tracking-tight text-text-primary">
              ${data.price.toFixed(6)}
            </span>
          </div>

          <div className="mt-2 flex items-center justify-between text-xs text-text-tertiary border-t border-border-subtle/40 pt-2">
            <span className="font-mono text-[11px]">Conf: ±{data.confidence.toFixed(6)}</span>
            <div className="flex items-center gap-1 text-[11px] font-medium text-emerald-400">
              <ShieldCheck className="size-3.5" />
              <span>Hermes Pyth v2</span>
            </div>
          </div>

          {/* Mini Live Sparkline Chart */}
          <div className="mt-3 h-10 w-full overflow-hidden">
            <svg className="h-full w-full" viewBox="0 0 100 30" preserveAspectRatio="none">
              <defs>
                <linearGradient id="pythGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#10B981" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              {history.length > 1 ? (
                (() => {
                  const points = history
                  const min = Math.min(...points)
                  const max = Math.max(...points)
                  const range = max - min || 1
                  const line = points
                    .map((val, idx) => {
                      const x = (idx / (points.length - 1)) * 100
                      const y = 30 - ((val - min) / range) * 26 - 2
                      return `${x.toFixed(1)},${y.toFixed(1)}`
                    })
                    .join(' ')
                  const area = `0,30 ${line} 100,30`
                  return (
                    <>
                      <polygon points={area} fill="url(#pythGrad)" />
                      <polyline
                        points={line}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2"
                        strokeLinecap="round"
                        vectorEffect="non-scaling-stroke"
                      />
                    </>
                  )
                })()
              ) : (
                <line x1={0} y1={15} x2={100} y2={15} stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="1 3" />
              )}
            </svg>
          </div>
        </div>
      )}
    </Card>
  )
}

export type { PriceState }
