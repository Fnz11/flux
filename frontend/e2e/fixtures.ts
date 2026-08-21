import { test as base, expect, type Page, type Route } from '@playwright/test'

export const WALLET_ADDRESS = '11111111111111111111111111111111'

export const vaults = [
  {
    id: 'alpha',
    address: '11111111111111111111111111111111',
    manager_id: WALLET_ADDRESS,
    manager_address: WALLET_ADDRESS,
    status: 'Active',
    metadata: { displayName: 'Alpha Growth', description: 'SOL momentum strategy', focusAssets: ['SOL', 'USDC'] },
    performance_fee_bps: 1000,
    management_fee_bps: 200,
    tvl: 50_000,
    pnl_percent: 12.5,
    min_raise_amount: 10,
    investor_count: 14,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
  {
    id: 'beta',
    address: '11111111111111111111111111111111',
    manager_id: WALLET_ADDRESS,
    manager_address: WALLET_ADDRESS,
    status: 'Fundraising',
    metadata: { displayName: 'Beta Stable', description: 'Stablecoin yield strategy', focusAssets: ['USDC'] },
    performance_fee_bps: 500,
    management_fee_bps: 100,
    tvl: 12_500,
    pnl_percent: -1.2,
    min_raise_amount: 5,
    investor_count: 3,
    created_at: '2026-02-01T00:00:00Z',
    updated_at: '2026-02-02T00:00:00Z',
  },
]

const position = {
  id: 'position-1',
  user_id: 'user-1',
  vault_id: 'alpha',
  vault_address: vaults[0].address,
  vault_name: 'Alpha Growth',
  shares_owned: 100,
  total_invested_value: 1_000,
  average_entry_price: 10,
  current_value: 1_250,
  pnl: 250,
  pnl_percent: 25,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

type Reply = { status?: number; body?: unknown; delay?: number; abort?: boolean }
type ApiController = {
  set: (method: string, path: string, reply: Reply) => void
  reset: () => void
  requests: Array<{ method: string; path: string; body: unknown }>
}
type WalletController = { connect: () => Promise<void>; disconnect: () => Promise<void> }
type WsController = { send: (message: unknown) => Promise<void>; sent: () => Promise<unknown[]> }

type Fixtures = {
  api: ApiController
  wallet: WalletController
  ws: WsController
}

function json(body: unknown, status = 200): Reply {
  return { body, status }
}

function defaultReply(method: string, path: string, body: unknown): Reply {
  if (method === 'GET' && path === '/config') {
    return json({ dust_threshold: 0.001, focus_assets_whitelist: ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'PYTH'] })
  }
  if (method === 'GET' && path === '/vaults') return json({ vaults, total: vaults.length })
  if (method === 'GET' && /^\/vaults\/[^/]+$/.test(path)) {
    const id = path.split('/')[2]
    const vault = vaults.find((item) => item.id === id)
    return vault ? json(vault) : json({ error: 'Vault not found' }, 404)
  }
  if (method === 'POST' && path === '/vaults') {
    const parsedBody = body as { metadata?: Record<string, unknown> } | null
    return json({ ...vaults[0], id: 'created', metadata: { ...vaults[0].metadata, ...(parsedBody?.metadata ?? {}) } }, 201)
  }
  if (method === 'PATCH' && /\/vaults\/[^/]+\/metadata/.test(path)) {
    return json({ ...vaults[0], metadata: { ...vaults[0].metadata, ...(body as object) } })
  }
  if (method === 'GET' && /\/vaults\/[^/]+\/balances/.test(path)) {
    return json({ balances: [
      { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', amount: 10, usdValue: 1_500 },
      { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', amount: 5_000, usdValue: 5_000 },
    ] })
  }
  if (method === 'GET' && /\/vaults\/[^/]+\/trades/.test(path)) {
    return json({ vault_id: 'alpha', trades: [{ id: 'trade-1', vault_id: 'alpha', actor_id: 'manager', transaction_signature: 'sig', trade_type: 'Buy', input_token: 'SOL', output_token: 'USDC', amount_in: 2, amount_out: 300, price_at_execution: 150, executed_at: '2026-01-03T00:00:00Z' }] })
  }
  if (method === 'GET' && /\/vaults\/[^/]+\/sparkline/.test(path)) {
    return json({ data: { vault_id: 'alpha', range: '30d', points: [{ date: '2026-01-01', value: 100 }, { date: '2026-01-02', value: 110 }] } })
  }
  if (method === 'GET' && path.startsWith('/portfolio/history')) {
    return json({ wallet: WALLET_ADDRESS, range: '30d', points: [{ date: '2026-01-01', value: 1_000 }, { date: '2026-01-02', value: 1_250 }] })
  }
  if (method === 'GET' && path.startsWith('/portfolio/')) return json({ wallet: WALLET_ADDRESS, positions: [position] })
  if (method === 'GET' && path === '/portfolio') return json({ wallet: WALLET_ADDRESS, positions: [position] })
  if (method === 'GET' && path === '/transactions') {
    return json({ items: [{ id: 'tx-1', executed_at: '2026-01-03T00:00:00Z', action: 'deposit', vault_id: 'alpha', vault_name: 'Alpha Growth', symbol: 'SOL', amount: 2, transaction_signature: 'sig', wallet: WALLET_ADDRESS }], total: 1 })
  }
  if (method === 'GET' && path === '/notifications') return json({ items: [], total: 0, page: 1, limit: 10, unread: 0 })
  if (method === 'POST' && path === '/notifications/read') return json({ success: true })
  if (method === 'GET' && path === '/metrics/market') return json({ data: { market_cap: '1000000', market_cap_change_pct: '2.5', circulating_supply: '500000', circulating_change_pct: '1', volume_24h: '250000', volume_24h_change_pct: '-3.2', ath: '10.5', ath_change_pct: '-12', rate: '1.5', rate_change_pct: '0.4', updated_at: '2026-01-02T00:00:00Z' } })
  if (method === 'GET' && path === '/metrics/leaderboard') return json({ data: { type: 'trending', items: [{ rank: 1, name: 'Solana', symbol: 'SOL', tag: 'trending', volume: '1000', change: '12.1', icon: '' }] } })
  if (method === 'GET' && path === '/metrics/series') return json({ metric: 'tvl', period: '30d', summary: { total: '1000', net_change: '100', pct_change: '10', peak: '1100', low: '900', avg: '1000' }, series: [{ date: '2026-01-01', value: '900' }, { date: '2026-01-02', value: '1000' }] })
  if (method === 'GET' && path === '/search') return json({ kind: 'vaults', items: [{ id: 'alpha', address: vaults[0].address, display_name: 'Alpha Growth', tvl: 50_000 }] })
  if (method === 'GET' && path.startsWith('/fees/')) return json({ vault_id: 'alpha', accrued_performance_fee: 100, accrued_management_fee: 20, total_accrued: 120 })
  if (method === 'POST' && path === '/trades/sync') return json({ success: true })
  return json({ error: `Unhandled mock endpoint: ${method} ${path}` }, 501)
}

async function fulfill(route: Route, reply: Reply) {
  if (reply.delay) await new Promise((resolve) => setTimeout(resolve, reply.delay))
  if (reply.abort) return route.abort('failed')
  return route.fulfill({
    status: reply.status ?? 200,
    contentType: 'application/json',
    body: JSON.stringify(reply.body ?? {}),
  })
}

async function installBrowserMocks(page: Page) {
  await page.addInitScript(({ walletAddress }) => {
    const state = { accounts: [] as readonly unknown[], listeners: new Set<(value: unknown) => void>() }
    const bytes = new Uint8Array(32)
    const account = Object.freeze({
      address: walletAddress,
      publicKey: bytes,
      chains: ['solana:devnet', 'solana:mainnet', 'solana:testnet'],
      features: ['solana:signTransaction'],
      label: 'E2E Account',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
    })
    const emit = () => state.listeners.forEach((listener) => listener({ accounts: mockWallet.accounts }))
    const mockWallet = {
      version: '1.0.0',
      name: 'E2E Wallet',
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>',
      chains: ['solana:devnet', 'solana:mainnet', 'solana:testnet'],
      get accounts() { return state.accounts },
      features: {
        'standard:events': { version: '1.0.0', on: (_event: string, listener: (value: unknown) => void) => { state.listeners.add(listener); return () => state.listeners.delete(listener) } },
        'standard:connect': { version: '1.0.0', connect: async () => { state.accounts = [account]; emit(); return { accounts: state.accounts } } },
        'standard:disconnect': { version: '1.0.0', disconnect: async () => { state.accounts = []; emit() } },
        'solana:signTransaction': { version: '1.0.0', supportedTransactionVersions: ['legacy'], signTransaction: async (...inputs: Array<{ transaction: unknown }>) => inputs.map((input) => ({ signedTransaction: input.transaction })) },
      },
    }
    const register = (api: { register: (wallet: unknown) => void }) => api.register(mockWallet)
    window.addEventListener('wallet-standard:app-ready', (event: Event) => register((event as CustomEvent).detail))
    window.dispatchEvent(new CustomEvent('wallet-standard:register-wallet', { detail: register }))

    class FakeWebSocket extends EventTarget {
      static CONNECTING = 0
      static OPEN = 1
      static CLOSING = 2
      static CLOSED = 3
      readyState = FakeWebSocket.CONNECTING
      sent: string[] = []
      onopen: ((event: Event) => void) | null = null
      onmessage: ((event: MessageEvent) => void) | null = null
      onclose: ((event: CloseEvent) => void) | null = null
      onerror: ((event: Event) => void) | null = null
      constructor(public url: string) {
        super()
        const win = window as unknown as { __mockSockets: FakeWebSocket[] }
        win.__mockSockets.push(this)
        queueMicrotask(() => {
          this.readyState = FakeWebSocket.OPEN
          const event = new Event('open')
          this.onopen?.(event)
          this.dispatchEvent(event)
        })
      }
      send(data: string) { this.sent.push(data) }
      close() {
        this.readyState = FakeWebSocket.CLOSED
        const event = new CloseEvent('close')
        this.onclose?.(event)
        this.dispatchEvent(event)
      }
      inject(data: unknown) {
        const event = new MessageEvent('message', { data: JSON.stringify(data) })
        this.onmessage?.(event)
        this.dispatchEvent(event)
      }
    }

    interface MockWindowExtended {
      __mockSockets: FakeWebSocket[]
      __mockWsMessage: (data: unknown) => void
      __mockWallet: typeof mockWallet
      WebSocket: typeof FakeWebSocket
    }

    const mockWin = window as unknown as MockWindowExtended
    mockWin.__mockSockets = []
    mockWin.__mockWsMessage = (data: unknown) => mockWin.__mockSockets.forEach((socket: FakeWebSocket) => socket.inject(data))
    mockWin.__mockWallet = mockWallet
    mockWin.WebSocket = FakeWebSocket
  }, { walletAddress: WALLET_ADDRESS })
}

export const test = base.extend<Fixtures>({
  api: [async ({ page }, use) => {
    const overrides = new Map<string, Reply>()
    const requests: ApiController['requests'] = []
    await page.route('**/api/v1/**', async (route) => {
      const request = route.request()
      const url = new URL(request.url())
      if (url.pathname.endsWith('/ws')) return route.abort()
      const path = url.pathname.replace(/^.*\/api\/v1/, '')
      const method = request.method()
      const body = request.postDataJSON?.() ?? request.postData()
      requests.push({ method, path, body })
      await fulfill(route, overrides.get(`${method} ${path}`) ?? defaultReply(method, path, body))
    })
    await page.route('https://hermes.pyth.network/**', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ parsed: [{ id: 'price', price: { price: '15000', conf: '10', expo: -2, publish_time: Math.floor(Date.now() / 1000) } }] }),
    }))
    await page.route('https://api.devnet.solana.com/**', async (route) => {
      const rpc = route.request().postDataJSON() as { id?: number; method?: string } | null
      const results: Record<string, unknown> = {
        getBalance: { context: { slot: 1 }, value: 10_000_000_000 },
        getAccountInfo: { context: { slot: 1 }, value: null },
        getLatestBlockhash: { context: { slot: 1 }, value: { blockhash: '11111111111111111111111111111111', lastValidBlockHeight: 999 } },
        sendTransaction: 'E2ETransactionSignature111111111111111111111111111',
        getSignatureStatuses: { context: { slot: 1 }, value: [{ confirmationStatus: 'confirmed', confirmations: 1, err: null, slot: 1 }] },
      }
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ jsonrpc: '2.0', id: rpc?.id ?? 1, result: results[rpc?.method ?? ''] ?? null }) })
    })
    await installBrowserMocks(page)
    await use({ set: (method, path, reply) => overrides.set(`${method.toUpperCase()} ${path}`, reply), reset: () => overrides.clear(), requests })
  }, { auto: true }],
  wallet: [async ({ page, api: _api }, use) => {
    await use({
      connect: async () => {
        await page.getByRole('button', { name: 'Connect Wallet' }).first().click()
        await page.getByRole('button', { name: /E2E Wallet/ }).click()
        await expect(page.getByText('1111...1111').first()).toBeVisible()
      },
      disconnect: async () => {
        await page.getByText('1111...1111').first().click()
        await page.getByRole('button', { name: 'Disconnect' }).click()
      },
    })
  }, { auto: true }],
  ws: [async ({ page, api: _api }, use) => {
    await use({
      send: (message) =>
        page.evaluate((value) => {
          const win = window as unknown as { __mockWsMessage: (val: unknown) => void }
          win.__mockWsMessage(value)
        }, message),
      sent: () =>
        page.evaluate(() => {
          const win = window as unknown as { __mockSockets: Array<{ sent: string[] }> }
          return win.__mockSockets.flatMap((socket) => socket.sent.map((msg) => JSON.parse(msg)))
        }),
    })
  }, { auto: true }],
})

export { expect }
