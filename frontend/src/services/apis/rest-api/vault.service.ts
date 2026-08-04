import { api } from '@/lib/api'
import type { Vault } from '@/types'

export function getVaults(): Promise<Vault[]> {
  return api.get('/vaults')
}

export function getVault(id: string): Promise<Vault> {
  return api.get(`/vaults/${id}`)
}

export function createVault(data: Partial<Vault>): Promise<Vault> {
  return api.post('/vaults', data)
}

export function updateVaultMetadata(id: string, metadata: Partial<Vault['metadata']>): Promise<Vault> {
  return api.patch(`/vaults/${id}/metadata`, metadata)
}
