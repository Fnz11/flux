import { Connection, PublicKey } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'
import idl from './lib/idl.json'

const connection = new Connection('http://127.0.0.1:8899', 'confirmed')

async function run() {
  const provider = new anchor.AnchorProvider(connection, null as any, {})
  const program = new anchor.Program(idl as anchor.Idl, new PublicKey('FJY6JUzQybrA5CbM9jgnTJtndhEU6vBAFF5vCuvq6Ais'), provider)

  // Get all vault states
  const vaults = await program.account.vaultState.all()
  if (vaults.length === 0) {
    console.log('No vaults found')
    return
  }

  const vaultAccount = vaults[vaults.length - 1].account as any
  console.log('Last Vault Pubkey:', vaults[vaults.length - 1].publicKey.toBase58())
  console.log('Status type:', typeof vaultAccount.status)
  console.log('Status value:', JSON.stringify(vaultAccount.status))
  
  const isFundraising =
    (vaultAccount.status && typeof vaultAccount.status === 'object' && ('fundraising' in vaultAccount.status || 'Fundraising' in vaultAccount.status)) ||
    vaultAccount.status === 0

  console.log('isFundraising:', isFundraising)
}

run()
