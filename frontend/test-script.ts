import { Connection, PublicKey } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import * as fs from 'fs'

async function run() {
  const connection = new Connection('http://127.0.0.1:8899', 'confirmed')
  const idl = JSON.parse(fs.readFileSync('../contracts/target/idl/fbyt_clone_vault.json', 'utf-8'))
  const programId = new PublicKey(idl.address)
  
  const provider = new anchor.AnchorProvider(
    connection,
    {} as any,
    { preflightCommitment: 'confirmed' }
  )
  
  const program = new anchor.Program(idl as any, programId, provider)
  const pk = new PublicKey("3eeySWA8cfXAf3uXZ41nb1jvnshufvC1DUbijU8pMWAN")
  const v = await program.account.VaultState?.fetch(pk)
  console.log(v)
}

run().catch(console.error)
