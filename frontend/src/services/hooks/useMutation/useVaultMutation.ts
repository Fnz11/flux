import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createVault, updateVaultMetadata } from '@/services/apis/rest-api/vault.service'
import type { Vault, VaultMetadata } from '@/types'

export function useCreateVaultMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: Partial<Vault>) => createVault(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vaults'] })
    },
  })
}

export function useUpdateVaultMetadataMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, metadata }: { id: string; metadata: Partial<VaultMetadata> }) =>
      updateVaultMetadata(id, metadata),
    onSuccess: (updatedVault) => {
      queryClient.invalidateQueries({ queryKey: ['vaults'] })
      queryClient.invalidateQueries({ queryKey: ['vault', updatedVault.id] })
    },
  })
}
