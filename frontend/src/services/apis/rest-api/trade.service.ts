import client from '../../../lib/api'
import type { ApiTradeHistoryResponse } from '../../../types'

export function getHistory(vaultId: string): Promise<ApiTradeHistoryResponse> {
  return client.get(`/vaults/${vaultId}/trades`).then((r) => r.data)
}

