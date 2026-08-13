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
    rpcEndpoint.includes('testnet')

  if (!isNonMainnet) return

  try {
    const balance = await connection.getBalance(publicKey)
    if (balance < minBalanceLamports) {
      const airdropSig = await connection.requestAirdrop(publicKey, airdropAmountLamports)
      await connection.confirmTransaction(airdropSig, 'confirmed')
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
): Promise<void> {
  // Enterprise DApp Strategy: 1. Check signature status first to see if transaction landed cleanly
  const statusRes = await connection.getSignatureStatuses([signature])
  const currentStatus = statusRes.value[0]

  if (currentStatus && (currentStatus.confirmationStatus === 'confirmed' || currentStatus.confirmationStatus === 'finalized')) {
    if (currentStatus.err) {
      throw new Error(`Transaction failed on-chain: ${JSON.stringify(currentStatus.err)}`)
    }
    return
  }

  // 2. Fallback to confirmTransaction
  const info = blockhashInfo ?? (await connection.getLatestBlockhash('confirmed'))
  try {
    const res = await connection.confirmTransaction(
      {
        signature,
        blockhash: info.blockhash,
        lastValidBlockHeight: info.lastValidBlockHeight,
      },
      commitment,
    )
    if (res.value.err) {
      throw new Error(`Transaction failed confirmation: ${JSON.stringify(res.value.err)}`)
    }
  } catch (err: any) {
    // If confirmation threw block height exceeded (e.g. user delayed in wallet popup), re-check signature status
    const recheck = await connection.getSignatureStatuses([signature])
    const recheckStatus = recheck.value[0]
    if (recheckStatus && !recheckStatus.err) {
      return // Transaction actually landed cleanly on-chain!
    }
    throw err
  }
}

export async function sendTransaction(
  connection: Connection,
  tx: Transaction,
  signer: { publicKey?: any; signTransaction: (tx: Transaction) => Promise<Transaction> },
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
  } catch (err: any) {
    if (err?.logs) {
      console.error('SendTransactionError logs:', err.logs)
      err.message = `${err.message} | Simulation logs: ${JSON.stringify(err.logs)}`
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

