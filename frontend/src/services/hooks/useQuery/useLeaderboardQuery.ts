import { useQuery } from '@tanstack/react-query'
import { getLeaderboard, type LeaderboardType } from '@/services/apis/rest-api/market.service'

export function useLeaderboardQuery(type: LeaderboardType) {
  return useQuery({
    queryKey: ['leaderboard', type],
    queryFn: () => getLeaderboard(type),
  })
}