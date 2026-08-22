import type { WSEventHandler } from './types'
import type { GlobalTransaction, GlobalTransactionsResponse } from '@/services/apis/rest-api/transactions.service'

export interface ActivityPayload {
  id?: string
  vault_id?: string
  vault_name?: string
  action?: string
  trade_type?: string
  symbol?: string
  input_token?: string
  amount?: number | string
  amount_in?: number | string
  signature?: string
  transaction_signature?: string
  wallet?: string
  executed_at?: string
}

export const activityHandler: WSEventHandler<ActivityPayload> = {
  types: ['trade_confirmed'],

  handleBatch: (messages, { queryClient, walletAddress }) => {
    const newTxs: GlobalTransaction[] = []

    for (const msg of messages) {
      const data = msg.data
      if (!data) continue

      newTxs.push({
        id: data.id || `ws-${Date.now()}-${Math.random()}`,
        executedAt: data.executed_at || new Date().toISOString(),
        action: (data.action || data.trade_type || 'swap') as any,
        vaultId: data.vault_id || '',
        vaultName: data.vault_name || 'Active Vault',
        symbol: data.symbol || data.input_token || 'SOL',
        amount: Number(data.amount || data.amount_in || 100),
        transactionSignature: data.signature || data.transaction_signature || '',
        wallet: data.wallet || walletAddress || '',
      })
    }

    if (newTxs.length === 0) return

    queryClient.setQueriesData<GlobalTransactionsResponse>(
      { queryKey: ['transactions'] },
      (old) => {
        if (!old) return old
        return {
          total: old.total + newTxs.length,
          items: [...newTxs, ...(old.items || [])].slice(0, 50),
        }
      }
    )
  },
}
