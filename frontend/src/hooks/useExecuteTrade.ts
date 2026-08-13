import { useState, useCallback } from 'react'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { BN } from '@coral-xyz/anchor'
import { useTransactionStore } from '@/stores'
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
const PYTH_RECEIVER_PROGRAM_ID = new PublicKey('recV279B92B27D6x6s7hPj75CLL62p6z2yC4T1uY2')
const SOL_USD_FEED_ID = 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'

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
              if (!params.vaultId) {
                throw new Error('Vault ID is required')
              }
              let vaultPubkey: PublicKey
              try {
                vaultPubkey = new PublicKey(params.vaultId)
              } catch {
                throw new Error(`Invalid vault address: ${params.vaultId}`)
              }

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

              const amountInBn = new BN(Math.round(params.amountIn * 1e9))
              const minAmountOutBn = new BN(
                Math.round(params.amountOut * (1 - params.slippage / 100) * 1e9),
              )

              // Derive Pyth oracle price feed PDA
              const [priceUpdatePda] = PublicKey.findProgramAddressSync(
                [Buffer.from('write_price_update'), Buffer.from(SOL_USD_FEED_ID, 'hex')],
                PYTH_RECEIVER_PROGRAM_ID,
              )

              const tradeIx = await program.methods
                .executeTradePyth(amountInBn, minAmountOutBn)
                .accounts({
                  manager: wallet.publicKey,
                  vault: vaultPubkey,
                  vaultAuthority: vaultAuthorityPda,
                  vaultInputTokenAccount: vaultInputAta,
                  vaultInputMint: inputMintPubkey,
                  vaultOutputTokenAccount: vaultOutputAta,
                  vaultOutputMint: outputMintPubkey,
                  priceUpdate: priceUpdatePda,
                  tokenProgram: TOKEN_PROGRAM_ID,
                })
                .instruction()

              ixs.push(tradeIx)

              const tx = buildTransactionWithComputeBudget(ixs, 1000, 200000)
              signature = await sendTransaction(connection, tx, wallet)
              if (signature) {
                await confirmTransactionHelper(connection, signature, undefined, 'confirmed')
              }
            }
          } catch (e) {
            console.warn('Trade execution on-chain error:', e)
            throw e
          }
        }

        if (!signature) {
          throw new Error('Trade execution failed: no on-chain signature returned')
        }

        confirmTransaction(txId, signature)

        const isInputQuote =
          params.inputToken.toUpperCase() === 'USDC' || params.inputToken.toUpperCase() === 'USDT'
        const tradeType: TradeType = isInputQuote ? 'Buy' : 'Sell'

        const syncPayload: SyncTradeRequest = {
          signature,
          vault_id: params.vaultId,
          trade_type: tradeType,
          input_token: params.inputToken,
          output_token: params.outputToken,
          amount_in: params.amountIn,
          amount_out: params.amountOut,
          price_at_execution: params.priceAtExecution,
        }

        try {
          await api.post('/trades/sync', syncPayload)
        } catch (err) {
          console.warn('Failed to sync executed trade to backend:', err)
        }

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

