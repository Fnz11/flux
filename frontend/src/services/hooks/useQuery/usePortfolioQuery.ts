import { useQuery } from '@tanstack/react-query'
import { getPortfolio } from '@/services/apis/rest-api/portfolio.service'

export function usePortfolioQuery(wallet: string) {
  return useQuery({
    queryKey: ['portfolio', wallet],
    queryFn: () => getPortfolio(wallet),
    enabled: Boolean(wallet),
  })
}
