import { useQuery } from '@tanstack/react-query'
import { getVaults, getVault, getVaultBalances, type GetVaultsParams } from '@/services/apis/rest-api/vault.service'

export function useVaultsQuery(params?: GetVaultsParams) {
  return useQuery({
    queryKey: ['vaults', params],
    queryFn: () => getVaults(params),
  })
}

export function useVaultDetailQuery(id: string) {
  return useQuery({
    queryKey: ['vault', id],
    queryFn: () => getVault(id),
    enabled: Boolean(id),
  })
}

export function useVaultBalancesQuery(vaultId: string) {
  return useQuery({
    queryKey: ['vaultBalances', vaultId],
    queryFn: () => getVaultBalances(vaultId),
    enabled: Boolean(vaultId),
  })
}

