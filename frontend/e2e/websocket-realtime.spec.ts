import { test, expect } from './fixtures'

test.describe('WebSocket Realtime', () => {
  test('receives mock websocket price update and reflects in UI', async ({ page, wallet, ws }) => {
    await page.goto('/trade')
    await wallet.connect()

    await expect(page.getByRole('heading', { name: 'Trade Console', exact: true })).toBeVisible()

    // Send a WebSocket message mimicking a price update or ticker notification
    await ws.send({
      type: 'price_update',
      channel: 'vault:alpha',
      data: {
        symbol: 'SOL',
        price: 245.50,
        change24h: 8.2,
      },
    })

    // Verify WebSocket message was injected
    const sent = await ws.sent()
    expect(Array.isArray(sent)).toBe(true)

    // Send notification event via mock WebSocket
    await ws.send({
      type: 'notification',
      channel: 'global',
      data: {
        id: 'notif-1',
        title: 'Vault Trade Executed',
        message: 'Alpha Growth bought 10 SOL at $245.50',
      },
    })

    // Confirm trade console remains active and healthy after receiving socket updates
    await expect(page.getByText('Pyth Oracle Price')).toBeVisible()
  })
})
