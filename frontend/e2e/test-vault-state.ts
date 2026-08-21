import { Connection, PublicKey } from '@solana/web3.js'
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor'
import fs from 'fs'

async function main() {
    const IDL = JSON.parse(fs.readFileSync('../contracts/target/idl/fbyt_clone_vault.json', 'utf8'))
    const connection = new Connection('http://127.0.0.1:8899', 'confirmed')
    const programId = new PublicKey(IDL.address)
    const provider = new AnchorProvider(connection, {} as Wallet, {})
    const program = new Program(IDL as any, provider)
    
    const vaults = await program.account.vaultState.all()
    console.log(vaults.map(v => ({
        pubkey: v.publicKey.toString(),
        shareMint: v.account.shareTokenMint.toString(),
        depositMint: v.account.depositMint.toString()
    })))
    
    // Pick the last one and fetch raw info
    const lastVault = vaults[vaults.length - 1].publicKey;
    const info = await connection.getAccountInfo(lastVault)
    const data = info?.data!
    
    let offset = 72;
    if (data[offset] === 0) {
        offset += 1;
    } else {
        offset += 33;
    }
    
    console.log('Deposit Mint:', new PublicKey(data.slice(offset, offset + 32)).toString())
    offset += 32
    console.log('Share Mint:', new PublicKey(data.slice(offset, offset + 32)).toString())
}
main()
