import { useState, useCallback } from 'react'
import { useAnchorWallet, useConnection, useWallet } from '@solana/wallet-adapter-react'
import { useQueryClient } from '@tanstack/react-query'
import { PublicKey, TransactionInstruction } from '@solana/web3.js'
import { BN } from 'bn.js'
import { toast } from 'react-hot-toast'
import { toastSuccess, toastError } from '@/lib/toast'
import { useTransactionStore } from '@/stores'
import { api, getAuthToken } from '@/lib/api'
import { ensureWalletAuthenticated, isTokenExpired } from '@/services/apis/rest-api/auth.service'
import { getVault } from '@/services/apis/rest-api/vault.service'
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

import { getTokenMeta } from '@/constants/tokens'

export interface ExecuteTradeParams {
  vaultId: string
  vaultAddress?: string
  inputToken: string
  outputToken: string
  amountIn: number
  amountOut: number
  priceAtExecution: number
  slippage: number
}

const NATIVE_MINT = new PublicKey('So11111111111111111111111111111111111111112')
const PYTH_RECEIVER_PROGRAM_ID = new PublicKey('rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ')
const SOL_USD_FEED_ID = 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'

function isNativeMint(mintStr: string): boolean {
  return mintStr === 'So11111111111111111111111111111111111111112' || mintStr?.toUpperCase() === 'SOL'
}

function resolveMint(symbolOrMint: string): PublicKey {
  if (isNativeMint(symbolOrMint)) return NATIVE_MINT
  try {
    return new PublicKey(symbolOrMint)
  } catch {
    const meta = getTokenMeta(symbolOrMint)
    if (meta.mint) {
      return new PublicKey(meta.mint)
    }
    throw new Error(`Invalid token mint or symbol: ${symbolOrMint}`)
  }
}

export function useExecuteTrade() {
  const [isLoading, setIsLoading] = useState(false)
  const anchorWallet = useAnchorWallet()
  const { signMessage } = useWallet()
  const { connection } = useConnection()
  const queryClient = useQueryClient()
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

        if (anchorWallet?.publicKey) {
          try {
            const program = await getProgram(anchorWallet, connection)
            if (program && program.idl.instructions?.length) {
              const targetAddress = params.vaultAddress || params.vaultId
              if (!targetAddress) {
                throw new Error('Vault ID is required')
              }
              let vaultPubkey: PublicKey
              try {
                vaultPubkey = new PublicKey(targetAddress)
              } catch {
                const fetched = await getVault(params.vaultId).catch(() => null)
                if (fetched?.address) {
                  vaultPubkey = new PublicKey(fetched.address)
                } else {
                  throw new Error(`Invalid vault address: ${targetAddress}`)
                }
              }

              const [vaultAuthorityPda] = PublicKey.findProgramAddressSync(
                [Buffer.from('vault_authority'), vaultPubkey.toBuffer()],
                program.programId,
              )

              const inputMintPubkey = resolveMint(params.inputToken)
              const outputMintPubkey = resolveMint(params.outputToken)

              const inputMintInfo = isNativeMint(params.inputToken)
                ? null
                : await connection.getAccountInfo(inputMintPubkey).catch(() => null)
              const inputTokenProgramId = inputMintInfo?.owner ?? TOKEN_PROGRAM_ID

              const outputMintInfo = isNativeMint(params.outputToken)
                ? null
                : await connection.getAccountInfo(outputMintPubkey).catch(() => null)
              const outputTokenProgramId = outputMintInfo?.owner ?? TOKEN_PROGRAM_ID

              const vaultInputAta = getAssociatedTokenAddressSync(
                inputMintPubkey,
                vaultAuthorityPda,
                true,
                inputTokenProgramId,
              )
              const vaultOutputAta = getAssociatedTokenAddressSync(
                outputMintPubkey,
                vaultAuthorityPda,
                true,
                outputTokenProgramId,
              )

              const ixs: TransactionInstruction[] = []

              // If vault is in Fundraising status and current user is manager, auto-activate if min raise met
              try {
                let vaultAccount: { status?: unknown; manager?: PublicKey } | null = null
                if (program.account && 'vaultState' in program.account) {
                  vaultAccount = await (program.account as unknown as { vaultState: { fetch: (pk: PublicKey) => Promise<{ status?: unknown; manager?: PublicKey }> } }).vaultState.fetch(vaultPubkey).catch((e) => {
                    console.error('fetch vaultState failed', e)
                    return null
                  })
                } else if (program.account && 'vault' in program.account) {
                  vaultAccount = await (program.account as unknown as { vault: { fetch: (pk: PublicKey) => Promise<{ status?: unknown; manager?: PublicKey }> } }).vault.fetch(vaultPubkey).catch((e) => {
                    console.error('fetch vault failed', e)
                    return null
                  })
                }

                console.log('vaultAccount fetched:', vaultAccount)

                if (vaultAccount) {
                  let isFundraising = false
                  if (vaultAccount.status !== undefined && vaultAccount.status !== null) {
                    if (typeof vaultAccount.status === 'object') {
                      isFundraising = 'fundraising' in (vaultAccount.status as Record<string, unknown>) || 'Fundraising' in (vaultAccount.status as Record<string, unknown>)
                    } else if (typeof vaultAccount.status === 'string') {
                      isFundraising = (vaultAccount.status as string).toLowerCase() === 'fundraising'
                    } else {
                      isFundraising = vaultAccount.status === 0
                    }
                  }
                  
                  const isManager = vaultAccount.manager ? vaultAccount.manager.equals(anchorWallet.publicKey) : true
                  console.log('isFundraising:', isFundraising, 'isManager:', isManager, 'has activateVault:', !!program.methods?.activateVault)
                  
                  if (isFundraising && isManager && program.methods?.activateVault) {
                    const activateIx = await program.methods
                      .activateVault()
                      .accounts({
                        manager: anchorWallet.publicKey,
                        vault: vaultPubkey,
                      })
                      .instruction()
                    ixs.push(activateIx)
                    toast.success('Added activateVault instruction!')
                    console.log('added activateIx')
                  }
                }
              } catch (checkErr) {
                toast.error('Auto-activate vault check skipped with error: ' + checkErr)
                console.error('Auto-activate vault check skipped with error:', checkErr)
              }

              // Add ATA creation for input token if missing
              const inputAtaInfo = await connection.getAccountInfo(vaultInputAta)
              if (!inputAtaInfo) {
                ixs.push(
                  createAssociatedTokenAccountInstruction(
                    anchorWallet.publicKey,
                    vaultInputAta,
                    vaultAuthorityPda,
                    inputMintPubkey,
                    inputTokenProgramId,
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
                    anchorWallet.publicKey,
                    vaultOutputAta,
                    vaultAuthorityPda,
                    outputMintPubkey,
                    outputTokenProgramId,
                  ),
                )
              }

              const inputMeta = getTokenMeta(params.inputToken)
              const outputMeta = getTokenMeta(params.outputToken)
              const inputDecimals = isNativeMint(params.inputToken) ? 9 : (inputMeta.decimals || 6)
              const outputDecimals = isNativeMint(params.outputToken) ? 9 : (outputMeta.decimals || 6)

              const amountInBn = new BN(Math.round(params.amountIn * 10 ** inputDecimals))
              const minAmountOutBn = new BN(
                Math.round(params.amountOut * (1 - params.slippage / 100) * 10 ** outputDecimals),
              )

              // Derive Pyth oracle price feed PDA
              const [priceUpdatePda] = PublicKey.findProgramAddressSync(
                [Buffer.from('write_price_update'), Buffer.from(SOL_USD_FEED_ID, 'hex')],
                PYTH_RECEIVER_PROGRAM_ID,
              )

              const tradeIx = await program.methods
                .executeTradePyth(amountInBn, minAmountOutBn)
                .accounts({
                  manager: anchorWallet.publicKey,
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
              signature = await sendTransaction(connection, tx, anchorWallet)
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
          if (anchorWallet?.publicKey) {
            const userAddr = anchorWallet.publicKey.toBase58()
            const currentToken = getAuthToken()
            if ((!currentToken || isTokenExpired(currentToken)) && signMessage) {
              await ensureWalletAuthenticated(userAddr, signMessage).catch(() => {})
            }
          }
          await api.post('/trades/sync', syncPayload)

          // Invalidate all caches so UI reflects updated balances & trade history
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ['vaults'] }),
            queryClient.invalidateQueries({ queryKey: ['infiniteVaults'] }),
            queryClient.invalidateQueries({ queryKey: ['vaultBalances'] }),
            queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
            queryClient.invalidateQueries({ queryKey: ['portfolioHistory'] }),
            queryClient.invalidateQueries({ queryKey: ['trades'] }),
            queryClient.invalidateQueries({ queryKey: ['transactions'] }),
            queryClient.invalidateQueries({ queryKey: ['marketStats'] }),
            queryClient.invalidateQueries({ queryKey: ['vaultSparkline'] }),
            queryClient.invalidateQueries({ queryKey: ['vaultSparklineFull'] }),
            queryClient.refetchQueries({ queryKey: ['vault', params.vaultId] }),
            queryClient.refetchQueries({ queryKey: ['vaultBalances', params.vaultId] }),
            ...(params.vaultAddress
              ? [
                  queryClient.refetchQueries({ queryKey: ['vault', params.vaultAddress] }),
                  queryClient.refetchQueries({ queryKey: ['vaultBalances', params.vaultAddress] }),
                ]
              : []),
          ])
        } catch (err) {
          console.warn('Failed to sync executed trade to backend:', err)
        }

        moveToHistory(txId)
        toastSuccess(`Swapped ${params.amountIn} ${params.inputToken} for ~${params.amountOut.toFixed(4)} ${params.outputToken}`)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Trade failed'
        updateStatus(txId, 'failed', errorMsg)
        toastError(errorMsg)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [anchorWallet, signMessage, connection, queryClient, addTransaction, updateStatus, confirmTransaction, moveToHistory],
  )

  return { execute, isLoading }
}

