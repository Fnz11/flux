import { test, expect } from './fixtures'

test.describe('Investor Flows', () => {
  test('browses top vaults and navigates to vault detail view', async ({ page }) => {
    await page.goto('/invest')
    await expect(page.getByRole('heading', { name: 'Invest', exact: true })).toBeVisible()

    // Top Vaults section should list Alpha Growth
    await expect(page.getByText('Alpha Growth').first()).toBeVisible()
    await expect(page.getByText('SOL momentum strategy').first()).toBeVisible()

    // Click on Alpha Growth card/link to open vault detail page
    await page.getByText('Alpha Growth').first().click()
    await expect(page).toHaveURL(/\/invest\/vaults\/alpha/)
    await expect(page.getByRole('heading', { name: 'Alpha Growth' })).toBeVisible()
  })

  test('completes deposit modal flow', async ({ page, wallet }) => {
    await page.goto('/invest/vaults/alpha')
    await wallet.connect()

    // Click Deposit button
    await page.getByRole('button', { name: 'Deposit', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Deposit', exact: true })).toBeVisible()

    // Fill amount in form
    await page.locator('#deposit-amount').fill('2.5')
    await page.getByRole('button', { name: 'Next' }).click()

    // Confirmation step
    await expect(page.getByRole('heading', { name: 'Confirm Deposit' })).toBeVisible()
    await expect(page.getByText('share tokens for 2.5 SOL')).toBeVisible()

    // Confirm deposit
    await page.getByRole('button', { name: 'Confirm & Sign' }).click()

    // Success step
    await expect(page.getByRole('heading', { name: 'Deposit Complete' })).toBeVisible()
    await page.getByRole('button', { name: 'Done' }).click()
  })

  test('completes withdraw modal flow', async ({ page, wallet }) => {
    await page.goto('/invest/vaults/alpha')
    await wallet.connect()

    // Position exists (from fixtures default position for wallet)
    await expect(page.getByRole('heading', { name: 'Your Position' })).toBeVisible()

    // Click Withdraw button
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'Withdraw', exact: true })).toBeVisible()

    // Fill share amount or click Max
    await page.getByRole('button', { name: /Max/ }).click()

    // Click Withdraw confirm
    await page.getByRole('button', { name: 'Withdraw', exact: true }).click()

    // Solscan link / signature shown after withdrawal
    await expect(page.getByText(/View on Solscan/i)).toBeVisible()
    await page.getByRole('button', { name: 'Close' }).click()
  })
})
