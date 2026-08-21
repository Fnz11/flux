import { api } from '@/lib/api'
import type { ApiFee } from '@/types'

export async function getAccruedFees(vaultId: string): Promise<ApiFee> {
  const res = await api.get<ApiFee | { data?: ApiFee }>(`/fees/${vaultId}`)
  const payload = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res
  return payload as ApiFee
}
