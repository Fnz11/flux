import { api } from '@/lib/api'
import type { ApiTrade, ApiTradeHistoryResponse } from '@/types'

export type RawTradeInput = Partial<ApiTrade> & {
  amountIn?: number | string
  amountOut?: number | string
  priceAtExecution?: number | string
}

export function mapApiTrade(trade: RawTradeInput): ApiTrade {
  if (!trade) return trade as unknown as ApiTrade
  return {
    id: String(trade.id ?? ''),
    vault_id: String(trade.vault_id ?? ''),
    actor_id: String(trade.actor_id ?? ''),
    transaction_signature: String(trade.transaction_signature ?? ''),
    trade_type: (trade.trade_type ?? 'swap') as ApiTrade['trade_type'],
    input_token: String(trade.input_token ?? ''),
    output_token: String(trade.output_token ?? ''),
    executed_at: String(trade.executed_at ?? ''),
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
