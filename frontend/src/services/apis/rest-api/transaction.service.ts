import { api } from '@/lib/api'

export interface SimulateTransactionParams {
  vaultId: string
  amount: number
  tokenMint: string
  userPubkey: string
  action: 'deposit' | 'withdraw'
}

export interface SimulateTransactionResponse {
  signature: string
  explorerUrl?: string
  status?: string
}

export async function simulateTransaction(params: SimulateTransactionParams): Promise<SimulateTransactionResponse> {
  return api.post<SimulateTransactionResponse>('/transactions/simulate', params)
}
