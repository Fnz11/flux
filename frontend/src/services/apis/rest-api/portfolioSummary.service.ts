import { api } from '@/lib/api'

export interface PortfolioSummaryResponse {
  wallet: string
  vault_count: number
  total_invested: number
  current_value: number
  unrealized_pnl: number
  total_pnl: number
  pnl_percent: number
  updated_at?: string
}

export async function getPortfolioSummary(wallet?: string): Promise<PortfolioSummaryResponse> {
  const endpoint = wallet ? `/portfolio/${encodeURIComponent(wallet)}/summary` : '/portfolio/summary'
  const res = await api.get<PortfolioSummaryResponse | { data?: PortfolioSummaryResponse }>(endpoint)
  const payload = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res
  return {
    wallet: (payload as any)?.wallet || wallet || '',
    vault_count: Number((payload as any)?.vault_count || 0),
    total_invested: Number((payload as any)?.total_invested || 0),
    current_value: Number((payload as any)?.current_value || 0),
    unrealized_pnl: Number((payload as any)?.unrealized_pnl || 0),
    total_pnl: Number((payload as any)?.total_pnl || 0),
    pnl_percent: Number((payload as any)?.pnl_percent || 0),
    updated_at: (payload as any)?.updated_at,
  }
}
