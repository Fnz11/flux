import { test, expect } from './fixtures'

test.describe('Auth and Navigation Flow', () => {
  test('connects and disconnects wallet using E2E mock wallet fixture', async ({ page, wallet }) => {
    await page.goto('/')

    // Initially wallet is disconnected
    await expect(page.getByRole('button', { name: 'Connect Wallet' }).first()).toBeVisible()

    // Connect wallet
    await wallet.connect()
    await expect(page.getByText('1111...1111').first()).toBeVisible()

    // Disconnect wallet
    await wallet.disconnect()
    await expect(page.getByRole('button', { name: 'Connect Wallet' }).first()).toBeVisible()
  })

  test('navigates between /vaults, /trade, /invest, /portfolio and toggles App Mode', async ({ page, wallet }) => {
    await page.goto('/vaults')
    await expect(page.getByRole('heading', { name: 'Vaults', exact: true })).toBeVisible()

    // Connect wallet to reveal App Mode switch in sidebar
    await wallet.connect()

    // Default mode is Manager, navigate to /trade
    await page.getByRole('link', { name: 'Trade' }).click()
    await expect(page.getByRole('heading', { name: 'AMM Trade Console', exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/trade/)

    // Switch mode to Invest via App Mode toggle in Sidebar
    await page.getByRole('button', { name: 'Invest', exact: true }).click()
    await expect(page).toHaveURL(/\/invest/)
    await expect(page.getByRole('heading', { name: 'Invest', exact: true })).toBeVisible()

    // Navigate to Portfolio in Invest Mode
    await page.getByRole('link', { name: 'Portfolio' }).click()
    await expect(page.getByRole('heading', { name: 'Dashboard', exact: true })).toBeVisible()
    await expect(page).toHaveURL(/\/portfolio/)

    // Switch back to Manager Mode
    await page.getByRole('button', { name: 'Manager', exact: true }).click()
    await page.getByRole('link', { name: 'Vaults' }).click()
    await expect(page).toHaveURL(/\/vaults/)
  })
})
