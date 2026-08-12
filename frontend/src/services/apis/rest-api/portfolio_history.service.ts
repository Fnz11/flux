import { api } from '@/lib/api'
import type { ApiPortfolioHistoryPoint, ApiPortfolioHistoryResponse } from '@/types'

export type PortfolioHistoryRange = '7d' | '30d' | '90d'

export async function getPortfolioHistory(
  wallet: string,
  range: PortfolioHistoryRange = '30d',
): Promise<ApiPortfolioHistoryPoint[]> {
  const res = await api.get<ApiPortfolioHistoryResponse | ApiPortfolioHistoryPoint[]>('/portfolio/history', { wallet, range })
  if (Array.isArray(res)) return res
  return res?.points ?? []
}