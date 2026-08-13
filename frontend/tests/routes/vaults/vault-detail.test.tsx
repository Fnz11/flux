import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeTrade, makeVault } from './fixtures'

const mocks = vi.hoisted(() => ({
  id: 'vault-1',
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
  Link: ({ children, to, params }: { children: React.ReactNode; to: string; params?: { id: string } }) => (
    <a href={params ? to.replace('$id', params.id) : to}>{children}</a>
  ),
}))

vi.mock('../../../src/hooks/useRouteWsChannel', () => ({ useRouteWsChannel: vi.fn() }))
vi.mock('../../../src/services/apis/rest-api/trade.service', () => ({ getHistory: mocks.getHistory }))
vi.mock('../../../src/stores', () => ({
  useWebSocketStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    subscribe: mocks.subscribe,
    unsubscribe: mocks.unsubscribe,
    onMessage: (handler: (message: unknown) => void) => {
      mocks.messageHandler = handler
      return vi.fn()
    },
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
import { Route } from '../../../src/routes/vaults/$id/index'

const VaultDetailPage = (Route as unknown as { component: React.ComponentType }).component

describe('vault detail route', () => {
  it('renders route ID and placeholder metrics', () => {
    render(<VaultDetailPage />)
    expect(screen.getByRole('heading', { name: 'Vault vault-1' })).toBeInTheDocument()
    expect(screen.getByText('TVL')).toBeInTheDocument()
    expect(screen.getByText('$0.00')).toBeInTheDocument()
    expect(screen.getByText('0.00%')).toBeInTheDocument()
  })
})

describe('VaultOverview', () => {
  it('renders metadata, fees, assets, and description', () => {
    render(<VaultOverview vault={makeVault()} />)
    expect(screen.getByRole('heading', { name: 'Alpha Vault' })).toBeInTheDocument()
    expect(screen.getByText('15.00% (1500 BPS)')).toBeInTheDocument()
    expect(screen.getByText('2.00% (200 BPS)')).toBeInTheDocument()
    expect(screen.getByText('SOL')).toBeInTheDocument()
    expect(screen.getByText('A diversified Solana strategy.')).toBeInTheDocument()
  })

  it('renders empty assets state and edit link', () => {
    render(<VaultOverview vault={makeVault({ metadata: { displayName: '', description: '', focusAssets: [] } })} />)
    expect(screen.getByText('No focus assets configured.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/vaults/vault-1/edit')
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

  it('shows loading rows before history resolves', () => {
    mocks.getHistory.mockReturnValue(new Promise(() => {}))
    const { container } = render(<VaultTradesTab vaultId="vault-1" />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(3)
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
