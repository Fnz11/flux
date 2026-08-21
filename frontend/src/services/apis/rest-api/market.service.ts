import { api } from '@/lib/api'

export interface MarketStats {
  market_cap: string
  market_cap_change_pct: string
  circulating_supply: string
  circulating_change_pct: string
  volume_24h: string
  volume_24h_change_pct: string
  ath: string
  ath_change_pct: string
  rate: string
  rate_change_pct: string
  updated_at: string
}

export interface LeaderboardItem {
  rank: number
  name: string
  symbol: string
  tag: string
  volume: number | string
  change: number | string
  icon: string
}

export interface LeaderboardResponse {
  type: string
  items: LeaderboardItem[]
}

export type LeaderboardType = 'trending' | 'gainers' | 'new'

interface MarketStatsResponse {
  data: MarketStats
}

interface LeaderboardResponseEnvelope {
  data: LeaderboardResponse
}

export async function getMarketStats(): Promise<MarketStats> {
  const res = await api.get<MarketStatsResponse | MarketStats>('/metrics/market')
  const payload = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res
  return ((payload as { data?: MarketStats })?.data ?? payload) as MarketStats
}

export async function getLeaderboard(type: LeaderboardType, limit?: number, period?: string): Promise<LeaderboardItem[]> {
  const params: Record<string, string | number> = { type }
  if (limit != null) params.limit = limit
  if (period) params.period = period
  const res = await api.get<LeaderboardResponseEnvelope | LeaderboardResponse>('/metrics/leaderboard', params)
  const payload = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res
  return ((payload as { data?: LeaderboardResponse })?.data?.items ?? (payload as LeaderboardResponse)?.items ?? (Array.isArray(payload) ? payload : []))
}