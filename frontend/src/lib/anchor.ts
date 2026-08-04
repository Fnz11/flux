import { type Idl } from '@coral-xyz/anchor'
import { type Connection, type PublicKey } from '@solana/web3.js'

export async function getProgram(
  wallet: { publicKey: PublicKey; signTransaction: any; signAllTransactions: any },
  connection: Connection,
) {
  const [{ default: idl }, { Program, AnchorProvider }] = await Promise.all([
    import('@/lib/idl.json'),
    import('@coral-xyz/anchor'),
  ])
  const provider = new AnchorProvider(connection, wallet, { commitment: 'confirmed' })
  return new Program(idl as unknown as Idl, provider)
}
