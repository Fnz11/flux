import { useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, VersionedTransaction, SystemProgram } from '@solana/web3.js'
import { Program, BN, type Idl } from '@coral-xyz/anchor'
import { useTransactionStore } from '@/stores'

interface WithdrawParams {
  vaultAddress: string
  shareAmount: number
  vaultId: string
}

export function useWithdraw() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const updateStatus = useTransactionStore((s) => s.updateStatus)

  const execute = useCallback(
    async ({ vaultAddress, shareAmount, vaultId }: WithdrawParams) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected')
      }

      const txId = addTransaction({
        type: 'withdraw',
        signature: null,
        vaultId,
        amountIn: shareAmount,
        errorMessage: null,
      })

      try {
        updateStatus(txId, 'pending')

        const vaultPubkey = new PublicKey(vaultAddress)
        const userPubkey = wallet.publicKey
        const shareBn = new BN(Math.round(shareAmount * 1e9))

        const program = new Program({} as Idl, {
          connection,
          wallet: {
            publicKey: userPubkey,
            signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => wallet.signTransaction!(tx),
            signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => wallet.signAllTransactions!(txs),
          },
        })

        const ix = await program.methods
          .withdraw(shareBn)
          .accounts({
            vault: vaultPubkey,
            user: userPubkey,
            systemProgram: SystemProgram.programId,
          })
          .instruction()

        const tx = new Transaction().add(ix)
        tx.feePayer = userPubkey
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

        const signed = await wallet.signTransaction(tx)
        const signature = await connection.sendRawTransaction(signed.serialize())

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
