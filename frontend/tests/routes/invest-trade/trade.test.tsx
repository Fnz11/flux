import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { Vault } from '@/types'
import { SwapForm } from '@/routes/trade/_components/SwapForm'
import { ConfirmationDialog } from '@/routes/trade/_components/ConfirmationDialog'
import { PriceDisplay } from '@/routes/trade/_components/PriceDisplay'
import { TokenSelector } from '@/routes/trade/_components/TokenSelector'
import { VaultAssetsPanel } from '@/routes/trade/_components/VaultAssetsPanel'

const mocks = vi.hoisted(() => ({
  execute: vi.fn(),
  vaults: [] as Vault[],
  vaultsLoading: false,
  balances: [] as Array<{ symbol: string; mint: string; amount: number; usdValue: number }>,
  balancesLoading: false,
  connected: true,
  getBalance: vi.fn().mockResolvedValue(2_500_000_000),
  price: { price: 100, confidence: 0.1, status: 'live' as const, lastUpdated: new Date('2026-08-08') },
  config: { focusAssetsWhitelist: ['SOL', 'USDC', 'USDT'] },
}))

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? <section aria-label={title}><h1>{title}</h1>{children}</section> : null,
}))
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ connected: mocks.connected, publicKey: mocks.connected ? {} : null }),
  useConnection: () => ({ connection: { getBalance: mocks.getBalance } }),
}))
vi.mock('@/services/hooks/useQuery/useVaultsQuery', () => ({
  useVaultsQuery: () => ({ data: mocks.vaults, isLoading: mocks.vaultsLoading }),
  useVaultBalancesQuery: () => ({ data: mocks.balances, isLoading: mocks.balancesLoading }),
}))
vi.mock('@/hooks/usePythPrice', () => ({ usePythPrice: () => mocks.price }))
vi.mock('@/hooks/useExecuteTrade', () => ({ useExecuteTrade: () => ({ execute: mocks.execute, isLoading: false }) }))
vi.mock('@/stores', () => ({ useConfigStore: (selector: any) => selector({ config: mocks.config }) }))
vi.mock('@/components/ui/ResponsiveDrawer', async () => {
  const React = await import('react')
  return {
    useIsMobile: () => false,
    ResponsiveDrawer: ({ open, title, children }: { open: boolean; title?: string; children: ReactNode }) =>
      open ? React.createElement('section', { 'aria-label': title }, children) : null,
  }
})

const vault: Vault = {
  id: 'vault-1',
  address: 'VaultAddress123456789',
  managerAddress: 'manager-address',
  managerId: 'manager-1',
  status: 'Active',
  metadata: { displayName: 'Alpha Vault', description: 'Core vault', focusAssets: ['SOL', 'USDC'] },
  performanceFeeBps: 1250,
  managementFeeBps: 200,
  tvl: 500_000,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.vaults = [vault]
  mocks.vaultsLoading = false
  mocks.balances = []
  mocks.balancesLoading = false
  mocks.connected = true
  mocks.getBalance.mockResolvedValue(2_500_000_000)
  mocks.price = { price: 100, confidence: 0.1, status: 'live', lastUpdated: new Date('2026-08-08') }
  mocks.config = { focusAssetsWhitelist: ['SOL', 'USDC', 'USDT'] }
})

describe('SwapForm', () => {
  it('renders buy direction and calculated output', () => {
    render(<SwapForm preselectedVaultId={vault.id} />)
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '2' } })
    expect(screen.getByText('200.000000')).toBeInTheDocument()
    expect(screen.getByText('SOL / USDC')).toBeInTheDocument()
  })

  it('toggles to sell direction', () => {
    render(<SwapForm preselectedVaultId={vault.id} />)
    fireEvent.click(screen.getByRole('button', { name: 'Swap direction' }))
    expect(screen.getByText('USDC / SOL')).toBeInTheDocument()
  })

  it('changes input and output tokens', () => {
    render(<SwapForm preselectedVaultId={vault.id} />)
    const selectors = screen.getAllByRole('button', { name: /SOL|USDC/ })
    fireEvent.click(selectors[0])
    fireEvent.click(screen.getByRole('button', { name: /USDT/ }))
    expect(screen.getByText('USDT / USDC')).toBeInTheDocument()
  })

  it('updates slippage and minimum output', () => {
    render(<SwapForm preselectedVaultId={vault.id} />)
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: '2%' }))
    expect(screen.getByText('196.0000 USDC')).toBeInTheDocument()
  })

  it('validates an empty amount without opening confirmation', async () => {
    const { container } = render(<SwapForm preselectedVaultId={vault.id} />)
    fireEvent.submit(container.querySelector('form')!)
    expect(await screen.findByText('Amount is required')).toBeInTheDocument()
    expect(screen.queryByText('Confirm Trade')).not.toBeInTheDocument()
  })

  it('uses wallet balance for max amount', async () => {
    render(<SwapForm preselectedVaultId={vault.id} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Max (2.50)' })).toBeInTheDocument())
    fireEvent.click(screen.getByRole('button', { name: 'Max (2.50)' }))
    expect(screen.getByPlaceholderText('0.00')).toHaveValue(2.5)
  })

  it('calls trade hook with confirmed swap details', async () => {
    mocks.execute.mockResolvedValue('trade-signature')
    render(<SwapForm preselectedVaultId={vault.id} />)
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Execute Swap' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm Swap' }))
    await waitFor(() => expect(mocks.execute).toHaveBeenCalledWith({
      vaultId: vault.id,
      inputToken: 'SOL',
      outputToken: 'USDC',
      amountIn: 2,
      amountOut: 200,
      priceAtExecution: 100,
      slippage: 0.5,
    }))
  })
})

describe('ConfirmationDialog', () => {
  const props = {
    open: true,
    onConfirm: vi.fn(),
    onClose: vi.fn(),
    inputToken: 'SOL',
    outputToken: 'USDC',
    inputAmount: 2,
    outputAmount: 200,
    rate: 100,
    slippage: 0.5,
    minReceived: 199,
    networkFee: 0.000005,
    isLoading: false,
  }

  it('renders complete trade details', () => {
    render(<ConfirmationDialog {...props} />)
    expect(screen.getByText('2.000000 SOL')).toBeInTheDocument()
    expect(screen.getByText('200.000000 USDC')).toBeInTheDocument()
    expect(screen.getByText('199.000000 USDC')).toBeInTheDocument()
    expect(screen.getByText('0.000005 SOL')).toBeInTheDocument()
  })

  it('dispatches cancel and confirm actions', () => {
    render(<ConfirmationDialog {...props} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Swap' }))
    expect(props.onClose).toHaveBeenCalledOnce()
    expect(props.onConfirm).toHaveBeenCalledOnce()
  })

  it('locks actions while confirming', () => {
    render(<ConfirmationDialog {...props} isLoading />)
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Confirming...' })).toBeDisabled()
  })
})

describe('PriceDisplay', () => {
  it('renders loading state', () => {
    const { container } = render(<PriceDisplay data={{ price: 0, confidence: 0, status: 'loading', lastUpdated: null }} />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders live price and confidence', () => {
    render(<PriceDisplay data={{ price: 123.456, confidence: 0.002, status: 'live', lastUpdated: new Date() }} />)
    expect(screen.getByText('$123.456000')).toBeInTheDocument()
    expect(screen.getByText('Conf: ±0.002000')).toBeInTheDocument()
    expect(screen.getByText('Live')).toBeInTheDocument()
  })

  it('renders stale status', () => {
    render(<PriceDisplay data={{ price: 90, confidence: 0.1, status: 'stale', lastUpdated: new Date() }} />)
    expect(screen.getByText('Stale')).toBeInTheDocument()
    expect(screen.getByText('$90.000000')).toBeInTheDocument()
  })

  it.each(['error', 'offline'] as const)('renders unavailable for %s status', (status) => {
    render(<PriceDisplay data={{ price: 0, confidence: 0, status, lastUpdated: null }} />)
    expect(screen.getByText('Price unavailable')).toBeInTheDocument()
  })
})

describe('TokenSelector', () => {
  it('opens with supported tokens and excludes BONK', () => {
    render(<TokenSelector tokens={['SOL', 'USDC', 'BONK']} selected="SOL" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /SOL/ }))
    expect(screen.getByText('USD Coin')).toBeInTheDocument()
    expect(screen.queryByText('BONK')).not.toBeInTheDocument()
  })

  it('filters tokens by name', () => {
    render(<TokenSelector tokens={['SOL', 'USDC', 'USDT']} selected="SOL" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /SOL/ }))
    fireEvent.change(screen.getByPlaceholderText('Search tokens...'), { target: { value: 'usd coin' } })
    expect(screen.getByText('USD Coin')).toBeInTheDocument()
    expect(screen.queryByText('Tether')).not.toBeInTheDocument()
  })

  it('shows an empty search state', () => {
    render(<TokenSelector tokens={['SOL']} selected="SOL" onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /SOL/ }))
    fireEvent.change(screen.getByPlaceholderText('Search tokens...'), { target: { value: 'missing' } })
    expect(screen.getByText('No tokens found')).toBeInTheDocument()
  })

  it('selects a token and closes', () => {
    const onSelect = vi.fn()
    render(<TokenSelector tokens={['SOL', 'USDC']} selected="SOL" onSelect={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /SOL/ }))
    fireEvent.click(screen.getByRole('button', { name: /USDC/ }))
    expect(onSelect).toHaveBeenCalledWith('USDC')
    expect(screen.queryByPlaceholderText('Search tokens...')).not.toBeInTheDocument()
  })
})

describe('VaultAssetsPanel', () => {
  it('renders loading assets', () => {
    mocks.balancesLoading = true
    const { container } = render(<VaultAssetsPanel vaultId={vault.id} />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })

  it('prompts for a vault when none is selected', () => {
    render(<VaultAssetsPanel />)
    expect(screen.getByText('Select a Vault Above')).toBeInTheDocument()
  })

  it('renders empty balances', () => {
    render(<VaultAssetsPanel vaultId={vault.id} />)
    expect(screen.getByText('No balances recorded')).toBeInTheDocument()
  })

  it('renders populated balances, totals, and allocation', () => {
    mocks.balances = [
      { symbol: 'SOL', mint: 'sol', amount: 2, usdValue: 300 },
      { symbol: 'USDC', mint: 'usdc', amount: 100, usdValue: 100 },
    ]
    render(<VaultAssetsPanel vaultId={vault.id} vaultName="Alpha Vault" />)
    expect(screen.getByText('Alpha Vault')).toBeInTheDocument()
    expect(screen.getByText('$400')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
    const solCard = screen.getByAltText('SOL').closest('div.relative')!
    expect(within(solCard).getByText('$300.00')).toBeInTheDocument()
  })
})
