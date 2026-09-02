import { api } from '@/lib/api'
import { mapApiPortfolioToPortfolio, type RawApiPortfolioPosition } from '@/lib/mappers'
import type { PortfolioPosition, ApiPortfolioResponse } from '@/types'

export async function getPortfolio(wallet: string): Promise<PortfolioPosition[]> {
  const res = await api.get<ApiPortfolioResponse | RawApiPortfolioPosition[] | { data?: ApiPortfolioResponse | RawApiPortfolioPosition[] }>(
    `/user/portfolio/${encodeURIComponent(wallet)}`,
  )
  const payload = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res
  const items = Array.isArray(payload)
    ? payload
    : (payload && typeof payload === 'object' && 'positions' in payload && Array.isArray((payload as ApiPortfolioResponse).positions)
        ? (payload as ApiPortfolioResponse).positions
        : [])
  return items.map(mapApiPortfolioToPortfolio)
}
