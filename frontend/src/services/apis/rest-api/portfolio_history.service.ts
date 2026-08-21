import { api } from '@/lib/api'
import type { ApiPortfolioHistoryPoint, ApiPortfolioHistoryResponse } from '@/types'

export type PortfolioHistoryRange = '7d' | '30d' | '90d'

export async function getPortfolioHistory(
  wallet: string,
  range: PortfolioHistoryRange = '30d',
): Promise<ApiPortfolioHistoryPoint[]> {
  const res = await api.get<
    ApiPortfolioHistoryResponse | ApiPortfolioHistoryPoint[] | { data?: ApiPortfolioHistoryResponse | ApiPortfolioHistoryPoint[] }
  >('/portfolio/history', { wallet, range })
  const payload = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res
  if (Array.isArray(payload)) return payload
  return (payload && typeof payload === 'object' && 'points' in payload && Array.isArray((payload as ApiPortfolioHistoryResponse).points))
    ? (payload as ApiPortfolioHistoryResponse).points
    : []
}