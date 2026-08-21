import { api } from '@/lib/api'
import type { ApiTradeHistoryResponse } from '@/types'

export function mapApiTrade(trade: any): ApiTrade {
  if (!trade) return trade
  return {
    ...trade,
    amount_in: typeof trade.amount_in === 'number' ? trade.amount_in : Number(trade.amount_in ?? trade.amountIn ?? 0),
    amount_out: typeof trade.amount_out === 'number' ? trade.amount_out : Number(trade.amount_out ?? trade.amountOut ?? 0),
    price_at_execution: typeof trade.price_at_execution === 'number' ? trade.price_at_execution : Number(trade.price_at_execution ?? trade.priceAtExecution ?? 0),
  }
}

export async function getHistory(vaultId: string): Promise<ApiTradeHistoryResponse> {
  const res = await api.get<ApiTradeHistoryResponse | { data?: ApiTradeHistoryResponse }>(`/vaults/${vaultId}/trades`)
  if (res && typeof res === 'object' && 'data' in res && res.data) {
    return res.data
  }
  return res as ApiTradeHistoryResponse
}
