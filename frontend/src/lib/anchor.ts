import type { Idl, Program } from '@coral-xyz/anchor'
import { type Connection, type PublicKey, type Transaction, type VersionedTransaction } from '@solana/web3.js'

export interface AnchorWalletLike {
  publicKey: PublicKey
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>
  signAllTransactions?<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>
}

export async function getProgram(
  wallet: AnchorWalletLike,
  connection: Connection,
): Promise<Program<Idl> | null> {
  try {
    const [{ default: idl }, anchorModule] = await Promise.all([
      import('@/lib/idl.json'),
      import('@coral-xyz/anchor'),
    ])
    const anchor = (anchorModule as { default?: typeof import('@coral-xyz/anchor') }).default ?? anchorModule
    const provider = new anchor.AnchorProvider(
      connection,
      wallet as unknown as import('@coral-xyz/anchor').Wallet,
      { commitment: 'confirmed' },
    )
    return new anchor.Program(idl as unknown as Idl, provider)
  } catch (err) {
    console.warn('Failed to initialize Anchor Program:', err)
    return null
  }
}
