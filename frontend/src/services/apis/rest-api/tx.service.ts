import { api } from '@/lib/api'

export interface PrepareCreateVaultParams {
  managerAddress: string
  displayName: string
  description?: string
  coverImageUrl?: string
  focusAssets?: string[]
  tags?: string[]
  minRaiseAmount: number // in lamports
  performanceFeeBps: number
  managementFeeBps: number
  lockupPeriodSec: number
  vaultType: 'open' | 'closed'
  depositMint?: string
}

export interface PrepareDepositParams {
  investorAddress: string
  vaultAddress: string
  amountLamports: number
  depositMint?: string
}

export interface PrepareWithdrawParams {
  investorAddress: string
  vaultAddress: string
  sharesToBurn: number
  withdrawMint?: string
}

export interface PrepareTxResponse {
  draft_id: string
  transaction: string
  vault_address?: string
  share_token_mint?: string
  recent_blockhash: string
  last_valid_block_height: number
  expires_at: string
}

export async function prepareCreateVault(params: PrepareCreateVaultParams): Promise<PrepareTxResponse> {
  const res = await api.post<{ success?: boolean; data?: PrepareTxResponse } | PrepareTxResponse>('/tx/prepare/create-vault', {
    manager_address: params.managerAddress,
    display_name: params.displayName,
    description: params.description ?? '',
    cover_image_url: params.coverImageUrl ?? '',
    focus_assets: params.focusAssets,
    tags: params.tags,
    min_raise_amount: params.minRaiseAmount,
    performance_fee_bps: params.performanceFeeBps,
    management_fee_bps: params.managementFeeBps,
    lockup_period_sec: params.lockupPeriodSec,
    vault_type: params.vaultType,
    deposit_mint: params.depositMint,
  })
  return (res as { data?: PrepareTxResponse }).data ?? (res as PrepareTxResponse)
}

export async function prepareDeposit(params: PrepareDepositParams): Promise<PrepareTxResponse> {
  const res = await api.post<{ success?: boolean; data?: PrepareTxResponse } | PrepareTxResponse>('/tx/prepare/deposit', {
    investor_address: params.investorAddress,
    vault_address: params.vaultAddress,
    amount_lamports: params.amountLamports,
    deposit_mint: params.depositMint,
  })
  return (res as { data?: PrepareTxResponse }).data ?? (res as PrepareTxResponse)
}

export async function prepareWithdraw(params: PrepareWithdrawParams): Promise<PrepareTxResponse> {
  const res = await api.post<{ success?: boolean; data?: PrepareTxResponse } | PrepareTxResponse>('/tx/prepare/withdraw', {
    investor_address: params.investorAddress,
    vault_address: params.vaultAddress,
    shares_to_burn: params.sharesToBurn,
    withdraw_mint: params.withdrawMint,
  })
  return (res as { data?: PrepareTxResponse }).data ?? (res as PrepareTxResponse)
}

export async function submitTx(params: { draftId: string; signature: string }): Promise<{ draft_id: string; signature: string; status: string }> {
  let lastErr: unknown
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await api.post<{ success?: boolean; data?: { draft_id: string; signature: string; status: string } } | { draft_id: string; signature: string; status: string }>('/tx/submit', {
        draft_id: params.draftId,
        signature: params.signature,
      })
      return (res as { data?: { draft_id: string; signature: string; status: string } }).data ?? (res as { draft_id: string; signature: string; status: string })
    } catch (err) {
      lastErr = err
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
    }
  }
  throw lastErr
}
