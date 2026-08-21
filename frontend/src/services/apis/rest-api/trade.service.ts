import { api } from '@/lib/api'
import type { ApiTradeHistoryResponse } from '@/types'

export async function getHistory(vaultId: string): Promise<ApiTradeHistoryResponse> {
  const res = await api.get<ApiTradeHistoryResponse | { data?: ApiTradeHistoryResponse }>(`/vaults/${vaultId}/trades`)
  if (res && typeof res === 'object' && 'data' in res && res.data) {
    return res.data
  }
  return res as ApiTradeHistoryResponse
}
