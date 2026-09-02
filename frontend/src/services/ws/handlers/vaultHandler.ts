import type { WSEventHandler } from './types'
import type { Vault } from '@/types'

export interface VaultPayload {
  vault_id?: string
  tvl?: number | string
  pnl_percent?: number | string
}

interface VaultDelta {
  tvl?: number
  pnlPercent?: number
}

export const vaultHandler: WSEventHandler<VaultPayload> = {
  types: ['vault_portfolio_update', 'vault_update', 'trade_confirmed'],

  handleBatch: (messages, { queryClient }) => {
    const updates = new Map<string, VaultDelta>()

    for (const msg of messages) {
      const data = msg.data
      if (!data?.vault_id) continue

      const current = updates.get(data.vault_id) || {}
      if (data.tvl !== undefined) {
        current.tvl = Number(data.tvl)
      }
      if (data.pnl_percent !== undefined) {
        current.pnlPercent = Number(data.pnl_percent)
      }
      updates.set(data.vault_id, current)
    }

    if (updates.size === 0) return

    queryClient.setQueriesData<Vault[]>({ queryKey: ['vaults'] }, (oldVaults) => {
      if (!oldVaults) return oldVaults
      let changed = false

      const next = oldVaults.map((vault) => {
        const delta = updates.get(vault.address) || (vault.id ? updates.get(vault.id) : undefined)
        if (!delta) return vault

        changed = true
        return {
          ...vault,
          tvl: delta.tvl !== undefined ? delta.tvl : vault.tvl,
          pnlPercent: delta.pnlPercent !== undefined ? delta.pnlPercent : vault.pnlPercent,
        }
      })

      return changed ? next : oldVaults
    })
  },
}
