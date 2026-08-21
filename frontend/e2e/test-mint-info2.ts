import { Connection, PublicKey } from '@solana/web3.js'
import { MintLayout } from '@solana/spl-token'

async function main() {
    const connection = new Connection('http://127.0.0.1:8899', 'confirmed')
    const shareMint = new PublicKey('Apd65J7BXus4KAjALonc5G1HJTZfytiJrSugtA1zRAjt')
    
    const info = await connection.getAccountInfo(shareMint)
    if (!info) {
        console.log('Account does not exist!')
    } else {
        console.log('Owner:', info.owner.toString())
        console.log('Data length:', info.data.length)
        const mintInfo = MintLayout.decode(info.data)
        console.log('Mint Info:', mintInfo)
    }
}
main()
