import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Keypair, SystemProgram } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { BN } from 'bn.js'
import { useTransactionStore } from '@/stores'
import { createVault } from '@/services/apis/rest-api/vault.service'
import { getProgram } from '@/lib/anchor'
import { buildTransactionWithComputeBudget, sendTransaction, confirmTransactionHelper } from '@/lib/transactions'
import { formatError } from '@/lib/errors'
import { toastSuccess, toastError, toastInfo } from '@/lib/toast'

export interface CreateVaultParams {
  vaultType: 'open' | 'closed'
  displayName: string
  description: string
  coverImageUrl?: string
  minRaiseAmount: number
  minRaiseUnit: string
  acceptedAssets: string[]
  minInvestment: number
  lockupPeriodValue: number
  lockupPeriodUnit: 'hours' | 'days'
  managementFeePercent: number
  feeWithdrawalPeriod: string
  performanceFeePercent: number
  agreedToTerms: boolean
}

export function useCreateVault() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const wallet = useAnchorWallet()
  const { connection } = useConnection()
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
    const minRaiseLamports = new BN(Math.round(data.minRaiseAmount * 1e9))
    const lockupPeriodSec = new BN(lockupPeriodSeconds)

    try {
      const shareTokenMintKeypair = Keypair.generate()
      let signature: string | null = null
      let createdVaultPda: PublicKey | null = null

      const program = await getProgram(wallet, connection)
      if (program) {
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), wallet.publicKey.toBuffer(), shareTokenMintKeypair.publicKey.toBuffer()],
          program.programId,
        )
        createdVaultPda = vaultPda

        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault_authority'), vaultPda.toBuffer()],
          program.programId,
        )

        const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112')

        const ix = await program.methods
          .initializeVault(
            minRaiseLamports,
            performanceFeeBps,
            managementFeeBps,
            lockupPeriodSec,
            [NATIVE_MINT, PublicKey.default, PublicKey.default, PublicKey.default],
          )
          .accounts({
            manager: wallet.publicKey,
            vault: vaultPda,
            depositMint: NATIVE_MINT,
            shareTokenMint: shareTokenMintKeypair.publicKey,
            vaultAuthority: vaultAuthorityPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .instruction()

        const tx = buildTransactionWithComputeBudget([ix], 1000, 200000)
        tx.feePayer = wallet.publicKey
        const { blockhash } = await connection.getLatestBlockhash()
        tx.recentBlockhash = blockhash

        tx.partialSign(shareTokenMintKeypair)

        signature = await sendTransaction(connection, tx, wallet)
        await confirmTransactionHelper(connection, signature, undefined, 'confirmed')
      }

      if (!signature) {
        throw new Error('Vault initialization failed: no on-chain signature returned')
      }

      confirmTransaction(txId, signature)

      await createVault({
        address: createdVaultPda ? createdVaultPda.toBase58() : wallet.publicKey.toBase58(),
        managerAddress: wallet.publicKey.toBase58(),
        performanceFeeBps,
        managementFeeBps,
        minRaiseAmount: data.minRaiseAmount,
        lockupPeriod: lockupPeriodSeconds,
        metadata: {
          displayName: data.displayName,
          description: data.description,
          focusAssets: data.acceptedAssets,
        },
      })

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
      toastError(formattedErr)
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
