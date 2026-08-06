import { useQuery } from '@tanstack/react-query'
import { getConfig } from '@/services/apis/rest-api/config.service'

export function useConfigQuery() {
  return useQuery({
    queryKey: ['config'],
    queryFn: getConfig,
  })
}
