import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Trophy } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { cn } from '@/lib/utils'
import { useLeaderboardQuery } from '@/services/hooks/useQuery/useLeaderboardQuery'
import type { LeaderboardType } from '@/services/apis/rest-api/market.service'
import { useWebSocketStore } from '@/stores'

function toNum(value: string): number | null {
  if (!value) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function formatVolume(value: string): string {
  const n = toNum(value)
  if (n === null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`
  if (abs >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (abs >= 1_000) return `$${(n / 1_000).toFixed(2)}K`
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatChange(value: number | null): string {
  if (value === null) return '—'
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function LeaderboardWidget() {
  const [tab, setTab] = useState<LeaderboardType>('trending')
  const queryClient = useQueryClient()
  const onMessage = useWebSocketStore((s) => s.onMessage)
  const { data: items = [], isLoading, isError } = useLeaderboardQuery(tab)
  const empty = isError || items.length === 0

  useEffect(() => {
    const unsubscribe = onMessage((msg) => {
      if (msg.type === 'leaderboard_update') {
        queryClient.invalidateQueries({ queryKey: ['leaderboard'] })
      }
    })
    return unsubscribe
  }, [onMessage, queryClient])

  return (
    <SectionCard
      icon={<Trophy className="size-4 text-primary-gold" />}
      title="Top Tokens"
      description="Ranked volume and 24h gainers across ecosystem"
      className="h-full flex flex-col justify-between"
      rightContent={<span className="size-2 rounded-full bg-emerald-400 animate-pulse" />}
    >
      <div>
        {/* Tab pills */}
        <div className="flex items-center gap-1 rounded-xl bg-bg-inset p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setTab('trending')}
            className={cn(
              'flex-1 rounded-lg py-1 font-medium transition-all cursor-pointer text-center',
              tab === 'trending' ? 'bg-bg-elevated text-text-primary shadow-xs font-semibold' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            Trending
          </button>
          <button
            type="button"
            onClick={() => setTab('gainers')}
            className={cn(
              'flex-1 rounded-lg py-1 font-medium transition-all cursor-pointer text-center',
              tab === 'gainers' ? 'bg-bg-elevated text-text-primary shadow-xs font-semibold' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            Gainers
          </button>
          <button
            type="button"
            onClick={() => setTab('new')}
            className={cn(
              'flex-1 rounded-lg py-1 font-medium transition-all cursor-pointer text-center',
              tab === 'new' ? 'bg-bg-elevated text-text-primary shadow-xs font-semibold' : 'text-text-tertiary hover:text-text-secondary',
            )}
          >
            New
          </button>
        </div>

        {/* Column Headers */}
        <div className="mt-3 grid grid-cols-12 px-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          <span className="col-span-6">Name</span>
          <span className="col-span-3 text-right">Volume</span>
          <span className="col-span-3 text-right">Change</span>
        </div>

        {/* Items List */}
        <div className="mt-2 space-y-1">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="grid grid-cols-12 items-center rounded-xl px-2 py-2 text-xs">
                <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                  <div className="size-6 shrink-0 animate-pulse rounded-full bg-bg-inset" />
                  <div className="space-y-1.5 min-w-0">
                    <div className="h-2.5 w-24 animate-pulse rounded bg-bg-inset" />
                    <div className="h-2 w-10 animate-pulse rounded bg-bg-inset/60" />
                  </div>
                </div>
                <div className="col-span-3 text-right">
                  <div className="ml-auto h-2.5 w-14 animate-pulse rounded bg-bg-inset" />
                </div>
                <div className="col-span-3 text-right">
                  <div className="ml-auto h-2.5 w-12 animate-pulse rounded bg-bg-inset" />
                </div>
              </div>
            ))
          ) : empty ? (
            <div className="flex items-center justify-center rounded-xl border border-border-subtle bg-bg-inset/40 px-4 py-8 text-xs text-text-tertiary">
              No tokens yet
            </div>
          ) : (
            items.map((item) => {
              const changeNum = toNum(String(item.change ?? ''))
              const isPositive = changeNum !== null && changeNum >= 0
              return (
                <div
                  key={`${item.rank}-${item.symbol}`}
                  className="grid grid-cols-12 items-center rounded-xl px-2 py-2 text-xs transition-colors hover:bg-bg-inset/60 cursor-pointer"
                >
                  <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                    {item.icon ? (
                      <img src={item.icon} alt={item.symbol} className="size-6 rounded-full object-cover shrink-0" />
                    ) : (
                      <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-bg-inset text-[10px] font-bold text-text-secondary">
                        {item.symbol.charAt(0)}
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="font-semibold text-text-primary text-[12px] truncate">{item.name}</span>
                      </div>
                      <span className="text-[10px] text-text-tertiary">{item.tag}</span>
                    </div>
                  </div>
                  <span className="col-span-3 text-right font-mono text-[11px] text-text-secondary">
                    {formatVolume(String(item.volume ?? ''))}
                  </span>
                  <span
                    className={cn(
                      'col-span-3 text-right font-mono text-[11px] font-semibold',
                      changeNum === null ? 'text-text-tertiary' : isPositive ? 'text-status-success' : 'text-status-error',
                    )}
                  >
                    {formatChange(changeNum)}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>
    </SectionCard>
  )
}