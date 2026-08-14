import {
  ComputeBudgetProgram,
  Transaction,
  TransactionInstruction,
  PublicKey,
  type Connection,
  type TransactionSignature,
} from '@solana/web3.js'
import {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token'

export function buildTransactionWithComputeBudget(
  instructions: TransactionInstruction[] = [],
  microLamports: number = 1000,
  units: number = 200000,
): Transaction {
  const tx = new Transaction()
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports }),
    ComputeBudgetProgram.setComputeUnitLimit({ units }),
  )
  for (const ix of instructions) {
    tx.add(ix)
  }
  return tx
}

export async function ensureSolBalance(
  connection: Connection,
  publicKey: PublicKey | null | undefined,
  minBalanceLamports: number = 1e8,
  airdropAmountLamports: number = 2 * 1e9,
): Promise<void> {
  if (!publicKey) return

  const rpcEndpoint = connection?.rpcEndpoint?.toLowerCase() || ''
  const isNonMainnet =
    rpcEndpoint.includes('localhost') ||
    rpcEndpoint.includes('127.0.0.1') ||
    rpcEndpoint.includes('devnet') ||
    rpcEndpoint.includes('testnet') ||
    rpcEndpoint.includes('contracts:8899')

  if (!isNonMainnet) return

  try {
    const balance = await connection.getBalance(publicKey)
    if (balance < minBalanceLamports) {
      const airdropSig = await connection.requestAirdrop(publicKey, airdropAmountLamports)
      await confirmTransactionHelper(connection, airdropSig, undefined, 'confirmed', 10000)
    }
  } catch (airdropErr) {
    console.warn('Auto-airdrop failed or not supported:', airdropErr)
  }
}

export async function confirmTransactionHelper(
  connection: Connection,
  signature: TransactionSignature,
  blockhashInfo?: { blockhash: string; lastValidBlockHeight: number },
  commitment: 'processed' | 'confirmed' | 'finalized' = 'confirmed',
  timeoutMs: number = 30000,
): Promise<void> {
  // 1. Immediate check: see if transaction already landed before listener setup
  try {
    const statusRes = await connection.getSignatureStatuses([signature])
    const currentStatus = statusRes.value[0]
    if (
      currentStatus &&
      (currentStatus.confirmationStatus === 'confirmed' || currentStatus.confirmationStatus === 'finalized' || (commitment === 'processed' && currentStatus.confirmationStatus === 'processed'))
    ) {
      if (currentStatus.err) {
        throw new Error(`Transaction failed on-chain: ${JSON.stringify(currentStatus.err)}`)
      }
      return
    }
  } catch (checkErr) {
    if (checkErr instanceof Error && checkErr.message.includes('Transaction failed on-chain')) {
      throw checkErr
    }
  }

  let subId: number | null = null

  // 2. WebSocket Subscription (Fast path: ~400ms)
  const wsPromise = new Promise<void>((resolve, reject) => {
    try {
      subId = connection.onSignature(
        signature,
        (result) => {
          if (result.err) {
            reject(new Error(`Transaction failed on-chain: ${JSON.stringify(result.err)}`))
          } else {
            resolve()
          }
        },
        commitment,
      )
    } catch (wsErr) {
      console.warn('WebSocket signature subscription failed, falling back to polling:', wsErr)
    }
  })

  // 3. Polling + Expiry check (Reliability fallback & timeout guard)
  const pollPromise = new Promise<void>((resolve, reject) => {
    const startTime = Date.now()
    const interval = setInterval(async () => {
      try {
        if (Date.now() - startTime > timeoutMs) {
          clearInterval(interval)
          reject(new Error(`Transaction confirmation timed out after ${timeoutMs}ms`))
          return
        }

        // Check block height expiration if blockhashInfo is present
        if (blockhashInfo?.lastValidBlockHeight) {
          const currentHeight = await connection.getBlockHeight(commitment)
          if (currentHeight > blockhashInfo.lastValidBlockHeight) {
            clearInterval(interval)
            // Final check on signature before declaring expired
            const finalCheck = await connection.getSignatureStatuses([signature])
            if (finalCheck.value[0] && !finalCheck.value[0].err && finalCheck.value[0].confirmationStatus) {
              resolve()
              return
            }
            reject(new Error('Transaction expired: block height exceeded'))
            return
          }
        }

        const statusRes = await connection.getSignatureStatuses([signature])
        const status = statusRes.value[0]
        if (status) {
          if (status.err) {
            clearInterval(interval)
            reject(new Error(`Transaction failed on-chain: ${JSON.stringify(status.err)}`))
            return
          }
          if (
            status.confirmationStatus === 'confirmed' ||
            status.confirmationStatus === 'finalized' ||
            (commitment === 'processed' && status.confirmationStatus === 'processed')
          ) {
            clearInterval(interval)
            resolve()
            return
          }
        }
      } catch (err) {
        // Suppress transient RPC network errors during poll
      }
    }, 1000)
  })

  try {
    await Promise.race([wsPromise, pollPromise])
  } finally {
    if (subId !== null) {
      try {
        connection.removeSignatureListener(subId)
      } catch {
        // Ignore unregister errors
      }
    }
  }
}

export async function sendTransaction(
  connection: Connection,
  tx: Transaction,
  signer: { publicKey?: PublicKey | null; signTransaction: (tx: Transaction) => Promise<Transaction> },
): Promise<TransactionSignature> {
  if (signer.publicKey) {
    await ensureSolBalance(connection, signer.publicKey)
  }
  if (!tx.feePayer && signer.publicKey) {
    tx.feePayer = signer.publicKey
  }

  const { blockhash } = await connection.getLatestBlockhash()
  if (!tx.recentBlockhash) {
    tx.recentBlockhash = blockhash
  }

  // Pre-flight simulation check before asking user to sign
  if (typeof connection.simulateTransaction === 'function') {
    try {
      const simRes = await connection.simulateTransaction(tx)
      if (simRes.value.err) {
        console.warn('Pre-flight simulation warning/error:', simRes.value.err, simRes.value.logs)
      }
    } catch (simErr) {
      console.warn('Simulation check error:', simErr)
    }
  }

  const signed = await signer.signTransaction(tx)
  const rawTx = signed.serialize()

  try {
    const signature = await connection.sendRawTransaction(rawTx)
    return signature
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'logs' in err) {
      const logs = (err as { logs?: unknown }).logs
      console.error('SendTransactionError logs:', logs)
      if (err instanceof Error) {
        err.message = `${err.message} | Simulation logs: ${JSON.stringify(logs)}`
      }
    }
    throw err
  }
}

export {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
}

