import { api } from '@/lib/api'
import type { ApiFee } from '@/types'

export async function getAccruedFees(vaultId: string): Promise<ApiFee> {
  const res = await api.get<ApiFee | { data?: ApiFee }>(`/vaults/${vaultId}/fees`)
  const payload = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res
  const raw = payload as Record<string, any>
  return {
    vault_id: raw?.vault_id || vaultId,
    accrued_performance_fee: Number(raw?.accrued_performance_fee || 0),
    accrued_management_fee: Number(raw?.accrued_management_fee || 0),
    total_accrued: Number(raw?.total_accrued || 0),
    claimed_amount: Number(raw?.claimed_amount || 0),
    claim_tx_signature: raw?.claim_tx_signature,
    claimed_at: raw?.claimed_at,
    status: raw?.status,
  }
}
