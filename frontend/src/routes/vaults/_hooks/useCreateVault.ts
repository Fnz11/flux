import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Keypair, SystemProgram, SYSVAR_RENT_PUBKEY } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID } from '@solana/spl-token'
import { BN } from '@coral-xyz/anchor'
import { useTransactionStore } from '@/stores'
import { createVault } from '@/services/apis/rest-api/vault.service'
import { getProgram } from '@/lib/anchor'
import { buildTransactionWithComputeBudget, sendTransaction } from '@/lib/transactions'
import { formatError } from '@/lib/errors'

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
  const wallet = useAnchorWallet()
  const { connection } = useConnection()
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const updateStatus = useTransactionStore((s) => s.updateStatus)
  const confirmTransaction = useTransactionStore((s) => s.confirmTransaction)
  const moveToHistory = useTransactionStore((s) => s.moveToHistory)
  const [isPending, setIsPending] = useState(false)

  const handleSubmit = async (data: CreateVaultParams) => {
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

    const lockupPeriodSeconds =
      data.lockupPeriodUnit === 'hours'
        ? data.lockupPeriodValue * 3600
        : data.lockupPeriodValue * 86400

    const performanceFeeBps = Math.round(data.performanceFeePercent * 100)
    const managementFeeBps = Math.round(data.managementFeePercent * 100)

    try {
      updateStatus(txId, 'pending')

      let signature: string | null = null
      let createdVaultPda: PublicKey | null = null

      const program = await getProgram(wallet, connection)
      if (program) {
        const [vaultPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault'), wallet.publicKey.toBuffer()],
          program.programId,
        )
        createdVaultPda = vaultPda

        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault_authority'), vaultPda.toBuffer()],
          program.programId,
        )

        const shareTokenMintKeypair = Keypair.generate()

        const minRaiseLamports = new BN(Math.round(data.minRaiseAmount * 1e9))
        const lockupPeriodSec = new BN(lockupPeriodSeconds)

        const ix = await program.methods
          .initializeVault(
            minRaiseLamports,
            performanceFeeBps,
            managementFeeBps,
            lockupPeriodSec,
          )
          .accounts({
            manager: wallet.publicKey,
            vault: vaultPda,
            shareTokenMint: shareTokenMintKeypair.publicKey,
            vaultAuthority: vaultAuthorityPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .instruction()

        const tx = buildTransactionWithComputeBudget([ix], 1000, 200000)
        tx.feePayer = wallet.publicKey
        const { blockhash } = await connection.getLatestBlockhash()
        tx.recentBlockhash = blockhash

        tx.partialSign(shareTokenMintKeypair)

        signature = await sendTransaction(connection, tx, wallet)
        await connection.confirmTransaction(signature, 'confirmed')
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
          coverImageUrl: data.coverImageUrl,
          vaultType: data.vaultType,
          acceptedAssets: data.acceptedAssets,
          focusAssets: data.acceptedAssets,
          feeWithdrawalPeriod: data.feeWithdrawalPeriod,
          minRaiseUnit: data.minRaiseUnit,
          minInvestment: data.minInvestment,
        },
      } as any)

      moveToHistory(txId)
      navigate({ to: '/vaults' })
    } catch (err) {
      updateStatus(txId, 'failed', formatError(err, 'Vault initialization failed'))
    } finally {
      setIsPending(false)
    }
  }

  return { handleSubmit, isPending }
}
