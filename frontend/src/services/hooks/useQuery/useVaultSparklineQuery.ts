import { useQuery } from '@tanstack/react-query'
import { getVaultSparkline, type VaultSparklineRange } from '@/services/apis/rest-api/vault_sparkline.service'

export function useVaultSparklineQuery(vaultId: string, range: VaultSparklineRange = '30d') {
  return useQuery({
    queryKey: ['vaultSparkline', vaultId, range],
    queryFn: () => getVaultSparkline(vaultId, range),
    enabled: Boolean(vaultId),
    select: (points) => points.map((point) => point.value),
  })
}