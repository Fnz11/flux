import { type Idl, Program } from '@coral-xyz/anchor'
import { type Connection, type PublicKey } from '@solana/web3.js'

export interface AnchorWalletLike {
  publicKey: PublicKey
  signTransaction: (transaction: any) => Promise<any>
  signAllTransactions?: (transactions: any[]) => Promise<any[]>
}

export async function getProgram(
  wallet: AnchorWalletLike,
  connection: Connection,
): Promise<Program<Idl> | null> {
  try {
    const [{ default: idl }, { Program, AnchorProvider }] = await Promise.all([
      import('@/lib/idl.json'),
      import('@coral-xyz/anchor'),
    ])
    const provider = new AnchorProvider(connection, wallet as any, { commitment: 'confirmed' })
    return new Program(idl as unknown as Idl, provider)
  } catch (err) {
    console.warn('Failed to initialize Anchor Program:', err)
    return null
  }
}
