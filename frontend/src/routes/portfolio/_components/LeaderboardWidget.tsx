import { useState } from 'react'
import { Trophy } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { cn } from '@/lib/utils'

interface LeaderboardItem {
  rank: number
  name: string
  symbol: string
  tag: string
  volume: string
  change: string
  isPositive: boolean
  icon: string
}

const LEADERBOARD_DATA: Record<'trending' | 'gainers' | 'new', LeaderboardItem[]> = {
  trending: [
    {
      rank: 1,
      name: 'Super Rare SOL',
      symbol: 'SOL',
      tag: 'RARE',
      volume: '$27.35M',
      change: '+28.32%',
      isPositive: true,
      icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    },
    {
      rank: 2,
      name: 'Jupiter Yield',
      symbol: 'JUP',
      tag: 'YIELD',
      volume: '$15.11M',
      change: '+12.65%',
      isPositive: true,
      icon: 'https://static.jup.ag/jup/icon.png',
    },
    {
      rank: 3,
      name: 'Pyth Oracle Alpha',
      symbol: 'PYTH',
      tag: 'ALPHA',
      volume: '$8.24M',
      change: '+8.54%',
      isPositive: true,
      icon: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png',
    },
    {
      rank: 4,
      name: 'USDC Cash Yield',
      symbol: 'USDC',
      tag: 'STABLE',
      volume: '$42.89M',
      change: '+4.43%',
      isPositive: true,
      icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
    },
    {
      rank: 5,
      name: 'Tether Momentum',
      symbol: 'USDT',
      tag: 'VAULT',
      volume: '$19.30M',
      change: '-2.36%',
      isPositive: false,
      icon: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png',
    },
  ],
  gainers: [
    {
      rank: 1,
      name: 'Super Rare SOL',
      symbol: 'SOL',
      tag: 'RARE',
      volume: '$27.35M',
      change: '+28.32%',
      isPositive: true,
      icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
    },
    {
      rank: 2,
      name: 'Jupiter Yield',
      symbol: 'JUP',
      tag: 'YIELD',
      volume: '$15.11M',
      change: '+12.65%',
      isPositive: true,
      icon: 'https://static.jup.ag/jup/icon.png',
    },
    {
      rank: 3,
      name: 'Pyth Oracle Alpha',
      symbol: 'PYTH',
      tag: 'ALPHA',
      volume: '$8.24M',
      change: '+8.54%',
      isPositive: true,
      icon: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png',
    },
  ],
  new: [
    {
      rank: 1,
      name: 'Pyth Oracle Alpha',
      symbol: 'PYTH',
      tag: 'NEW',
      volume: '$8.24M',
      change: '+8.54%',
      isPositive: true,
      icon: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png',
    },
    {
      rank: 2,
      name: 'Jupiter Yield',
      symbol: 'JUP',
      tag: 'NEW',
      volume: '$15.11M',
      change: '+12.65%',
      isPositive: true,
      icon: 'https://static.jup.ag/jup/icon.png',
    },
  ],
}

export function LeaderboardWidget() {
  const [tab, setTab] = useState<'trending' | 'gainers' | 'new'>('trending')
  const items = LEADERBOARD_DATA[tab]

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
          {items.map((item) => (
            <div
              key={item.name}
              className="grid grid-cols-12 items-center rounded-xl px-2 py-2 text-xs transition-colors hover:bg-bg-inset/60 cursor-pointer"
            >
              <div className="col-span-6 flex items-center gap-2.5 min-w-0">
                <img src={item.icon} alt={item.symbol} className="size-6 rounded-full object-cover shrink-0" />
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="font-semibold text-text-primary text-[12px] truncate">{item.name}</span>
                  </div>
                  <span className="text-[10px] text-text-tertiary">{item.tag}</span>
                </div>
              </div>
              <span className="col-span-3 text-right font-mono text-[11px] text-text-secondary">
                {item.volume}
              </span>
              <span
                className={cn(
                  'col-span-3 text-right font-mono text-[11px] font-semibold',
                  item.isPositive ? 'text-status-success' : 'text-status-error',
                )}
              >
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  )
}
