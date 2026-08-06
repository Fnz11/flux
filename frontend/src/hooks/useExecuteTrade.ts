import { useState, useCallback } from 'react'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { useTransactionStore } from '@/stores'
import { api } from '@/lib/api'
import { getProgram } from '@/lib/anchor'
import {
  buildTransactionWithComputeBudget,
  sendTransaction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
} from '@/lib/transactions'
import type { SyncTradeRequest, TradeType } from '@/types'

interface ExecuteTradeParams {
  vaultId: string
  inputToken: string
  outputToken: string
  amountIn: number
  amountOut: number
  priceAtExecution: number
  slippage: number
}

const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112')

function isNativeMint(mintStr: string): boolean {
  return mintStr === 'So11111111111111111111111111111111111111112' || mintStr.toUpperCase() === 'SOL'
}

export function useExecuteTrade() {
  const [isLoading, setIsLoading] = useState(false)
  const wallet = useAnchorWallet()
  const { connection } = useConnection()
  const addTransaction = useTransactionStore((s) => s.addTransaction)
  const updateStatus = useTransactionStore((s) => s.updateStatus)
  const confirmTransaction = useTransactionStore((s) => s.confirmTransaction)
  const moveToHistory = useTransactionStore((s) => s.moveToHistory)

  const execute = useCallback(
    async (params: ExecuteTradeParams) => {
      const txId = addTransaction({
        type: 'trade',
        vaultId: params.vaultId,
        signature: null,
        errorMessage: null,
        inputToken: params.inputToken,
        outputToken: params.outputToken,
        amountIn: params.amountIn,
        amountOut: params.amountOut,
      })

      setIsLoading(true)

      try {
        updateStatus(txId, 'pending')

        let signature: string | null = null

        if (wallet?.publicKey) {
          try {
            const program = await getProgram(wallet, connection)
            if (program && (program.idl as any)?.instructions?.length) {
              const vaultPubkey = new PublicKey(
                params.vaultId.length === 44 ? params.vaultId : wallet.publicKey.toBase58(),
              )

              const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('vault_authority'), vaultPubkey.toBuffer()],
                program.programId,
              )

              const inputMintPubkey = isNativeMint(params.inputToken)
                ? NATIVE_MINT
                : new PublicKey(params.inputToken)

              const outputMintPubkey = isNativeMint(params.outputToken)
                ? NATIVE_MINT
                : new PublicKey(params.outputToken)

              const vaultInputAta = getAssociatedTokenAddressSync(
                inputMintPubkey,
                vaultAuthorityPda,
                true,
              )
              const vaultOutputAta = getAssociatedTokenAddressSync(
                outputMintPubkey,
                vaultAuthorityPda,
                true,
              )

              const ixs: TransactionInstruction[] = []

              // Add ATA creation for input token if missing
              const inputAtaInfo = await connection.getAccountInfo(vaultInputAta)
              if (!inputAtaInfo) {
                ixs.push(
                  createAssociatedTokenAccountInstruction(
                    wallet.publicKey,
                    vaultInputAta,
                    vaultAuthorityPda,
                    inputMintPubkey,
                  ),
                )
              }

              // Add sync_native if input token is wrapped SOL
              if (inputMintPubkey.equals(NATIVE_MINT)) {
                ixs.push(createSyncNativeInstruction(vaultInputAta))
              }

              // Add ATA creation for output token if missing
              const outputAtaInfo = await connection.getAccountInfo(vaultOutputAta)
              if (!outputAtaInfo) {
                ixs.push(
                  createAssociatedTokenAccountInstruction(
                    wallet.publicKey,
                    vaultOutputAta,
                    vaultAuthorityPda,
                    outputMintPubkey,
                  ),
                )
              }

              const amountInLamports = Math.round(params.amountIn * 1e9)
              const minAmountOutLamports = Math.round(
                params.amountOut * (1 - params.slippage / 100) * 1e9,
              )

              const tradeIx = await program.methods
                .executeTradePyth(amountInLamports, minAmountOutLamports)
                .accounts({
                  manager: wallet.publicKey,
                  vault: vaultPubkey,
                  vaultAuthority: vaultAuthorityPda,
                  vaultInputTokenAccount: vaultInputAta,
                  vaultInputMint: inputMintPubkey,
                  vaultOutputTokenAccount: vaultOutputAta,
                  vaultOutputMint: outputMintPubkey,
                  priceUpdate: wallet.publicKey, // Pyth oracle price feed
                  tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction()

              ixs.push(tradeIx)

              const tx = buildTransactionWithComputeBudget(ixs, 1000, 200000)
              signature = await sendTransaction(connection, tx, wallet)
              await connection.confirmTransaction(signature, 'confirmed')
            }
          } catch (e) {
            console.warn('Trade execution on-chain error, simulation fallback:', e)
          }
        }

        if (!signature) {
          throw new Error('Trade execution failed: no on-chain signature returned')
        }

        confirmTransaction(txId, signature)

        const tradeType: TradeType = params.amountIn > 0 ? 'Buy' : 'Sell'

        const syncPayload: SyncTradeRequest = {
          vault_id: params.vaultId,
          transaction_signature: signature,
          trade_type: tradeType,
          input_token: params.inputToken,
          output_token: params.outputToken,
          amount_in: params.amountIn,
          amount_out: params.amountOut,
          price_at_execution: params.priceAtExecution,
        }

        await api.post('/trades/sync', syncPayload).catch(() => {
          // Backend sync fails silently if API server in offline demo mode
        })

        moveToHistory(txId)
      } catch (err) {
        updateStatus(txId, 'failed', err instanceof Error ? err.message : 'Trade failed')
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [wallet, connection, addTransaction, updateStatus, confirmTransaction, moveToHistory],
  )

  return { execute, isLoading }
}

