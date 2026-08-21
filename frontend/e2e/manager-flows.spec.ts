import { test, expect } from './fixtures'

test.describe('Manager Flows', () => {
  test('fills and submits vault creation form', async ({ page, wallet, api }) => {
    await page.goto('/vaults/create')
    await wallet.connect()

    await expect(page.getByRole('heading', { name: 'Create Vault', exact: true })).toBeVisible()

    // Fill Display Name and Strategy Description
    await page.getByPlaceholder('e.g. Solana High Yield Alpha').fill('E2E Yield Master')
    await page.getByPlaceholder('Describe your vault trading strategy').fill('Automated high frequency momentum trading strategy on Solana DEXs.')

    // Set Min Raise Amount
    await page.getByLabel('Min. Raise Amount').fill('50')

    // Set slippage/fees or keep defaults (Management Fee 2%, Performance Fee 10%)
    // Check agreement box
    await page.getByRole('checkbox').check()

    // Submit form
    await page.getByRole('button', { name: 'CREATE VAULT' }).click()

    // Verify API POST request was captured
    await expect.poll(() => api.requests.some((r) => r.method === 'POST' && r.path.includes('/tx/prepare/create-vault'))).toBe(true)

    // Should redirect to /vaults
    await expect(page).toHaveURL(/\/vaults/)
  })

  test('submits manager trade form with leverage/slippage settings', async ({ page, wallet, api }) => {
    await page.goto('/trade')
    await wallet.connect()

    await expect(page.getByRole('heading', { name: 'AMM Trade Console', exact: true })).toBeVisible()

    // Select vault if needed (default preselected first vault)
    // Fill input pay amount
    await page.getByPlaceholder('0.00').first().fill('1.5')

    // Adjust slippage tolerance setting (click 1.0%)
    await page.getByRole('button', { name: '1%', exact: true }).click()

    // Click Execute Swap button
    await page.getByRole('button', { name: 'Execute Swap' }).click()

    // Confirmation modal pops up
    await expect(page.getByRole('heading', { name: 'Confirm Trade' })).toBeVisible()
    await expect(page.getByText('1.500000 SOL')).toBeVisible()
    await expect(page.getByText('Slippage', { exact: true })).toBeVisible()

    // Confirm Swap
    await page.getByRole('button', { name: 'Confirm Swap' }).click()

    // Check trade sync / trade execution requested
    await expect.poll(() => api.requests.some((r) => r.method === 'POST' && r.path === '/trades/sync'), { timeout: 15000 }).toBe(true)
  })
})
