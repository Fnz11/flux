import { type Connection, type Transaction, type TransactionSignature } from '@solana/web3.js'

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
