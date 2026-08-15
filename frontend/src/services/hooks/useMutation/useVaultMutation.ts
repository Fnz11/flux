import { useMutation, useQueryClient } from '@tanstack/react-query'
import { updateVaultMetadata } from '@/services/apis/rest-api/vault.service'
import type { VaultMetadata } from '@/types'

export function useUpdateVaultMetadataMutation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, metadata }: { id: string; metadata: Partial<VaultMetadata> }) =>
      updateVaultMetadata(id, metadata),
    onSuccess: (updatedVault) => {
      queryClient.invalidateQueries({ queryKey: ['vaults'] })
      queryClient.invalidateQueries({ queryKey: ['infiniteVaults'] })
      queryClient.invalidateQueries({ queryKey: ['vault', updatedVault.id] })
    },
  })
}
