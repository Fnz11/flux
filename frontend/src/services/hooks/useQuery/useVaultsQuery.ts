import { useQuery, useInfiniteQuery } from '@tanstack/react-query'
import { getVaults, getPaginatedVaults, getVault, getVaultBalances, type GetVaultsParams, type PaginatedVaults } from '@/services/apis/rest-api/vault.service'

export function useVaultsQuery(params?: GetVaultsParams) {
  return useQuery({
    queryKey: ['vaults', params],
    queryFn: () => getVaults(params),
  })
}

export function useInfiniteVaultsQuery(params?: Omit<GetVaultsParams, 'page'>, pageSize: number = 20) {
  return useInfiniteQuery<PaginatedVaults>({
    queryKey: ['infiniteVaults', params, pageSize],
    queryFn: ({ pageParam = 1 }) =>
      getPaginatedVaults({ ...params, page: pageParam as number, limit: pageSize }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.hasMore && allPages.length * pageSize >= lastPage.total) {
        return undefined
      }
      if (lastPage.vaults.length < pageSize) {
        return undefined
      }
      return allPages.length + 1
    },
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

