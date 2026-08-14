import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { Transaction } from '@solana/web3.js'
import { useTransactionStore } from '@/stores'
import { prepareCreateVault, submitTx } from '@/services/apis/rest-api/tx.service'
import { confirmTransactionHelper } from '@/lib/transactions'
import { formatError } from '@/lib/errors'
import { toastSuccess, toastInfo } from '@/lib/toast'

export interface CreateVaultParams {
  vaultType: 'open' | 'closed'
  displayName: string
  description: string
  coverImageUrl?: string
  focusAssets?: string[]
  tags?: string[]
  minRaiseAmount: number
  performanceFeePercent: number
  managementFeePercent: number
  lockupPeriodValue: number
  lockupPeriodUnit: 'hours' | 'days'
  acceptedAssets?: string[]
}

export function useCreateVault() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { connection } = useConnection()
  const wallet = useAnchorWallet()
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const updateStatus = useTransactionStore((s) => s.updateStatus)
  const confirmTransaction = useTransactionStore((s) => s.confirmTransaction)
  const moveToHistory = useTransactionStore((s) => s.moveToHistory)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (data: CreateVaultParams) => {
    if (!wallet) {
      toastInfo('Please connect your wallet first')
      return
    }
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

    const lockupPeriodSeconds =
      data.lockupPeriodUnit === 'hours'
        ? data.lockupPeriodValue * 3600
        : data.lockupPeriodValue * 86400

    const performanceFeeBps = Math.round(data.performanceFeePercent * 100)
    const managementFeeBps = Math.round(data.managementFeePercent * 100)
    const minRaiseLamports = Math.round(data.minRaiseAmount * 1e9)

    try {
      // 1. Ask backend to build and simulate transaction
      const prep = await prepareCreateVault({
        managerAddress: wallet.publicKey.toBase58(),
        displayName: data.displayName,
        description: data.description,
        coverImageUrl: data.coverImageUrl,
        focusAssets: data.focusAssets,
        tags: data.tags,
        minRaiseAmount: minRaiseLamports,
        performanceFeeBps,
        managementFeeBps,
        lockupPeriodSec: lockupPeriodSeconds,
        vaultType: data.vaultType,
      })

      if (!prep?.transaction) {
        throw new Error('Backend did not return prepared transaction')
      }

      // 2. Deserialize partially signed transaction
      const tx = Transaction.from(Buffer.from(prep.transaction, 'base64'))

      // 3. User signs with wallet adapter
      const signedTx = await wallet.signTransaction(tx)

      // 4. Broadcast raw transaction to Solana cluster
      const rawTx = signedTx.serialize()
      const signature = await connection.sendRawTransaction(rawTx, {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
      })

      // 5. Submit signature to backend draft reconciler
      if (prep.draft_id) {
        submitTx({ draftId: prep.draft_id, signature }).catch(() => {})
      }

      // 6. Await on-chain confirmation
      await confirmTransactionHelper(connection, signature, undefined, 'confirmed')

      confirmTransaction(txId, signature)
      moveToHistory(txId)
      await queryClient.invalidateQueries({ queryKey: ['vaults'] })
      toastSuccess('Vault created successfully!')
      navigate({ to: '/vaults' })
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'logs' in err) {
        console.error('Transaction simulation logs:', (err as { logs?: unknown }).logs)
      }
      const formattedErr = formatError(err, 'Vault initialization failed')
      updateStatus(txId, 'failed', formattedErr)
    } finally {
      setIsPending(false)
    }
  }

  return {
    handleSubmit,
    handleCreateVault: handleSubmit,
    isPending,
  }
}
