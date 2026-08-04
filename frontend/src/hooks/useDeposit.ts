import { useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, Transaction, VersionedTransaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js'
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from '@solana/spl-token'
import { Program, BN, type Idl } from '@coral-xyz/anchor'
import { useTransactionStore } from '@/stores'

interface DepositParams {
  vaultAddress: string
  tokenMint: string
  amount: number
  vaultId: string
}

const USDC_DECIMALS = 6

function isNative(mint: string) {
  return mint === 'So11111111111111111111111111111111111111112'
}

export function useDeposit() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const updateStatus = useTransactionStore((s) => s.updateStatus)
  const execute = useCallback(
    async ({ vaultAddress, tokenMint, amount, vaultId }: DepositParams) => {
      if (!wallet.publicKey || !wallet.signTransaction) {
        throw new Error('Wallet not connected')
      }

      const txId = addTransaction({
        type: 'deposit',
        signature: null,
        vaultId,
        inputToken: tokenMint,
        amountIn: amount,
        errorMessage: null,
      })

      try {
        updateStatus(txId, 'pending')

        const vaultPubkey = new PublicKey(vaultAddress)
        const mintPubkey = new PublicKey(tokenMint)
        const userPubkey = wallet.publicKey

        const lamports = isNative(tokenMint)
          ? Math.round(amount * LAMPORTS_PER_SOL)
          : Math.round(amount * 10 ** USDC_DECIMALS)

        const program = new Program({} as Idl, {
          connection,
          wallet: {
            publicKey: userPubkey,
            signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => wallet.signTransaction!(tx),
            signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => wallet.signAllTransactions!(txs),
          },
        })

        const ix = await program.methods
          .deposit(new BN(lamports))
          .accounts({
            vault: vaultPubkey,
            user: userPubkey,
            ...(isNative(tokenMint)
              ? { systemProgram: SystemProgram.programId }
              : {
                  tokenProgram: TOKEN_PROGRAM_ID,
                  userTokenAccount: await getAssociatedTokenAddress(mintPubkey, userPubkey),
                  vaultTokenAccount: await getAssociatedTokenAddress(mintPubkey, vaultPubkey),
                }),
          })
          .instruction()

        const tx = new Transaction()
          .add(ix)
        tx.feePayer = userPubkey
        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash

        const signed = await wallet.signTransaction(tx)
        const signature = await connection.sendRawTransaction(signed.serialize())

        updateStatus(txId, 'success')
        return signature
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Deposit failed'
        updateStatus(txId, 'failed', message)
        throw err
      }
    },
    [wallet, connection, addTransaction, updateStatus],
  )

  return { execute }
}
