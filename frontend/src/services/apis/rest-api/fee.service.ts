import { api } from '@/lib/api'
import type { ApiFee } from '@/types'

export function getAccruedFees(vaultId: string): Promise<ApiFee> {
  return api.get(`/fees/${vaultId}`)
}
