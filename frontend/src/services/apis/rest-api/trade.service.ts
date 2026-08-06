import { api } from '@/lib/api'
import type { ApiTradeHistoryResponse } from '@/types'

export function getHistory(vaultId: string): Promise<ApiTradeHistoryResponse> {
  return api.get(`/vaults/${vaultId}/trades`)
}
