import { useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, SYSVAR_RENT_PUBKEY, TransactionInstruction } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { api } from '@/lib/api'
import { getProgram } from '@/lib/anchor'
import {
  buildTransactionWithComputeBudget,
  sendTransaction,
  confirmTransactionHelper,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
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

function isNative(mint: string) {
  return mint === 'So11111111111111111111111111111111111111112' || mint === 'SOL'
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

        const program = await getProgram(
          {
            publicKey: userPubkey,
            signTransaction: wallet.signTransaction as any,
            signAllTransactions: wallet.signAllTransactions as any,
          },
          connection,
        )

        if (!program || !(program.idl as any)?.instructions?.length) {
          throw new Error('Deposit program unavailable')
        }

        const lamports = isNative(tokenMint)
          ? Math.round(amount * LAMPORTS_PER_SOL)
          : Math.round(amount * 10 ** USDC_DECIMALS)

        const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
          [Buffer.from('vault_authority'), vaultPubkey.toBuffer()],
          program.programId,
        )

        const depositMintPubkey = isNative(tokenMint)
          ? NATIVE_MINT
          : new PublicKey(tokenMint)

        const investorTokenAccount = getAssociatedTokenAddressSync(
          depositMintPubkey,
          userPubkey,
        )

        const vaultTokenAccount = getAssociatedTokenAddressSync(
          depositMintPubkey,
          vaultAuthorityPda,
          true,
        )

        // Actual share token mint PDA
        const [shareTokenMintPubkey] = PublicKey.findProgramAddressSync(
          [Buffer.from('share_mint'), vaultPubkey.toBuffer()],
          program.programId,
        )

        const investorShareAccount = getAssociatedTokenAddressSync(
          shareTokenMintPubkey,
          userPubkey,
        )

        const ixs: TransactionInstruction[] = []

        // Check and create investor ATA if missing
        const investorAtaInfo = await connection.getAccountInfo(investorTokenAccount)
        if (!investorAtaInfo) {
          ixs.push(
            createAssociatedTokenAccountInstruction(
              userPubkey,
              investorTokenAccount,
              userPubkey,
              depositMintPubkey,
            ),
          )
        }

        // Check and create investor share ATA if missing
        const investorShareAtaInfo = await connection.getAccountInfo(investorShareAccount)
        if (!investorShareAtaInfo) {
          ixs.push(
            createAssociatedTokenAccountInstruction(
              userPubkey,
              investorShareAccount,
              userPubkey,
              shareTokenMintPubkey,
            ),
          )
        }

        // Add transfer & sync_native if native SOL
        if (isNative(tokenMint)) {
          ixs.push(
            SystemProgram.transfer({
              fromPubkey: userPubkey,
              toPubkey: investorTokenAccount,
              lamports,
            }),
          )
          ixs.push(createSyncNativeInstruction(investorTokenAccount))
        }

        const depositIx = await program.methods
          .deposit(new BN(lamports))
          .accounts({
            investor: userPubkey,
            vault: vaultPubkey,
            vaultAuthority: vaultAuthorityPda,
            investorTokenAccount,
            vaultTokenAccount,
            depositMint: depositMintPubkey,
            shareTokenMint: shareTokenMintPubkey,
            investorShareAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .instruction()

        ixs.push(depositIx)

        const tx = buildTransactionWithComputeBudget(ixs, 1000, 200000)
        const signature = await sendTransaction(
          connection,
          tx,
          wallet as any,
        )
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