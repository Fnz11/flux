import { useQuery } from '@tanstack/react-query'
import { getAccruedFees } from '@/services/apis/rest-api/fee.service'

export function useFeeQuery(vaultId: string) {
  return useQuery({
    queryKey: ['fees', vaultId],
    queryFn: () => getAccruedFees(vaultId),
    enabled: Boolean(vaultId),
  })
}
