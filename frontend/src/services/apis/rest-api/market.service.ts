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
  const res = await api.get<MarketStatsResponse>('/metrics/market')
  return res.data
}

export async function getLeaderboard(type: LeaderboardType, limit?: number, period?: string): Promise<LeaderboardItem[]> {
  const params: Record<string, string | number> = { type }
  if (limit != null) params.limit = limit
  if (period) params.period = period
  const res = await api.get<LeaderboardResponseEnvelope>('/metrics/leaderboard', params)
  return res.data?.items ?? []
}