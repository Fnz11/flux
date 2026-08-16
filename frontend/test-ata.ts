import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js'
import { createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token'

const connection = new Connection('http://127.0.0.1:8899', 'confirmed')

async function run() {
  const payer = new PublicKey('HwvBsyjpbatjxcJf72bwVQLuLp9twxk8TWpSKVUL2jAv')

  const mint = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
  const ata = getAssociatedTokenAddressSync(mint, payer, true, TOKEN_PROGRAM_ID)

  console.log("Testing Create Instruction:")
  const ixCreate = createAssociatedTokenAccountInstruction(
    payer,
    ata,
    payer,
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
