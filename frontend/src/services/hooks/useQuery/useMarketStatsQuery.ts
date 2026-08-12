import { useQuery } from '@tanstack/react-query'
import { getMarketStats } from '@/services/apis/rest-api/market.service'

export function useMarketStatsQuery() {
  return useQuery({
    queryKey: ['marketStats'],
    queryFn: getMarketStats,
  })
}