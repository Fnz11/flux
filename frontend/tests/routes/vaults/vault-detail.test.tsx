import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { makeTrade, makeVault } from './fixtures'
import type { Vault } from '@/types'

const mocks = vi.hoisted(() => ({
  id: 'vault-1',
  vault: null as Vault | null,
  vaultLoading: false,
  getHistory: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  messageHandler: undefined as ((message: unknown) => void) | undefined,
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ id: mocks.id }),
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to, params, search }: { children: React.ReactNode; to: string; params?: { id: string }; search?: Record<string, unknown> }) => (
    <a href={params ? to.replace('$id', params.id) : search ? `${to}?${new URLSearchParams(search as Record<string, string>).toString()}` : to}>{children}</a>
  ),
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: null,
    connected: false,
  }),
  useConnection: () => ({
    connection: {
      getAccountInfo: vi.fn().mockResolvedValue(null),
    },
  }),
}))

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <section aria-label={title}><h1>{title}</h1>{children}</section> : null,
}))

vi.mock('@/components/ui/PageHeader', () => ({
  PageHeader: ({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) => (
    <header>
      <h1>{title}</h1>
      {subtitle && <p>{subtitle}</p>}
      {action}
    </header>
  ),
}))

vi.mock('../../../src/hooks/useRouteWsChannel', () => ({ useRouteWsChannel: vi.fn() }))
vi.mock('../../../src/services/apis/rest-api/trade.service', () => ({ getHistory: mocks.getHistory }))
vi.mock('../../../src/services/hooks', () => ({
  useVaultDetailQuery: () => ({
    data: mocks.vault,
    isLoading: mocks.vaultLoading,
    isError: false,
  }),
  useVaultsQuery: () => ({ data: [] }),
  usePortfolioQuery: () => ({ data: [] }),
  useVaultBalancesQuery: () => ({ data: [] }),
  useVaultSparklineQuery: () => ({ data: [] }),
}))
vi.mock('../../../src/stores', () => ({
  useWebSocketStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    subscribe: mocks.subscribe,
    unsubscribe: mocks.unsubscribe,
    onMessage: (handler: (message: unknown) => void) => {
      mocks.messageHandler = handler
      return vi.fn()
    },
  }),
  useTransactionStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    addTransaction: vi.fn(),
    updateStatus: vi.fn(),
  }),
  useAppStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    isManager: false,
  }),
}))

vi.mock('../../../src/components/ui/SolscanLink', () => ({
  SolscanLink: ({ signature }: { signature: string }) => <a href={`https://solscan.io/tx/${signature}`}>Solscan</a>,
}))

vi.mock('../../../src/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: React.ReactNode }) => children,
  Tooltip: ({ children }: { children: React.ReactNode }) => children,
}))

import { VaultOverview } from '../../../src/routes/vaults/$id/_components/VaultOverview'
import { VaultTradesTab } from '../../../src/routes/vaults/$id/_components/VaultTradesTab'
import { VaultDetailPage } from '../../../src/routes/vaults/$id/index'

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('vault detail route', () => {
  beforeEach(() => {
    mocks.vault = makeVault()
    mocks.vaultLoading = false
    mocks.getHistory.mockReset()
    mocks.getHistory.mockResolvedValue({ trades: [] })
  })

  it('renders vault detail page with loaded vault data', () => {
    renderWithClient(<VaultDetailPage />)
    expect(screen.getByRole('heading', { name: 'Alpha Vault' })).toBeInTheDocument()
    expect(screen.getByText(/AUM \(TVL\)/i)).toBeInTheDocument()
    expect(screen.getByText('$125,000.00')).toBeInTheDocument()
    expect(screen.getByText('Active Depositors')).toBeInTheDocument()
    expect(screen.getAllByText('42').length).toBeGreaterThan(0)
  })
})

describe('VaultOverview', () => {
  it('renders metadata, fees, assets, and description with edit link when manager', () => {
    render(<VaultOverview vault={makeVault()} isManager={true} />)
    expect(screen.getByRole('heading', { name: /Investment Strategy/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Protocol Parameters/i })).toBeInTheDocument()
    expect(screen.getByText('15.00% Perf / 2.00% Mgmt')).toBeInTheDocument()
    expect(screen.getByText('SOL')).toBeInTheDocument()
    expect(screen.getByText('A diversified Solana strategy.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Edit/i })).toHaveAttribute('href', '/vaults/vault-1/edit')
  })

  it('does not render edit link when non-manager', () => {
    render(<VaultOverview vault={makeVault()} isManager={false} />)
    expect(screen.queryByRole('link', { name: /Edit/i })).not.toBeInTheDocument()
  })

  it('renders empty assets state and edit link when manager', () => {
    render(<VaultOverview vault={makeVault({ metadata: { displayName: '', description: '', focusAssets: [] } })} isManager={true} />)
    expect(screen.getByText('All whitelisted ecosystem tokens allowed.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Edit/i })).toHaveAttribute('href', '/vaults/vault-1/edit')
  })
})

describe('VaultTradesTab', () => {
  beforeEach(() => {
    mocks.getHistory.mockReset()
    mocks.getHistory.mockResolvedValue({ trades: [] })
    mocks.subscribe.mockReset()
    mocks.unsubscribe.mockReset()
    mocks.messageHandler = undefined
  })

  it('shows loading skeleton before history resolves', () => {
    mocks.getHistory.mockReturnValue(new Promise(() => {}))
    const { container } = render(<VaultTradesTab vaultId="vault-1" />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders empty history', async () => {
    mocks.getHistory.mockResolvedValue({ trades: [] })
    render(<VaultTradesTab vaultId="vault-1" />)
    expect(await screen.findByText('No trades recorded yet')).toBeInTheDocument()
  })

  it('treats history errors as empty', async () => {
    mocks.getHistory.mockRejectedValue(new Error('offline'))
    render(<VaultTradesTab vaultId="vault-1" />)
    expect(await screen.findByText('No trades recorded yet')).toBeInTheDocument()
  })

  it('renders formatted trades and transaction link', async () => {
    mocks.getHistory.mockResolvedValue({ trades: [makeTrade()] })
    render(<VaultTradesTab vaultId="vault-1" />)
    expect(await screen.findByText('Buy')).toHaveClass('text-status-success')
    expect(screen.getByText('2 SOL')).toBeInTheDocument()
    expect(screen.getByText('301.2346 USDC')).toBeInTheDocument()
    expect(screen.getByText('$150.6173')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Solscan' })).toHaveAttribute('href', 'https://solscan.io/tx/signature-1')
  })

  it('subscribes and unsubscribes from vault channel', async () => {
    mocks.getHistory.mockResolvedValue({ trades: [] })
    const { unmount } = render(<VaultTradesTab vaultId="vault-1" />)
    await screen.findByText('No trades recorded yet')
    expect(mocks.subscribe).toHaveBeenCalledWith('vault:vault-1')
    unmount()
    expect(mocks.unsubscribe).toHaveBeenCalledWith('vault:vault-1')
  })

  it('refreshes history for matching confirmed trade', async () => {
    let callCount = 0
    mocks.getHistory.mockImplementation(async () => {
      callCount++
      return callCount === 1 ? { trades: [] } : { trades: [makeTrade({ id: 'trade-2' })] }
    })
    render(<VaultTradesTab vaultId="vault-1" />)
    await screen.findByText('No trades recorded yet')
    mocks.messageHandler?.({ type: 'TRADE_EXECUTED', data: { vault_id: 'vault-1' } })
    await waitFor(() => expect(screen.getByText('Buy')).toBeInTheDocument())
    expect(mocks.getHistory.mock.calls.length).toBeGreaterThanOrEqual(2)
  })
})
