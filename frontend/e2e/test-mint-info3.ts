import { Connection, PublicKey } from '@solana/web3.js'

async function main() {
    const connection = new Connection('http://127.0.0.1:8899', 'confirmed')
    // Wait, User 2 is random in Playwright? No, let's just get the last vault's share mint.
    const shareMint = new PublicKey('6bfUcZR5NpnSwBKczggMH7Cqss7QAUeLrv8daKXcSsgx')
    
    // User 1 is 'Afa...' but User 2 is '7Fq...' let's check all accounts owned by shareMint? No, ATA is derived from owner.
    // Let's just find any TokenAccount for shareMint
    const accounts = await connection.getTokenLargestAccounts(shareMint);
    console.log('Largest accounts for shareMint:', accounts.value);
}
main()
