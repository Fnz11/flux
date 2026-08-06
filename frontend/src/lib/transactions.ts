import {
  ComputeBudgetProgram,
  Transaction,
  TransactionInstruction,
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

export async function sendTransaction(
  connection: Connection,
  tx: Transaction,
  signer: { publicKey?: any; signTransaction: (tx: Transaction) => Promise<Transaction> },
): Promise<TransactionSignature> {
  tx.feePayer = signer.publicKey
  const { blockhash } = await connection.getLatestBlockhash()
  tx.recentBlockhash = blockhash
  const signed = await signer.signTransaction(tx)
  return connection.sendRawTransaction(signed.serialize())
}

export {
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
}

