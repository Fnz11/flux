import { useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY, TransactionInstruction, Transaction } from '@solana/web3.js'
import { BN } from 'bn.js'
import { api } from '@/lib/api'
import { getProgram } from '@/lib/anchor'
import { prepareDeposit, submitTx } from '@/services/apis/rest-api/tx.service'
import {
  buildTransactionWithComputeBudget,
  sendTransaction,
  confirmTransactionHelper,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
} from '@/lib/transactions'
import { useTransactionStore } from '@/stores'

interface DepositParams {
  vaultAddress: string
  tokenMint: string
  amount: number
  vaultId: string
}

const USDC_DECIMALS = 6
const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112')

function isNative(tokenMint: string): boolean {
  return (
    tokenMint === 'SOL' ||
    tokenMint === 'WSOL' ||
    tokenMint === 'So11111111111111111111111111111111111111112' ||
    tokenMint === '11111111111111111111111111111111'
  )
}

export function useDeposit() {
  const { connection } = useConnection()
  const wallet = useWallet()
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const updateStatus = useTransactionStore((s) => s.updateStatus)

  const execute = useCallback(
    async ({ vaultAddress, tokenMint, amount, vaultId }: DepositParams) => {
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
        const lamports = isNative(tokenMint)
          ? Math.round(amount * LAMPORTS_PER_SOL)
          : Math.round(amount * 10 ** USDC_DECIMALS)

        let signature: string | null = null

        try {
          // 1. Enterprise path: request backend to prepare tx
          const prep = await prepareDeposit({
            investorAddress: userPubkey.toBase58(),
            vaultAddress: vaultPubkey.toBase58(),
            amountLamports: lamports,
            depositMint: isNative(tokenMint) ? undefined : tokenMint,
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
          const program = await getProgram(
            {
              publicKey: userPubkey,
              signTransaction: wallet.signTransaction,
              signAllTransactions: wallet.signAllTransactions,
            },
            connection,
          )

          if (!program || !program.idl.instructions?.length) {
            throw new Error('Deposit program unavailable')
          }

          const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
            [Buffer.from('vault_authority'), vaultPubkey.toBuffer()],
            program.programId,
          )

          const [shareTokenMintPubkey] = PublicKey.findProgramAddressSync(
            [Buffer.from('share_mint'), vaultPubkey.toBuffer()],
            program.programId,
          )

          const tokenMintPubkey = isNative(tokenMint)
            ? NATIVE_MINT
            : new PublicKey(tokenMint)

          const investorTokenAccount = getAssociatedTokenAddressSync(
            tokenMintPubkey,
            userPubkey,
          )

          const vaultTokenAccount = getAssociatedTokenAddressSync(
            tokenMintPubkey,
            vaultAuthorityPda,
            true,
          )

          const investorShareAccount = getAssociatedTokenAddressSync(
            shareTokenMintPubkey,
            userPubkey,
          )

          const ixs: TransactionInstruction[] = []

          // If native SOL, wrap SOL into user's WSOL ATA first
          if (isNative(tokenMint)) {
            const wsolAtaInfo = await connection.getAccountInfo(investorTokenAccount)
            if (!wsolAtaInfo) {
              ixs.push(
                createAssociatedTokenAccountInstruction(
                  userPubkey,
                  investorTokenAccount,
                  userPubkey,
                  NATIVE_MINT,
                ),
              )
            }

            ixs.push(
              SystemProgram.transfer({
                fromPubkey: userPubkey,
                toPubkey: investorTokenAccount,
                lamports,
              }),
              createSyncNativeInstruction(investorTokenAccount),
            )
          }

          // Check and create investor share ATA if missing
          const shareAtaInfo = await connection.getAccountInfo(investorShareAccount)
          if (!shareAtaInfo) {
            ixs.push(
              createAssociatedTokenAccountInstruction(
                userPubkey,
                investorShareAccount,
                userPubkey,
                shareTokenMintPubkey,
              ),
            )
          }

          // Check and create vault token ATA if missing
          const vaultAtaInfo = await connection.getAccountInfo(vaultTokenAccount)
          if (!vaultAtaInfo) {
            ixs.push(
              createAssociatedTokenAccountInstruction(
                userPubkey,
                vaultTokenAccount,
                vaultAuthorityPda,
                tokenMintPubkey,
              ),
            )
          }

          const depositIx = await program.methods
            .deposit(new BN(lamports))
            .accounts({
              investor: userPubkey,
              vault: vaultPubkey,
              vaultAuthority: vaultAuthorityPda,
              investorTokenAccount,
              depositMint: tokenMintPubkey,
              vaultTokenAccount,
              shareTokenMint: shareTokenMintPubkey,
              investorShareAccount,
              tokenProgram: TOKEN_PROGRAM_ID,
              systemProgram: SystemProgram.programId,
              rent: SYSVAR_RENT_PUBKEY,
            })
            .instruction()

          ixs.push(depositIx)

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
          throw new Error('Deposit transaction failed: no signature')
        }

        await confirmTransactionHelper(connection, signature, undefined, 'confirmed')

        try {
          await api.post('/trades/sync', {
            signature,
            vault_id: vaultId || vaultPubkey.toBase58(),
          })
        } catch (syncErr) {
          console.warn('Failed to sync deposit transaction to backend:', syncErr)
        }

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