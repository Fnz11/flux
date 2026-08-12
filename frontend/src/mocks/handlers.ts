import { http, HttpResponse } from 'msw'
import {
  ApiVaultListResponse,
  ApiPortfolioResponse,
  ApiTradeHistoryResponse,
  NotificationsResponse,
  GlobalTransactionsResponse,
  ApiConfig,
  ApiFee,
  ApiPortfolioHistoryResponse,
} from '../types'

const baseVault = {
  id: 'v_1',
  address: 'Vault11111111111111111111111111111111111111',
  manager_id: 'manager_1',
  manager_address: 'Manager11111111111111111111111111111111111',
  status: 'Active',
  metadata: { displayName: 'Alpha Vault', description: 'Test', focusAssets: ['SOL', 'USDC'] },
  performance_fee_bps: 1000,
  management_fee_bps: 200,
  tvl: 50000,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
}

const historyTrades: ApiTradeHistoryResponse = {
  vault_id: 'v_1',
  trades: [
    {
      id: 't_1',
      vault_id: 'v_1',
      actor_id: 'manager_1',
      transaction_signature: 'sig_trade_1',
      trade_type: 'Buy',
      input_token: 'SOL',
      output_token: 'USDC',
      amount_in: 10,
      amount_out: 1400,
      price_at_execution: 140,
      executed_at: '2026-01-03T00:00:00Z',
    },
  ],
}

export const handlers = [
  // Vaults
  http.get('*/api/v1/vaults', ({ request }) => {
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    if (status && status !== 'All' && status.toLowerCase() !== 'active') {
      return HttpResponse.json<ApiVaultListResponse>({ vaults: [], total: 0 })
    }
    return HttpResponse.json<ApiVaultListResponse>({
      vaults: [baseVault],
      total: 1,
    })
  }),
  http.get('*/api/v1/vaults/:id', ({ params }) => {
    if (params.id === 'missing') {
      return HttpResponse.json({ error: 'Vault not found' }, { status: 404 })
    }
    return HttpResponse.json({ ...baseVault, id: params.id as string })
  }),
  http.post('*/api/v1/vaults', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...baseVault, id: 'v_created', metadata: { ...baseVault.metadata, ...(body as any)?.metadata } }, { status: 201 })
  }),
  http.patch('*/api/v1/vaults/:id', async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ ...baseVault, metadata: { ...baseVault.metadata, ...(body as any) } })
  }),
  http.get('*/api/v1/vaults/:id/balances', () => {
    return HttpResponse.json({
      balances: [
        { mint: 'So11111111111111111111111111111111111111112', symbol: 'SOL', amount: 10, usdValue: 1400 },
        { mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', symbol: 'USDC', amount: 5000, usdValue: 5000 },
      ],
    })
  }),
  http.get('*/api/v1/vaults/:id/sparkline', () => {
    return HttpResponse.json({
      data: {
        vault_id: 'v_1',
        range: '30d',
        points: [
          { date: '2026-01-01', value: 10 },
          { date: '2026-01-02', value: 12 },
        ],
      },
    })
  }),
  http.get('*/api/v1/vaults/:id/trades', () => HttpResponse.json(historyTrades)),
  http.post('*/api/v1/trades/sync', async ({ request }) => {
    await request.json()
    return HttpResponse.json({ success: true })
  }),

  // Portfolio
  http.get('*/api/v1/portfolio', () => {
    return HttpResponse.json<ApiPortfolioResponse>({
      wallet: 'Investor11111111111111111111111111111111111',
      positions: [
        {
          id: 'pos_1',
          user_id: 'u_1',
          vault_id: 'v_1',
          vault_address: 'Vault11111111111111111111111111111111111111',
          vault_name: 'Alpha Vault',
          shares_owned: 100,
          total_invested_value: 1000,
          average_entry_price: 10,
          current_value: 1500,
          pnl: 500,
          pnl_percent: 50,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
      ],
    })
  }),
  http.get('*/api/v1/portfolio/:wallet', () => {
    return HttpResponse.json<ApiPortfolioResponse>({
      wallet: 'Investor11111111111111111111111111111111111',
      positions: [
        {
          id: 'pos_1',
          user_id: 'u_1',
          vault_id: 'v_1',
          vault_address: 'Vault11111111111111111111111111111111111111',
          vault_name: 'Alpha Vault',
          shares_owned: 100,
          total_invested_value: 1000,
          average_entry_price: 10,
          current_value: 1500,
          pnl: 500,
          pnl_percent: 50,
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-02T00:00:00Z',
        },
      ],
    })
  }),
  http.get('*/api/v1/portfolio/history', () => {
    return HttpResponse.json<ApiPortfolioHistoryResponse>({
      wallet: 'Investor11111111111111111111111111111111111',
      range: '30d',
      points: [
        { date: '2026-01-01', value: 1000 },
        { date: '2026-01-02', value: 1100 },
      ],
    })
  }),

  // Search
  http.get('*/api/v1/search', ({ request }) => {
    const url = new URL(request.url)
    const role = url.searchParams.get('role')
    const q = url.searchParams.get('q') ?? ''
    if (role === 'manager') {
      return HttpResponse.json({ kind: 'pairs', items: [{ symbol: `${q}/USDC`, tvl: 0 }] })
    }
    return HttpResponse.json({ kind: 'vaults', items: [{ id: 'v_1', address: 'Vault11111111111111111111111111111111111111', display_name: 'Alpha Vault', tvl: 50000 }] })
  }),

  // Notifications
  http.get('*/api/v1/notifications', () => {
    return HttpResponse.json<NotificationsResponse>({
      items: [
        {
          id: 'notif_1',
          type: 'TX_CONFIRMED',
          title: 'Deposit Successful',
          message: 'You have deposited 100 SOL',
          read: false,
          created_at: '2026-01-01T00:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 10,
      unread: 1,
    })
  }),
  http.post('*/api/v1/notifications/read', () => {
    return HttpResponse.json({ success: true })
  }),

  // Transactions
  http.get('*/api/v1/transactions', () => {
    return HttpResponse.json<GlobalTransactionsResponse>({
      items: [
        {
          id: 'gtx_1',
          executed_at: '2026-01-01T00:00:00Z',
          action: 'deposit',
          vault_id: 'v_1',
          vault_name: 'Alpha Vault',
          symbol: 'SOL',
          amount: 100,
          transaction_signature: 'SIG_TX_1',
          wallet: 'Investor11111111111111111111111111111111111',
        },
      ],
      total: 1,
    })
  }),

  // Config
  http.get('*/api/v1/config', () => {
    return HttpResponse.json<ApiConfig>({
      dust_threshold: 0.001,
      focus_assets_whitelist: ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'PYTH'],
    })
  }),

  // Fees
  http.get('*/api/v1/fees/:vaultId', () => {
    return HttpResponse.json<ApiFee>({
      vault_id: 'v_1',
      accrued_performance_fee: 100,
      accrued_management_fee: 20,
      total_accrued: 120,
    })
  }),

  // Metrics
  http.get('*/api/v1/metrics/market', () => {
    return HttpResponse.json({
      data: {
        market_cap: '1000000000',
        market_cap_change_pct: '2.5',
        circulating_supply: '500000000',
        circulating_change_pct: '1.0',
        volume_24h: '250000',
        volume_24h_change_pct: '-3.2',
        ath: '10.5',
        ath_change_pct: '-12.0',
        rate: '1.5',
        rate_change_pct: '0.4',
        updated_at: '2026-01-02T00:00:00Z',
      },
    })
  }),
  http.get('*/api/v1/metrics/leaderboard', () => {
    return HttpResponse.json({
      data: {
        type: 'trending',
        items: [
          { rank: 1, name: 'SOL', symbol: 'SOL', tag: 'trending', volume: '1000', change: '12.1', icon: '' },
        ],
      },
    })
  }),
  http.get('*/api/v1/metrics/series', () => {
    return HttpResponse.json({
      metric: 'tvl',
      period: '30d',
      summary: { total: '1000', net_change: '100', pct_change: '10', peak: '1100', low: '900', avg: '1000' },
      series: [
        { date: '2026-01-01', value: '900' },
        { date: '2026-01-02', value: '1000' },
      ],
    })
  }),
]