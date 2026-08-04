import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { useTransactionStore } from '@/stores'
import { createVault } from '@/services/apis/rest-api/vault.service'
import { getProgram } from '@/lib/anchor'
import { sendTransaction } from '@/lib/transactions'
import { formatError } from '@/lib/errors'

export function useCreateVault() {
  const navigate = useNavigate()
  const wallet = useAnchorWallet()
  const { connection } = useConnection()
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const updateStatus = useTransactionStore((s) => s.updateStatus)
  const confirmTransaction = useTransactionStore((s) => s.confirmTransaction)
  const moveToHistory = useTransactionStore((s) => s.moveToHistory)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (data: {
    minRaiseAmount: number
    performanceFee: number
    managementFee: number
    lockupPeriod: number
  }) => {
    if (!wallet) return
    setIsPending(true)

    const txId = addTransaction({
      type: 'deposit',
      vaultId: null,
      signature: null,
      errorMessage: null,
      inputToken: undefined,
      outputToken: undefined,
      amountIn: undefined,
      amountOut: undefined,
    })

    try {
      updateStatus(txId, 'pending')

      const program = await getProgram(wallet, connection)
      const vaultAddress = wallet.publicKey

      const tx = await program.methods
        .initializeVault(
          data.minRaiseAmount,
          data.performanceFee,
          data.managementFee,
          data.lockupPeriod,
        )
        .accounts({
          manager: wallet.publicKey,
          vault: vaultAddress,
          systemProgram: '11111111111111111111111111111111',
        })
        .transaction()

      const signature = await sendTransaction(connection, tx, wallet)
      await connection.confirmTransaction(signature, 'confirmed')
      confirmTransaction(txId, signature)

      await createVault({
        address: vaultAddress.toBase58(),
        managerAddress: wallet.publicKey.toBase58(),
        performanceFeeBps: data.performanceFee,
        managementFeeBps: data.managementFee,
      })

      moveToHistory(txId)
      navigate({ to: '/vaults' })
    } catch (err) {
      updateStatus(txId, 'failed', formatError(err, 'Transaction failed'))
    } finally {
      setIsPending(false)
    }
  }

  return { handleSubmit, isPending }
}
