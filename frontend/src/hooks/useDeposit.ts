import { useCallback } from 'react'
import { useConnection, useWallet } from '@solana/wallet-adapter-react'
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL, TransactionInstruction, Transaction } from '@solana/web3.js'
import { BN } from 'bn.js'
import { api, getAuthToken, ApiError } from '@/lib/api'
import { ensureWalletAuthenticated, isTokenExpired } from '@/services/apis/rest-api/auth.service'
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
import { useQueryClient } from '@tanstack/react-query'
import { formatError } from '@/lib/errors'

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
  const queryClient = useQueryClient()
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

        const walletSigner = {
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
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

        console.log('[useDeposit] Starting deposit:', {
          vaultAddress,
          vaultPubkey: vaultPubkey.toBase58(),
          tokenMint,
          isNativeToken: isNative(tokenMint),
          amount,
          lamports,
          investor: userPubkey.toBase58(),
        })

        let signature: string | null = null
        let tx: Transaction
        let draftId: string | undefined
        let blockhashInfo: { blockhash: string; lastValidBlockHeight: number } | undefined

        try {
          // 1. Enterprise path: request backend to prepare tx
          console.log('[useDeposit] Calling backend prepareDeposit...')
          const prep = await prepareDeposit({
            investorAddress: userPubkey.toBase58(),
            vaultAddress: vaultPubkey.toBase58(),
            amountLamports: lamports,
            depositMint: isNative(tokenMint) ? undefined : tokenMint,
          })

          console.log('[useDeposit] Backend prepare response:', prep)

          if (!prep?.transaction) {
            throw new Error('Prepared transaction missing')
          }

          if (prep.recent_blockhash && prep.last_valid_block_height) {
            blockhashInfo = {
              blockhash: prep.recent_blockhash,
              lastValidBlockHeight: prep.last_valid_block_height,
            }
          }

          draftId = prep.draft_id
          tx = Transaction.from(Buffer.from(prep.transaction, 'base64'))
          console.log('[useDeposit] Deserialized prepared tx. Instructions count:', tx.instructions.length)
          tx.instructions.forEach((ix, idx) => {
            console.log(`[useDeposit] Ix #${idx}: programId=${ix.programId.toBase58()} keys=${ix.keys.map(k => `${k.pubkey.toBase58()}(w=${k.isWritable},s=${k.isSigner})`).join(', ')}`)
          })
        } catch (prepErr) {
          console.warn('[useDeposit] Backend prepare failed, falling back to client-side Anchor:', prepErr)
          // 2. Client-side fallback ONLY if backend prepare HTTP call fails
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

          let vaultAccount: { shareTokenMint?: PublicKey; depositMint?: PublicKey } | null = null
          try {
            vaultAccount = await (program.account as unknown as { vaultState: { fetch: (pk: PublicKey) => Promise<{ shareTokenMint: PublicKey; depositMint: PublicKey }> } }).vaultState.fetch(vaultPubkey)
          } catch {
            try {
              vaultAccount = await (program.account as unknown as { vault: { fetch: (pk: PublicKey) => Promise<{ shareTokenMint: PublicKey; depositMint: PublicKey }> } }).vault.fetch(vaultPubkey)
            } catch {}
          }

          const shareTokenMintPubkey: PublicKey =
            vaultAccount?.shareTokenMint ||
            PublicKey.findProgramAddressSync(
              [Buffer.from('share_mint'), vaultPubkey.toBuffer()],
              program.programId,
            )[0]

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
          } else {
            // For SPL token deposits, ensure investor token ATA exists
            const investorAtaInfo = await connection.getAccountInfo(investorTokenAccount)
            if (!investorAtaInfo) {
              ixs.push(
                createAssociatedTokenAccountInstruction(
                  userPubkey,
                  investorTokenAccount,
                  userPubkey,
                  tokenMintPubkey,
                ),
              )
            }
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
              associatedTokenProgram: new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'),
              systemProgram: SystemProgram.programId,
            })
            .instruction()

          ixs.push(depositIx)
          tx = buildTransactionWithComputeBudget(ixs, 1000, 200000)
        }

        // 3. Single User Signature and Broadcast
        if (draftId && tx) {
          try {
            const signedTx = await wallet.signTransaction(tx)
            if (signedTx && typeof signedTx.serialize === 'function') {
              signature = await connection.sendRawTransaction(signedTx.serialize(), {
                skipPreflight: false,
                preflightCommitment: 'confirmed',
              })
            } else {
              signature = await sendTransaction(connection, tx, walletSigner)
            }
          } catch {
            signature = await sendTransaction(connection, tx, walletSigner)
          }
        } else {
          signature = await sendTransaction(connection, tx, walletSigner)
        }

        if (draftId && signature) {
          await submitTx({ draftId, signature }).catch(() => {})
        }

        if (!signature) {
          throw new Error('Deposit transaction failed: no signature')
        }

        // Await on-chain confirmation before syncing with backend
        await confirmTransactionHelper(connection, signature, blockhashInfo, 'confirmed')

        // Authenticate wallet for sync if needed
        if (userPubkey) {
          const userAddr = userPubkey.toBase58()
          const currentToken = getAuthToken()
          if ((!currentToken || isTokenExpired(currentToken)) && wallet.signMessage) {
            await ensureWalletAuthenticated(userAddr, wallet.signMessage).catch(() => {})
          }
        }

        // Sync with backend (with short retry if transaction indexing is in-flight)
        for (let attempt = 0; attempt < 3; attempt++) {
          try {
            const syncRes = await api.post<{ success?: boolean; retryable?: boolean }>('/trades/sync', {
              signature,
              vault_id: vaultId || vaultPubkey.toBase58(),
            })
            if (syncRes && (syncRes as { retryable?: boolean }).retryable !== true) {
              break
            }
          } catch (err: unknown) {
            if (err instanceof ApiError && (err.status === 409 || err.message.includes('already synced'))) {
              break
            }
          }
          if (attempt < 2) {
            await new Promise((r) => setTimeout(r, 400))
          }
        }

        const targetVaultId = vaultId || vaultPubkey.toBase58()
        const targetVaultAddress = vaultPubkey.toBase58()
        const userWalletAddress = userPubkey?.toBase58()
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['vault'] }),
          queryClient.invalidateQueries({ queryKey: ['vaultBalances'] }),
          queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
          queryClient.invalidateQueries({ queryKey: ['portfolioHistory'] }),
          queryClient.invalidateQueries({ queryKey: ['vaults'] }),
          queryClient.invalidateQueries({ queryKey: ['infiniteVaults'] }),
          queryClient.invalidateQueries({ queryKey: ['trades'] }),
          queryClient.invalidateQueries({ queryKey: ['transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['marketStats'] }),
          queryClient.invalidateQueries({ queryKey: ['vaultSparkline'] }),
          queryClient.invalidateQueries({ queryKey: ['vaultSparklineFull'] }),
          queryClient.refetchQueries({ queryKey: ['vault', targetVaultId] }),
          queryClient.refetchQueries({ queryKey: ['vault', targetVaultAddress] }),
          queryClient.refetchQueries({ queryKey: ['portfolio'] }),
          ...(userWalletAddress ? [queryClient.refetchQueries({ queryKey: ['portfolio', userWalletAddress] })] : []),
          queryClient.refetchQueries({ queryKey: ['vaultBalances', targetVaultId] }),
        ])

        updateStatus(txId, 'success')
        return signature
      } catch (err: unknown) {
        console.error('[useDeposit] Error occurred during deposit execution:', err)
        let message = formatError(err, 'Deposit failed')
        const sendTxErr = err as { getLogs?: () => string[]; logs?: string[] }
        const logs = (typeof sendTxErr?.getLogs === 'function' ? sendTxErr.getLogs() : sendTxErr?.logs) || []
        console.error('[useDeposit] Transaction error logs:', logs)
        const insufficientLog = logs.find((l) => l.includes('insufficient lamports') || l.includes('custom program error: 0x1'))
        const uninitializedLog = logs.find((l) => l.includes('AccountNotInitialized') || l.includes('0xbc4') || l.includes('3012'))
        if (insufficientLog) {
          message = `Insufficient SOL balance for deposit + gas fees (${insufficientLog}).`
        } else if (uninitializedLog) {
          message = `Vault account is not initialized on-chain (Error: AccountNotInitialized). Please create a new vault via the app to test on-chain deposits.`
        }
        updateStatus(txId, 'failed', message)
        const customErr = new Error(message)
        throw customErr
      }
    },
    [wallet, connection, addTransaction, updateStatus],
  )

  return { execute }
}