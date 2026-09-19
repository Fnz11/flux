import { test, expect } from './real-fixtures'

test('Real E2E: Create, Deposit, Trade, Withdraw', async ({ page, wallet }) => {
  test.setTimeout(120000) // 2 minutes, as blockchain txs take time
  
  await page.goto('/')
  
  // 1. User 1 connects wallet
  await wallet.connect(1)
  
  // Create vault
  await page.getByRole('button', { name: 'Manager', exact: true }).click()
  await page.getByRole('link', { name: 'Create Vault' }).click()
  await page.getByLabel('Display Name').fill('E2E Test Vault')
  await page.getByLabel('Strategy Description (Optional)').fill('Real e2e test')
  await page.getByLabel('Min. Raise Amount').fill('0.1')
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: /^CREATE VAULT$/i }).click()
  
  // Wait for success toast
  await expect(page.locator('text=Vault created successfully')).toBeVisible({ timeout: 20000 })
  
  // Wait for the redirect to /vaults
  await page.waitForURL('**/vaults')
  
  // Find the vault row and click View (User 1 is still connected)
  await page.locator('.group').filter({ hasText: 'E2E Test Vault' }).first().getByRole('link', { name: 'View' }).click()
  
  // Wait to navigate to the vault details page
  await page.waitForURL('**/vaults/*')
  
  // Grab the vault URL
  const vaultUrl = page.url()
  
  // 2. Navigate and connect User 2
  await wallet.disconnect()
  await page.goto(vaultUrl)
  await wallet.connect(2)
  
  // Click Deposit button on vault details page to open modal
  await page.getByRole('button', { name: 'Deposit' }).click()
  
  // User 2 deposits
  await page.getByPlaceholder('0.00').fill('0.5') // 0.5 SOL
  await page.getByRole('button', { name: 'Next' }).click() // Click Next in modal
  await page.getByRole('button', { name: 'Confirm & Sign' }).click() // Click Confirm & Sign
  
  await expect(page.locator('text=Deposit Complete').first()).toBeVisible({ timeout: 20000 })
  await page.getByRole('button', { name: 'Done' }).click()
  
  // 3. Disconnect User 2, connect User 1
  await wallet.disconnect()
  await wallet.connect(1)
  
  // User 1 goes to Trade
  await page.getByRole('button', { name: 'Manager', exact: true }).click().catch(() => {}) // Ignore if already in manager mode
  await page.getByRole('link', { name: 'Trade' }).click()
  
  // Trade 1: SOL -> USDC
  await page.getByRole('button', { name: 'Select pay token' }).click()
  await page.getByRole('option', { name: 'SOL' }).click()
  await page.getByRole('button', { name: 'Select receive token' }).click()
  await page.getByRole('option', { name: 'USDC' }).click()
  await page.getByPlaceholder('0.00').first().fill('0.1')
  await page.getByRole('button', { name: 'Execute Swap' }).click()
  await page.getByRole('button', { name: 'Confirm Swap' }).click()
  await expect(page.locator('text=Trade executed successfully')).toBeVisible({ timeout: 20000 })
  
  // Trade 2: USDC -> JUP
  await page.getByRole('button', { name: 'Select pay token' }).click()
  await page.getByRole('option', { name: 'USDC' }).click()
  await page.getByRole('button', { name: 'Select receive token' }).click()
  await page.getByRole('option', { name: 'JUP' }).click()
  await page.getByPlaceholder('0.00').first().fill('5') // 5 USDC
  await page.getByRole('button', { name: 'Execute Swap' }).click()
  await page.getByRole('button', { name: 'Confirm Swap' }).click()
  await expect(page.locator('text=Trade executed successfully')).toBeVisible({ timeout: 20000 })
  
  // Trade 3: USDC -> PYTH
  // Note: Since we swapped to JUP, we need to swap USDC -> PYTH? We need USDC. Wait! We traded 0.1 SOL -> ~15 USDC. Then 5 USDC -> JUP. We still have ~10 USDC.
  await page.getByRole('button', { name: 'Select pay token' }).click()
  await page.getByRole('option', { name: 'USDC' }).click()
  await page.getByRole('button', { name: 'Select receive token' }).click()
  await page.getByRole('option', { name: 'PYTH' }).click()
  await page.getByPlaceholder('0.00').first().fill('5') // 5 USDC
  await page.getByRole('button', { name: 'Execute Swap' }).click()
  await page.getByRole('button', { name: 'Confirm Swap' }).click()
  await expect(page.locator('text=Trade executed successfully')).toBeVisible({ timeout: 20000 })
  
  // Vault now has SOL, USDC, JUP, PYTH. That is 4 assets.
  
  // 4. Disconnect User 1, connect User 2
  await wallet.disconnect()
  
  await page.goto(vaultUrl)
  await wallet.connect(2)
  
  await page.getByRole('button', { name: 'Withdraw' }).first().click() // Open modal
  
  // User 2 withdraws a small amount
  await page.getByPlaceholder('0.00').fill('0.1')
  await page.getByRole('button', { name: 'Withdraw', exact: true }).click()
  
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible({ timeout: 20000 })
})
