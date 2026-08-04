import { api } from '@/lib/api'
import type { PortfolioPosition } from '@/types'

export function getPortfolio(wallet: string): Promise<PortfolioPosition[]> {
  return api.get(`/portfolio?wallet=${wallet}`)
}
