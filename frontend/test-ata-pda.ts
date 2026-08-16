import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'

const connection = new Connection('http://127.0.0.1:8899', 'confirmed')

async function run() {
  const payer = new PublicKey('HwvBsyjpbatjxcJf72bwVQLuLp9twxk8TWpSKVUL2jAv')

  // Generate a mock program PDA
  const programId = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('vault_authority')], programId)

  const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  const ata = getAssociatedTokenAddressSync(mint, pda, true, TOKEN_PROGRAM_ID)

  console.log("Testing Create Instruction with PDA owner:")
  const ixCreate = createAssociatedTokenAccountInstruction(
    payer,
    ata,
    pda,
    mint,
    TOKEN_PROGRAM_ID
  )

  const txCreate = new Transaction().add(ixCreate)
  txCreate.recentBlockhash = (await connection.getLatestBlockhash()).blockhash
  txCreate.feePayer = payer

  try {
    const sim = await connection.simulateTransaction(txCreate)
    console.log(JSON.stringify(sim.value.logs, null, 2))
    console.log("Create Error:", sim.value.err)
  } catch (e) {
    console.error(e)
  }
}

run()
