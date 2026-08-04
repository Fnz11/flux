import { useState, useCallback } from 'react'
import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react'
import { useTransactionStore } from '@/stores'
import { api } from '@/lib/api'
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
      if (!wallet) return

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

        const program = await getProgram(wallet, connection)

        const vaultPubkey = wallet.publicKey
        const inputMint = wallet.publicKey
        const outputMint = wallet.publicKey
        const pythFeedKey = wallet.publicKey

        const tx = await program.methods
          .executeTradePyth(
            params.amountIn,
            params.amountOut,
            params.slippage,
          )
          .accounts({
            manager: wallet.publicKey,
            vault: vaultPubkey,
            inputMint,
            outputMint,
            pythFeed: pythFeedKey,
            systemProgram: '11111111111111111111111111111111',
          })
          .transaction()

        const blockhash = await connection.getLatestBlockhash()
        tx.recentBlockhash = blockhash.blockhash
        tx.feePayer = wallet.publicKey

        const signed = await wallet.signTransaction(tx)
        const signature = await connection.sendRawTransaction(signed.serialize())
        await connection.confirmTransaction(signature, 'confirmed')

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

        await api.post('/trades/sync', syncPayload)

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

async function getProgram(wallet: import('@solana/wallet-adapter-react').AnchorWallet, connection: import('@solana/web3.js').Connection) {
  const [idl, { Program, AnchorProvider }] = await Promise.all([
    import('@/lib/idl.json').then((m) => m.default),
    import('@coral-xyz/anchor'),
  ])
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  return new Program(idl, provider)
}
