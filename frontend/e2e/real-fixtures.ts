import { test as base, expect, type Page } from '@playwright/test'
import { Keypair, Connection, VersionedTransaction } from '@solana/web3.js'
import bs58 from 'bs58'
import nacl from 'tweetnacl'

export const user1Keypair = Keypair.generate()
export const user2Keypair = Keypair.generate()

const connection = new Connection('http://127.0.0.1:8899', 'confirmed')

type WalletController = {
  connect: (user: 1 | 2) => Promise<void>
  disconnect: () => Promise<void>
}

type Fixtures = {
  wallet: WalletController
}

export const test = base.extend<Fixtures>({
  wallet: async ({ page }, use) => {
    page.on('console', msg => console.log(`[Browser] ${msg.type()}: ${msg.text()}`))
    page.on('pageerror', err => console.log(`[Browser Error]: ${err.message}`))

    // Airdrop SOL
    try {
      await connection.requestAirdrop(user1Keypair.publicKey, 10 * 1e9)
      await connection.requestAirdrop(user2Keypair.publicKey, 10 * 1e9)
      // wait a bit for airdrop
      await new Promise(r => setTimeout(r, 1000))
    } catch(e) {}

    await page.exposeFunction('signMessageBytes', async (msgBase64: string, skBase58: string) => {
      const msg = Uint8Array.from(Buffer.from(msgBase64, 'base64'))
      const sk = bs58.decode(skBase58)
      const sig = nacl.sign.detached(msg, sk)
      return Buffer.from(sig).toString('base64')
    })

    await page.exposeFunction('signTransactionBytes', async (txBase64: string, skBase58: string) => {
      const txBytes = Buffer.from(txBase64, 'base64');
      const sk = bs58.decode(skBase58);
      
      const keypair = Keypair.fromSecretKey(sk);
      
      const vtx = VersionedTransaction.deserialize(txBytes);
      vtx.sign([keypair]);
      
      return Buffer.from(vtx.serialize()).toString('base64');
    })

    // Use addInitScript to install the mock wallet before the page loads
    await page.addInitScript(() => {
      const state = { accounts: [], listeners: new Set<any>() }
      const emit = () => state.listeners.forEach(l => l({ accounts: state.accounts }))

      const mockWallet = {
        version: '1.0.0',
        name: 'E2E Wallet',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxMDAgMTAwIj48Y2lyY2xlIGN4PSI1MCIgY3k9IjUwIiByPSI1MCIvPjwvc3ZnPg==',
        chains: ['solana:devnet', 'solana:localnet', 'solana:mainnet', 'solana:testnet'],
        get accounts() { return state.accounts },
        features: {
          'standard:events': { version: '1.0.0', on: (e: string, l: any) => { state.listeners.add(l); return () => state.listeners.delete(l) } },
          'standard:connect': { version: '1.0.0', connect: async () => { 
            emit(); 
            return { accounts: state.accounts } 
          }},
          'standard:disconnect': { version: '1.0.0', disconnect: async () => { state.accounts = []; emit() } },
          'solana:signTransaction': { 
            version: '1.0.0', 
            supportedTransactionVersions: ['legacy', 0], 
          signTransaction: async (...inputs: any[]) => {
            const results = [];
            for (const input of inputs) {
              const txBytes = input.transaction; // Uint8Array
              
              const skBase58 = (window as any).__e2eActiveSecretKey;
              const txBase64 = btoa(String.fromCharCode(...txBytes));
              
              // Call our exposed Node function to deserialize and sign
              const signedBase64 = await (window as any).signTransactionBytes(txBase64, skBase58);
              const signedBytes = Uint8Array.from(atob(signedBase64), c => c.charCodeAt(0));
              
              results.push({ signedTransaction: signedBytes });
            }
            return results;
          }
          },
          'solana:signMessage': {
            version: '1.0.0',
            signMessage: async (...inputs: any[]) => {
              const results = [];
              for (const input of inputs) {
                const msgBytes = input.message;
                const skBase58 = (window as any).__e2eActiveSecretKey;
                const msgBase64 = btoa(String.fromCharCode(...msgBytes));
                const signedBase64 = await (window as any).signMessageBytes(msgBase64, skBase58);
                const signedBytes = Uint8Array.from(atob(signedBase64), c => c.charCodeAt(0));
                results.push({ signedMessage: signedBytes, signature: signedBytes });
              }
              return results;
            }
          },
        },
      }
      
      const register = (api: any) => api.register(mockWallet)
      window.addEventListener('wallet-standard:app-ready', (e: any) => register(e.detail))
      window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register }))

      window.addEventListener('set-e2e-account', (e: any) => {
         const detail = e.detail;
         mockWallet.name = detail.walletName;
         (window as any).__e2eActiveSecretKey = detail.skBase58;
         (window as any).__e2eActivePublicKeyBytes = new Uint8Array(detail.pkBytes);
         state.accounts = [{ 
           address: detail.pkBase58, 
           publicKey: new Uint8Array(detail.pkBytes), 
           chains: ['solana:devnet', 'solana:localnet', 'solana:mainnet', 'solana:testnet'], 
           features: ['solana:signTransaction', 'solana:signMessage'] 
         }];
         emit();
      })
    })

    await use({
      connect: async (user: 1 | 2) => {
        const kp = user === 1 ? user1Keypair : user2Keypair
        const pkBase64 = Buffer.from(kp.publicKey.toBytes()).toString('base64')
        const pkBase58 = kp.publicKey.toBase58()
        const skBase58 = bs58.encode(kp.secretKey)
        const walletName = `E2E Wallet` // We keep the name static so the button is always "E2E Wallet"
        
        await page.evaluate(({ pkBase64, pkBase58, skBase58, walletName }) => {
            const pkBytes = Uint8Array.from(atob(pkBase64), c => c.charCodeAt(0))
            const ev = new CustomEvent('set-e2e-account', { detail: { pkBase58, pkBytes, skBase58, walletName } })
            window.dispatchEvent(ev)
        }, { pkBase64, pkBase58, skBase58, walletName })

        const isConnected = !(await page.getByRole('button', { name: 'Connect Wallet' }).first().isVisible().catch(() => false));
        if (!isConnected) {
            // Wait for hydration by retrying the click if the modal doesn't appear
            await expect(async () => {
                await page.getByRole('button', { name: 'Connect Wallet' }).first().click()
                await expect(page.getByRole('button', { name: new RegExp(walletName) })).toBeVisible({ timeout: 2000 })
            }).toPass()
            await page.getByRole('button', { name: new RegExp(walletName) }).click()
        }
        
        const shortAddr = pkBase58.slice(0, 4) + '...' + pkBase58.slice(-4)
        await expect(page.getByText(shortAddr).first()).toBeVisible({ timeout: 10000 })
      },
      disconnect: async () => {
        // Find the wallet address button (e.g. 7X...AbC)
        const addrBtn = page.locator('button').filter({ hasText: '...' }).first()
        if (await addrBtn.isVisible()) {
            await addrBtn.click()
            await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible()
            await page.getByRole('button', { name: 'Disconnect' }).click()
            // Wait until Connect Wallet appears
            await expect(page.getByRole('button', { name: 'Connect Wallet' }).first()).toBeVisible()
        }
      }
    })
  }
})

export { expect }
