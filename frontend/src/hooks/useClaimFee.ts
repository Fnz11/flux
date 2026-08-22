import { useState, useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { useQueryClient } from '@tanstack/react-query'
import { getProgram } from '@/lib/anchor'
import {
  buildTransactionWithComputeBudget,
  sendTransaction,
  confirmTransactionHelper,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@/lib/transactions'
import { toastError, toastSuccess, toastInfo } from '@/lib/toast'
import { formatError } from '@/lib/errors'
import type { Vault, ApiFee } from '@/types'

const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112')

function isUserCancellation(err: unknown): boolean {
  if (!err) return false
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
  return (
    msg.includes('user rejected') ||
    msg.includes('user cancelled') ||
    msg.includes('cancelled') ||
    msg.includes('rejected')
  )
}

export function useClaimFee() {
  const queryClient = useQueryClient()
  const { connection } = useConnection()
  const wallet = useWallet()
  const [isClaiming, setIsClaiming] = useState(false)
  const [claimingVaultId, setClaimingVaultId] = useState<string | null>(null)

  const buildClaimInstructions = async (
    vault: Vault,
    program: any,
    userPubkey: PublicKey,
    createdAtas: Set<string>,
  ): Promise<TransactionInstruction[]> => {
    let vaultPubkey: PublicKey
    try {
      vaultPubkey = new PublicKey(vault.address || vault.id)
    } catch {
      throw new Error(`Invalid vault address: ${vault.address || vault.id}`)
    }

    const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('vault_authority'), vaultPubkey.toBuffer()],
      program.programId,
    )

    let vaultAccount: {
      depositMint?: PublicKey
      accruedPerformanceFee?: any
      accruedManagementFee?: any
      accrued_performance_fee?: any
      accrued_management_fee?: any
    } | null = null
    try {
      vaultAccount = await program.account.vaultState.fetch(vaultPubkey)
    } catch {
      try {
        vaultAccount = await program.account.vault.fetch(vaultPubkey)
      } catch {}
    }

    if (!vaultAccount) {
      throw new Error(`Vault "${vault.metadata?.displayName || vault.id}" is not initialized on Solana blockchain.`)
    }

    const perfBn = vaultAccount.accruedPerformanceFee ?? vaultAccount.accrued_performance_fee ?? 0
    const mgmtBn = vaultAccount.accruedManagementFee ?? vaultAccount.accrued_management_fee ?? 0
    const perf = typeof perfBn === 'object' && perfBn.toNumber ? perfBn.toNumber() : Number(perfBn)
    const mgmt = typeof mgmtBn === 'object' && mgmtBn.toNumber ? mgmtBn.toNumber() : Number(mgmtBn)
    if (perf + mgmt <= 0) {
      throw new Error(`On-chain accrued fees are 0 for "${vault.metadata?.displayName || 'Vault'}".`)
    }

    const tokenMintPubkey = vaultAccount.depositMint || NATIVE_MINT

    const managerTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      userPubkey,
    )

    const vaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      vaultAuthorityPda,
      true,
    )

    const ixs: TransactionInstruction[] = []
    const ataKey = managerTokenAccount.toBase58()

    if (!createdAtas.has(ataKey)) {
      const ataInfo = await connection.getAccountInfo(managerTokenAccount).catch(() => null)
      if (!ataInfo) {
        ixs.push(
          createAssociatedTokenAccountInstruction(
            userPubkey,
            managerTokenAccount,
            userPubkey,
            tokenMintPubkey,
          ),
        )
        createdAtas.add(ataKey)
      }
    }

    const claimIx = await program.methods
      .collectFees()
      .accounts({
        manager: userPubkey,
        vault: vaultPubkey,
        vaultAuthority: vaultAuthorityPda,
        vaultTokenAccount,
        managerTokenAccount,
        tokenMint: tokenMintPubkey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .instruction()

    ixs.push(claimIx)
    return ixs
  }

  const claimSingleFee = useCallback(
    async (vault: Vault, fee?: ApiFee) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toastInfo('Please connect your wallet first')
        return
      }

      if (fee && fee.total_accrued <= 0) {
        toastInfo('No accrued fees available to claim for this vault')
        return
      }

      const userPubkey = wallet.publicKey
      const userAddr = userPubkey.toBase58()

      if (vault.managerAddress && vault.managerAddress !== userAddr) {
        toastError('Only the vault manager can claim accrued fees')
        return
      }

      setIsClaiming(true)
      setClaimingVaultId(vault.id)

      try {
        const program = await getProgram(
          {
            publicKey: userPubkey,
            signTransaction: wallet.signTransaction,
            signAllTransactions: wallet.signAllTransactions,
          },
          connection,
        )

        if (!program || !program.idl.instructions?.length) {
          throw new Error('Fee claim program unavailable')
        }

        const createdAtas = new Set<string>()
        const ixs = await buildClaimInstructions(vault, program, userPubkey, createdAtas)

        const tx = buildTransactionWithComputeBudget(ixs, 1000, 300000)
        const signature = await sendTransaction(connection, tx, {
          publicKey: userPubkey,
          signTransaction: wallet.signTransaction,
        })

        if (!signature) {
          throw new Error('Transaction rejected or failed to broadcast')
        }

        await confirmTransactionHelper(connection, signature, undefined, 'confirmed')

        toastSuccess(`Successfully claimed fees for ${vault.metadata?.displayName || 'Vault'}!`)
        queryClient.invalidateQueries({ queryKey: ['fees'] })
        queryClient.invalidateQueries({ queryKey: ['vaults'] })
      } catch (err: unknown) {
        if (isUserCancellation(err)) {
          toastInfo('Claim cancelled')
        } else {
          toastError(formatError(err, 'Failed to claim fees'))
        }
      } finally {
        setIsClaiming(false)
        setClaimingVaultId(null)
      }
    },
    [connection, wallet, queryClient],
  )

  const claimAllFees = useCallback(
    async (vaults: Vault[], fees: ApiFee[]) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        toastInfo('Please connect your wallet first')
        return
      }

      const userPubkey = wallet.publicKey
      const userAddr = userPubkey.toBase58()

      const claimableVaults = vaults.filter((v) => {
        const isManager = !v.managerAddress || v.managerAddress === userAddr
        const vaultFee = fees.find((f) => f.vault_id === v.id)
        const hasFee = (vaultFee?.total_accrued ?? 0) > 0
        return isManager && hasFee
      })

      if (claimableVaults.length === 0) {
        toastInfo('No claimable fees found for your managed vaults')
        return
      }

      setIsClaiming(true)

      try {
        const program = await getProgram(
          {
            publicKey: userPubkey,
            signTransaction: wallet.signTransaction,
            signAllTransactions: wallet.signAllTransactions,
          },
          connection,
        )

        if (!program || !program.idl.instructions?.length) {
          throw new Error('Fee claim program unavailable')
        }

        // Batch instructions into a single transaction, skipping uninitialized / zero-balance vaults
        const createdAtas = new Set<string>()
        const allIxs: TransactionInstruction[] = []
        const validVaults: Vault[] = []

        for (const vault of claimableVaults) {
          try {
            const ixs = await buildClaimInstructions(vault, program, userPubkey, createdAtas)
            allIxs.push(...ixs)
            validVaults.push(vault)
          } catch (err) {
            console.warn(`Skipping vault ${vault.metadata?.displayName || vault.id} from Claim All:`, err)
          }
        }

        if (allIxs.length === 0) {
          toastInfo('No on-chain accrued fees ready to claim across your vaults (fees accrue during active trading).')
          return
        }

        const tx = buildTransactionWithComputeBudget(allIxs, 1000, 800000)
        const signature = await sendTransaction(connection, tx, {
          publicKey: userPubkey,
          signTransaction: wallet.signTransaction,
        })

        if (!signature) {
          throw new Error('Transaction rejected')
        }

        await confirmTransactionHelper(connection, signature, undefined, 'confirmed')

        toastSuccess(`Claimed fees for ${validVaults.length} vaults!`)
        queryClient.invalidateQueries({ queryKey: ['fees'] })
        queryClient.invalidateQueries({ queryKey: ['vaults'] })
      } catch (err: unknown) {
        if (isUserCancellation(err)) {
          toastInfo('Claim All cancelled')
        } else {
          toastError(formatError(err, 'Failed to claim all fees'))
        }
      } finally {
        setIsClaiming(false)
        setClaimingVaultId(null)
      }
    },
    [connection, wallet, queryClient],
  )

  return {
    claimSingleFee,
    claimAllFees,
    isClaiming,
    claimingVaultId,
  }
}
