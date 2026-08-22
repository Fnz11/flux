import { useQuery } from '@tanstack/react-query'
import { getPortfolioSummary } from '@/services/apis/rest-api/portfolioSummary.service'

export function usePortfolioSummaryQuery(wallet?: string) {
  return useQuery({
    queryKey: ['portfolio-summary'],
    queryFn: () => getPortfolioSummary(wallet),
    staleTime: 30_000,
  })
}
