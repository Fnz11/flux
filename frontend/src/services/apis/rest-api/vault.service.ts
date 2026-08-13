import { api } from '@/lib/api'
import { mapApiVaultToVault } from '@/lib/mappers'
import type { Vault } from '@/types'

export interface GetVaultsParams {
  status?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  managerAddress?: string
}

export async function getVaults(params?: GetVaultsParams): Promise<Vault[]> {
  const queryParams = new URLSearchParams()
  if (params?.status && params.status !== 'All') {
    queryParams.set('status', params.status)
  }
  if (params?.sortBy) {
    queryParams.set('sort_by', params.sortBy)
  }
  if (params?.sortOrder) {
    queryParams.set('sort_order', params.sortOrder)
  }
  if (params?.managerAddress) {
    queryParams.set('manager_address', params.managerAddress)
  }

  const queryString = queryParams.toString()
  const url = `/vaults${queryString ? `?${queryString}` : ''}`
  const res = await api.get<any>(url)

  let vaults: any[] = []
  if (Array.isArray(res)) {
    vaults = res
  } else if (Array.isArray(res?.data?.items)) {
    vaults = res.data.items
  } else if (Array.isArray(res?.data)) {
    vaults = res.data
  } else if (Array.isArray(res?.vaults)) {
    vaults = res.vaults
  }

  return vaults.map(mapApiVaultToVault)
}

export async function getVault(id: string): Promise<Vault> {
  const raw = await api.get(`/vaults/${id}`)
  return mapApiVaultToVault(raw)
}

export async function createVault(data: Partial<Vault>): Promise<Vault> {
  const raw = await api.post('/vaults', data)
  return mapApiVaultToVault(raw)
}

export async function updateVaultMetadata(id: string, metadata: Partial<Vault['metadata']>): Promise<Vault> {
  const raw = await api.patch(`/vaults/${id}`, metadata)
  return mapApiVaultToVault(raw)
}

export interface VaultBalance {
  mint: string
  symbol: string
  amount: number
  usdValue: number
}

export interface VaultBalancesResponse {
  balances: VaultBalance[]
}

export async function getVaultBalances(vaultId: string): Promise<VaultBalance[]> {
  const res = await api.get<VaultBalancesResponse | VaultBalance[]>(`/vaults/${vaultId}/balances`)
  if (Array.isArray(res)) return res
  if (res && Array.isArray(res.balances)) return res.balances
  return []
}

