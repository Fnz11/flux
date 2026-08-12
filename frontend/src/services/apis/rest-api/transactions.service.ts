import { api } from '@/lib/api'

export type GlobalTransactionAction = 'deposit' | 'withdraw' | 'swap'

export interface GlobalTransactionParams {
  page?: number
  limit?: number
  type?: string
  wallet?: string
}

export interface GlobalTransaction {
  id: string
  executedAt: string
  action: GlobalTransactionAction
  vaultId: string
  vaultName: string
  symbol: string
  amount: number
  transactionSignature: string
  wallet: string
}

export interface GlobalTransactionsResponse {
  items: GlobalTransaction[]
  total: number
}

interface ApiGlobalTransaction {
  id: string
  executed_at: string
  action: GlobalTransactionAction
  vault_id: string
  vault_name: string
  symbol: string
  amount: number
  transaction_signature: string
  wallet: string
}

interface ApiGlobalTransactionsEnvelope {
  data?: {
    items?: ApiGlobalTransaction[]
    total?: number
  }
}

function mapApiGlobalTransaction(item: ApiGlobalTransaction): GlobalTransaction {
  return {
    id: item.id,
    executedAt: item.executed_at,
    action: item.action,
    vaultId: item.vault_id,
    vaultName: item.vault_name,
    symbol: item.symbol,
    amount: Number(item.amount),
    transactionSignature: item.transaction_signature,
    wallet: item.wallet,
  }
}

export async function getGlobalTransactions(params: GlobalTransactionParams = {}): Promise<GlobalTransactionsResponse> {
  const res = await api.get<ApiGlobalTransactionsEnvelope>('/transactions', params)
  return {
    items: (res.data?.items ?? []).map(mapApiGlobalTransaction),
    total: res.data?.total ?? 0,
  }
}