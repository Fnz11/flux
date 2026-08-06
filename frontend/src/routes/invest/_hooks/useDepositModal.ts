import { useState } from 'react'
import { useDeposit } from '@/hooks/useDeposit'
import { useVaultsQuery } from '@/services/hooks/useQuery/useVaultsQuery'
import { TOKENS as ALL_TOKENS } from '@/constants/tokens'

const DEPOSIT_SYMBOLS = new Set(['SOL', 'USDC'])
export const TOKENS = ALL_TOKENS.filter((t) => DEPOSIT_SYMBOLS.has(t.symbol))

export function useDepositModal(vaultId: string) {
  const { execute } = useDeposit()
  const { data: vaults = [] } = useVaultsQuery()
  const vault = vaults.find((v) => v.id === vaultId)

  const [step, setStep] = useState(0)
  const [selectedToken, setSelectedToken] = useState(TOKENS[0])
  const [amount, setAmount] = useState('')
  const [signature, setSignature] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

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

  return { step, selectedToken, amount, signature, loading, handleConfirm, handleClose, setStep, setSelectedToken, setAmount, vault }
}
