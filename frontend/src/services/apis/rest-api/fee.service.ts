import client from '../../../lib/api'
import type { ApiFee } from '../../../types'

export function getAccruedFees(vaultId: string): Promise<ApiFee> {
  return client.get(`/fees/${vaultId}`).then((r) => r.data)
}
