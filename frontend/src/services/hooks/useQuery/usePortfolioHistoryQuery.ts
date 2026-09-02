import { useQuery } from '@tanstack/react-query'
import {
  getPortfolioHistory,
  type PortfolioHistoryRange,
} from '@/services/apis/rest-api/portfolio_history.service'

export function usePortfolioHistoryQuery(wallet?: string, range: PortfolioHistoryRange = '30d') {
  return useQuery({
    queryKey: ['portfolioHistory', wallet, range],
    queryFn: () => getPortfolioHistory(wallet, range),
    enabled: Boolean(wallet),
    staleTime: 60_000,
  })
}
