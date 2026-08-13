import { useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, TransactionInstruction } from '@solana/web3.js'
import { BN } from 'bn.js'
import { api } from '@/lib/api'
import { getProgram } from '@/lib/anchor'
import {
  buildTransactionWithComputeBudget,
  sendTransaction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  TOKEN_PROGRAM_ID,
} from '@/lib/transactions'
import { useTransactionStore } from '@/stores'

interface WithdrawParams {
  vaultAddress: string
  shareAmount: number
  vaultId: string
  withdrawMint?: string
}

const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112')

export function useWithdraw() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const updateStatus = useTransactionStore((s) => s.updateStatus)

  const execute = useCallback(
    async ({ vaultAddress, shareAmount, vaultId, withdrawMint }: WithdrawParams) => {
      const txId = addTransaction({
        type: 'withdraw',
        signature: null,
        vaultId,
        amountIn: shareAmount,
        errorMessage: null,
      })

      try {
        updateStatus(txId, 'pending')

        if (!wallet.publicKey || !wallet.signTransaction) {
          throw new Error('Wallet not connected')
        }

        if (!vaultAddress) {
          throw new Error('Vault address is required')
        }
        let vaultPubkey: PublicKey
        try {
          vaultPubkey = new PublicKey(vaultAddress)
        } catch {
          throw new Error(`Invalid vault address: ${vaultAddress}`)
        }

        const userPubkey = wallet.publicKey
        const shareBn = new BN(Math.round(shareAmount * 1e9))

        const program = await getProgram(
          {
            publicKey: userPubkey,
            signTransaction: wallet.signTransaction as any,
            signAllTransactions: wallet.signAllTransactions as any,
          },
          connection,
        )

        if (!program || !(program.idl as any)?.instructions?.length) {
          throw new Error('Withdraw program unavailable')
        }

        const withdrawMintPubkey = withdrawMint ? new PublicKey(withdrawMint) : NATIVE_MINT

        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault_authority'), vaultPubkey.toBuffer()],
          program.programId,
        )

        const [shareTokenMintPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from('share_mint'), vaultPubkey.toBuffer()],
          program.programId,
        )

        const investorTokenAccount = getAssociatedTokenAddressSync(
          withdrawMintPubkey,
          userPubkey,
        )

        const vaultTokenAccount = getAssociatedTokenAddressSync(
          withdrawMintPubkey,
          vaultAuthorityPda,
          true,
        )

        const investorShareAccount = getAssociatedTokenAddressSync(
          shareTokenMintPubkey,
          userPubkey,
        )

        const ixs: TransactionInstruction[] = []

        // Check and create investor token ATA if missing
        const investorAtaInfo = await connection.getAccountInfo(investorTokenAccount)
        if (!investorAtaInfo) {
          ixs.push(
            createAssociatedTokenAccountInstruction(
              userPubkey,
              investorTokenAccount,
              userPubkey,
              withdrawMintPubkey,
            ),
          )
        }

        const withdrawIx = await program.methods
          .withdraw(shareBn)
          .accounts({
            investor: userPubkey,
            vault: vaultPubkey,
            vaultAuthority: vaultAuthorityPda,
            investorTokenAccount,
            withdrawMint: withdrawMintPubkey,
            vaultTokenAccount,
            shareTokenMint: shareTokenMintPubkey,
            investorShareAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction()

        ixs.push(withdrawIx)

        const tx = buildTransactionWithComputeBudget(ixs, 1000, 200000)
        const signature = await sendTransaction(
          connection,
          tx,
          wallet as any,
        )
        await connection.confirmTransaction(signature, 'confirmed')

        try {
          await api.post('/trades/sync', {
            signature,
            vault_id: vaultId || vaultPubkey.toBase58(),
          })
        } catch (syncErr) {
          console.warn('Failed to sync withdraw transaction to backend:', syncErr)
        }

        updateStatus(txId, 'success')
        return signature
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Withdraw failed'
        updateStatus(txId, 'failed', message)
        throw err
      }
    },
    [wallet, connection, addTransaction, updateStatus],
  )

  return { execute }
}