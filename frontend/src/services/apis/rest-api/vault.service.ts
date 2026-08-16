import { api } from '@/lib/api'
import { mapApiVaultToVault, type RawApiVault } from '@/lib/mappers'
import type { Vault } from '@/types'

export interface GetVaultsParams {
  status?: string
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  managerAddress?: string
  page?: number
  limit?: number
}

export interface PaginatedVaults {
  vaults: Vault[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

export async function getPaginatedVaults(params?: GetVaultsParams): Promise<PaginatedVaults> {
  const queryParams = new URLSearchParams()
  if (params?.status && params.status !== 'All') {
    queryParams.set('status', params.status)
  }
  if (params?.search) {
    queryParams.set('search', params.search)
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
  if (params?.page) {
    queryParams.set('page', params.page.toString())
  }
  if (params?.limit) {
    queryParams.set('limit', params.limit.toString())
  }

  const queryString = queryParams.toString()
  const url = `/vaults${queryString ? `?${queryString}` : ''}`
  const res = await api.get<
    | RawApiVault[]
    | { vaults?: RawApiVault[]; items?: RawApiVault[]; total?: number; data?: { items?: RawApiVault[]; total?: number } | RawApiVault[] }
  >(url)

  let rawVaults: RawApiVault[] = []
  let total = 0
  const page = params?.page ?? 1
  const limit = params?.limit ?? 20

  if (Array.isArray(res)) {
    rawVaults = res
    total = res.length
  } else if (res && typeof res === 'object') {
    if ('data' in res && res.data && typeof res.data === 'object') {
      if ('items' in res.data && Array.isArray(res.data.items)) {
        rawVaults = res.data.items
        total = res.data.total ?? rawVaults.length
      } else if (Array.isArray(res.data)) {
        rawVaults = res.data
        total = res.total ?? rawVaults.length
      }
    } else if ('vaults' in res && Array.isArray(res.vaults)) {
      rawVaults = res.vaults
      total = res.total ?? rawVaults.length
    } else if ('items' in res && Array.isArray(res.items)) {
      rawVaults = res.items
      total = res.total ?? rawVaults.length
    }
  }

  const vaults = rawVaults.map(mapApiVaultToVault)
  const hasMore = vaults.length === limit && page * limit < total

  return {
    vaults,
    total,
    page,
    limit,
    hasMore,
  }
}

export async function getVaults(params?: GetVaultsParams): Promise<Vault[]> {
  const result = await getPaginatedVaults(params)
  return result.vaults
}

export async function getVault(id: string): Promise<Vault> {
  const raw = await api.get<RawApiVault | { data?: { vault?: RawApiVault } | RawApiVault; vault?: RawApiVault }>(`/vaults/${id}`)
  let vaultObj: RawApiVault | undefined
  if (raw && typeof raw === 'object') {
    if ('data' in raw && raw.data) {
      if (typeof raw.data === 'object' && 'vault' in raw.data && raw.data.vault) {
        vaultObj = raw.data.vault as RawApiVault
      } else {
        vaultObj = raw.data as RawApiVault
      }
    } else if ('vault' in raw && raw.vault) {
      vaultObj = raw.vault
    } else {
      vaultObj = raw as RawApiVault
    }
  }
  return mapApiVaultToVault(vaultObj)
}

export async function createVault(data: Partial<Vault>): Promise<Vault> {
  const raw = await api.post<RawApiVault | { data?: RawApiVault } | { vault?: RawApiVault }>('/vaults', data)
  let vaultObj: RawApiVault | undefined
  if (raw && typeof raw === 'object') {
    if ('data' in raw && raw.data) {
      vaultObj = raw.data as RawApiVault
    } else if ('vault' in raw && raw.vault) {
      vaultObj = raw.vault
    } else {
      vaultObj = raw as RawApiVault
    }
  }
  return mapApiVaultToVault(vaultObj)
}

export async function updateVaultMetadata(id: string, metadata: Partial<Vault['metadata']>): Promise<Vault> {
  const raw = await api.patch<RawApiVault | { data?: { vault?: RawApiVault } | RawApiVault; vault?: RawApiVault }>(`/vaults/${id}`, metadata)
  let vaultObj: RawApiVault | undefined
  if (raw && typeof raw === 'object') {
    if ('data' in raw && raw.data) {
      if (typeof raw.data === 'object' && 'vault' in raw.data && raw.data.vault) {
        vaultObj = raw.data.vault as RawApiVault
      } else {
        vaultObj = raw.data as RawApiVault
      }
    } else if ('vault' in raw && raw.vault) {
      vaultObj = raw.vault
    } else {
      vaultObj = raw as RawApiVault
    }
  }
  return mapApiVaultToVault(vaultObj)
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
  const res = await api.get<any>(`/vaults/${vaultId}/balances`)
  let balances: any[] = []
  
  if (Array.isArray(res)) balances = res
  else if (res && Array.isArray(res.balances)) balances = res.balances
  else if (res && res.data && Array.isArray(res.data.balances)) balances = res.data.balances

  return balances.map((b: any) => ({
    ...b,
    amount: Number(b.amount || 0),
    usdValue: Number(b.usdValue || 0),
  }))
}
