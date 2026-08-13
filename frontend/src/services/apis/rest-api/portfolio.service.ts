import { api } from '@/lib/api'
import { mapApiPortfolioToPortfolio, type RawApiPortfolioPosition } from '@/lib/mappers'
import type { PortfolioPosition, ApiPortfolioResponse } from '@/types'

export async function getPortfolio(wallet: string): Promise<PortfolioPosition[]> {
  const res = await api.get<ApiPortfolioResponse | RawApiPortfolioPosition[]>(`/portfolio/${encodeURIComponent(wallet)}`)
  const items = Array.isArray(res) ? res : (res?.positions ?? [])
  return items.map(mapApiPortfolioToPortfolio)
}
