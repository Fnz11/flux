import { api } from '@/lib/api'

export type VaultSparklineRange = '7d' | '30d' | '90d'

export interface VaultSparklinePoint {
  date: string
  value: number
}

export interface VaultSparklineResponse {
  vault_id: string
  range: string
  points: VaultSparklinePoint[]
}

export async function getVaultSparkline(
  vaultId: string,
  range: VaultSparklineRange = '30d',
): Promise<VaultSparklinePoint[]> {
  const res = await api.get<{ data?: VaultSparklineResponse } & Partial<VaultSparklineResponse>>(
    `/vaults/${vaultId}/sparkline`,
    { range, resolution: 'day' },
  )
  const payload = (res as { data?: VaultSparklineResponse }).data ?? (res as Partial<VaultSparklineResponse>)
  const points = payload?.points ?? []
  return points.map((point) => ({ date: point.date, value: Number(point.value) }))
}