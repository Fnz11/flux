import { useState, useMemo, useEffect } from 'react'
import { useDeposit } from '@/hooks/useDeposit'
import { useVaultsQuery, useVaultDetailQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { TOKENS as ALL_TOKENS, getTokenMeta, type TokenInfo } from '@/constants/tokens'
import type { Vault } from '@/types'

export const TOKENS = ALL_TOKENS

export function getSupportedDepositTokens(vault?: Vault): TokenInfo[] {
  const depositMint =
    (vault?.metadata as any)?.depositMint ||
    (vault as unknown as { deposit_mint?: string })?.deposit_mint ||
    (vault as unknown as { depositMint?: string })?.depositMint
  if (depositMint) {
    const meta = getTokenMeta(depositMint)
    if (meta.mint) return [meta]
  }
  const focus = vault?.metadata?.focusAssets || []
  if (focus.length > 0 && !focus.includes('All')) {
    const matched = focus
      .map((sym) => getTokenMeta(sym))
      .filter((t) => Boolean(t.mint))
    if (matched.length > 0) return matched
  }
  return ALL_TOKENS
}

export function useDepositModal(vaultId: string) {
  const { execute } = useDeposit()
  const { data: vaultDetail } = useVaultDetailQuery(vaultId)
  const { data: vaults = [] } = useVaultsQuery()
  const vault = vaultDetail || vaults.find((v) => v.id === vaultId || v.address === vaultId)

  const availableTokens = useMemo(() => getSupportedDepositTokens(vault), [vault])

  const [step, setStep] = useState(0)
  const [selectedToken, setSelectedToken] = useState<TokenInfo>(availableTokens[0] || ALL_TOKENS[0])
  const [amount, setAmount] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Keep selectedToken in sync with availableTokens when vault loads/changes
  useEffect(() => {
    if (availableTokens.length > 0) {
      setSelectedToken((current) => {
        const stillValid = availableTokens.some((t) => t.symbol === current.symbol || t.mint === current.mint)
        return stillValid ? current : availableTokens[0]
      })
    }
  }, [availableTokens])

  const handleConfirm = async () => {
    if (!vault || !amount) return
    setLoading(true)
    try {
      const sig = await execute({
        vaultAddress: vault.address,
        tokenMint: selectedToken.mint,
        amount: Number(amount),
        vaultId,
      })
      setSignature(sig)
      setStep(2)
    } catch {
      // error handled by store
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setStep(0)
    setAmount('')
    setSignature(null)
  }

  return {
    step,
    selectedToken,
    amount,
    signature,
    loading,
    availableTokens,
    handleConfirm,
    handleClose,
    setStep,
    setSelectedToken,
    setAmount,
    vault,
  }
}
