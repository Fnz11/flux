import { useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, TransactionInstruction, Transaction } from '@solana/web3.js'
import { BN } from 'bn.js'
import { api } from '@/lib/api'
import { getProgram } from '@/lib/anchor'
import { prepareWithdraw, submitTx } from '@/services/apis/rest-api/tx.service'
import {
  buildTransactionWithComputeBudget,
  sendTransaction,
  confirmTransactionHelper,
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
        vaultId,
        amountIn: shareAmount,
        signature: null,
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
        const shareLamports = Math.round(shareAmount * 1e9)

        let signature: string | null = null

        try {
          // 1. Enterprise backend-prepared path
          const prep = await prepareWithdraw({
            investorAddress: userPubkey.toBase58(),
            vaultAddress: vaultPubkey.toBase58(),
            sharesToBurn: shareLamports,
            withdrawMint,
          })

          if (!prep?.transaction) {
            throw new Error('Prepared transaction missing')
          }

          const tx = Transaction.from(Buffer.from(prep.transaction, 'base64'))
          const signedTx = await wallet.signTransaction(tx)
          signature = await connection.sendRawTransaction(signedTx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
          })

          if (prep.draft_id) {
            submitTx({ draftId: prep.draft_id, signature }).catch(() => {})
          }
        } catch {
          // 2. Client-side fallback if backend prepare is unavailable
          const shareBn = new BN(shareLamports)

          const program = await getProgram(
            {
              publicKey: userPubkey,
              signTransaction: wallet.signTransaction,
              signAllTransactions: wallet.signAllTransactions,
            },
            connection,
          )

          if (!program || !program.idl.instructions?.length) {
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
          signature = await sendTransaction(
            connection,
            tx,
            {
              publicKey: wallet.publicKey,
              signTransaction: wallet.signTransaction,
            },
          )
        }

        if (!signature) {
          throw new Error('Withdraw transaction failed: no signature')
        }

        await confirmTransactionHelper(connection, signature, undefined, 'confirmed')

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
        const message = err instanceof Error ? err.message : 'Withdrawal failed'
        updateStatus(txId, 'failed', message)
        throw err
      }
    },
    [wallet, connection, addTransaction, updateStatus],
  )

  return { execute }
}