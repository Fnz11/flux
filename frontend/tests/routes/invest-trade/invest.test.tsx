import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import type { PortfolioPosition, Vault } from '@/types'
import { DepositModal } from '@/routes/invest/_components/DepositModal'
import { WithdrawModal } from '@/routes/invest/_components/WithdrawModal'
import { InvestSummary } from '@/routes/invest/_components/InvestSummary'
import { VaultStats, VaultStatsSkeleton } from '@/routes/invest/_components/VaultStats'
import { VaultInvestCard, VaultInvestCardSkeleton } from '@/routes/invest/_components/VaultInvestCard'
import { RecentActivity } from '@/routes/invest/_components/RecentActivity'

const mocks = vi.hoisted(() => ({
  deposit: vi.fn(),
  withdraw: vi.fn(),
  vaults: [] as Vault[],
  vaultsLoading: false,
  positions: [] as PortfolioPosition[],
  portfolioLoading: false,
  pnl: { totalInvested: 0, totalValue: 0, totalPnl: 0, totalPnlPercent: 0 },
  history: [] as Array<{ date: string; value: number }>,
  activity: { data: undefined as unknown, isLoading: false, error: null as Error | null },
  invalidateQueries: vi.fn(),
  subscribe: vi.fn(() => vi.fn()),
}))

vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, title, children }: { open: boolean; title: string; children: ReactNode }) =>
    open ? <section aria-label={title}><h1>{title}</h1>{children}</section> : null,
}))
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <>{children}</>,
}))
vi.mock('@/components/ui/SolscanLink', () => ({
  SolscanLink: ({ signature }: { signature: string }) => <a href={`https://solscan.io/tx/${signature}`}>{signature}</a>,
}))
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, params, ...props }: { children: ReactNode; params?: { id?: string }; [key: string]: unknown }) => (
    <a href={`/invest/vaults/${params?.id}`} {...props}>{children}</a>
  ),
}))
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({ publicKey: { toBase58: () => 'wallet-1' }, connected: true }),
}))
vi.mock('@/hooks/useDeposit', () => ({ useDeposit: () => ({ execute: mocks.deposit }) }))
vi.mock('@/hooks/useWithdraw', () => ({ useWithdraw: () => ({ execute: mocks.withdraw }) }))
vi.mock('@/services/hooks/useQuery/useVaultsQuery', () => ({
  useVaultsQuery: () => ({ data: mocks.vaults, isLoading: mocks.vaultsLoading }),
}))
vi.mock('@/services/hooks', () => ({
  useVaultsQuery: () => ({ data: mocks.vaults, isLoading: mocks.vaultsLoading }),
  usePortfolioQuery: () => ({ data: mocks.positions, isLoading: mocks.portfolioLoading }),
}))
vi.mock('@/hooks/usePortfolioPnl', () => ({ usePortfolioPnl: () => mocks.pnl }))
vi.mock('@/services/hooks/useQuery/usePortfolioHistoryQuery', () => ({
  usePortfolioHistoryQuery: () => ({ data: mocks.history }),
}))
vi.mock('@/services/hooks/useQuery/useGlobalTransactionsQuery', () => ({
  useGlobalTransactionsQuery: () => mocks.activity,
}))
vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: mocks.invalidateQueries }),
}))
vi.mock('@/stores', () => ({
  useWebSocketStore: <T,>(selector: (state: { onMessage: typeof mocks.subscribe }) => T) =>
    selector({ onMessage: mocks.subscribe }),
}))

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

const position: PortfolioPosition = {
  vaultId: vault.id,
  vaultAddress: vault.address,
  vaultName: 'Alpha Vault',
  sharesOwned: 10,
  totalInvested: 800,
  averageEntryPrice: 80,
  currentValue: 1_000,
  pnl: 200,
  pnlPercent: 25,
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.vaults = [vault]
  mocks.vaultsLoading = false
  mocks.positions = [position]
  mocks.portfolioLoading = false
  mocks.pnl = { totalInvested: 0, totalValue: 0, totalPnl: 0, totalPnlPercent: 0 }
  mocks.history = []
  mocks.activity = { data: undefined, isLoading: false, error: null }
})

async function enterDeposit(amount: string) {
  fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: amount } })
  fireEvent.click(screen.getByRole('button', { name: 'Next' }))
}

describe('DepositModal', () => {
  it('rejects an empty amount', async () => {
    render(<DepositModal vaultId={vault.id} open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(await screen.findByText('Amount is required')).toBeInTheDocument()
  })

  it.each(['0', '-2'])('rejects invalid amount %s', async (amount) => {
    render(<DepositModal vaultId={vault.id} open onClose={vi.fn()} />)
    await enterDeposit(amount)
    expect(await screen.findByText('Amount must be greater than 0')).toBeInTheDocument()
  })

  it('selects a deposit token', () => {
    render(<DepositModal vaultId={vault.id} open onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'USDC' }))
    expect(screen.getByRole('button', { name: 'USDC' })).toHaveClass('bg-primary-coral')
  })

  it('shows the estimated share summary', async () => {
    render(<DepositModal vaultId={vault.id} open onClose={vi.fn()} />)
    await enterDeposit('2')
    expect(await screen.findByText('Confirm Deposit')).toBeInTheDocument()
    expect(screen.getByText('3.000000')).toBeInTheDocument()
    expect(screen.getByText(/share tokens for 2 SOL/)).toBeInTheDocument()
  })

  it('disables confirmation while loading', async () => {
    mocks.deposit.mockReturnValue(new Promise(() => {}))
    render(<DepositModal vaultId={vault.id} open onClose={vi.fn()} />)
    await enterDeposit('2')
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm & Sign' }))
    expect(await screen.findByRole('button', { name: 'Confirming...' })).toBeDisabled()
  })

  it('shows the successful transaction signature', async () => {
    mocks.deposit.mockResolvedValue('deposit-signature')
    render(<DepositModal vaultId={vault.id} open onClose={vi.fn()} />)
    await enterDeposit('2')
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm & Sign' }))
    expect(await screen.findByText('deposit-signature')).toHaveAttribute('href', expect.stringContaining('deposit-signature'))
    expect(mocks.deposit).toHaveBeenCalledWith(expect.objectContaining({ amount: 2, vaultId: vault.id }))
  })

  it('stays on confirmation when deposit fails', async () => {
    mocks.deposit.mockRejectedValue(new Error('wallet rejected'))
    render(<DepositModal vaultId={vault.id} open onClose={vi.fn()} />)
    await enterDeposit('2')
    fireEvent.click(await screen.findByRole('button', { name: 'Confirm & Sign' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm & Sign' })).toBeEnabled())
    expect(screen.queryByText('Deposit Complete')).not.toBeInTheDocument()
  })
})

describe('WithdrawModal', () => {
  it('shows no-position state when no shares exist', () => {
    mocks.positions = []
    render(<WithdrawModal vaultId={vault.id} open onClose={vi.fn()} />)
    expect(screen.getByText('No position found for this vault.')).toBeInTheDocument()
  })

  it('rejects zero shares', async () => {
    render(<WithdrawModal vaultId={vault.id} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(await screen.findByText('Amount must be greater than 0')).toBeInTheDocument()
  })

  it('rejects shares exceeding the position', async () => {
    render(<WithdrawModal vaultId={vault.id} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '11' } })
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(await screen.findByText('Amount cannot exceed 10.000000 shares')).toBeInTheDocument()
    expect(mocks.withdraw).not.toHaveBeenCalled()
  })

  it('shows summary and successful signature', async () => {
    mocks.withdraw.mockResolvedValue('withdraw-signature')
    render(<WithdrawModal vaultId={vault.id} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '5' } })
    expect(screen.getByText('50.00%')).toBeInTheDocument()
    expect(screen.getByText('$500.00')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    expect(await screen.findByText('withdraw-signature')).toBeInTheDocument()
    expect(mocks.withdraw).toHaveBeenCalledWith({ vaultAddress: vault.address, shareAmount: 5, vaultId: vault.id })
  })

  it('recovers from withdrawal failure', async () => {
    mocks.withdraw.mockRejectedValue(new Error('failed'))
    render(<WithdrawModal vaultId={vault.id} open onClose={vi.fn()} />)
    fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Withdraw' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Withdraw' })).toBeEnabled())
    expect(screen.queryByText(/signature/)).not.toBeInTheDocument()
  })
})

describe('invest summaries and cards', () => {
  it('renders an empty portfolio summary', () => {
    render(<InvestSummary />)
    expect(screen.getAllByText('$0').length).toBeGreaterThan(0)
    expect(screen.getByText('+0.00%')).toBeInTheDocument()
  })

  it('renders populated portfolio values and negative PnL', () => {
    mocks.pnl = { totalInvested: 1_200, totalValue: 1_050, totalPnl: -150, totalPnlPercent: -12.5 }
    mocks.history = [{ date: '2026-01-01', value: 1200 }, { date: '2026-01-02', value: 1050 }]
    const { container } = render(<InvestSummary />)
    expect(screen.getByText('$1,200')).toBeInTheDocument()
    expect(screen.getByText(/12\.50%/)).toBeInTheDocument()
    expect(container.querySelector('polyline')).toBeInTheDocument()
  })

  it('renders vault stats', () => {
    render(<VaultStats vault={vault} />)
    expect(screen.getByText('$500,000')).toBeInTheDocument()
    expect(screen.getByText('12.5%')).toBeInTheDocument()
    expect(screen.getByText('None')).toBeInTheDocument()
  })

  it('renders vault stats loading skeletons', () => {
    const { container } = render(<VaultStatsSkeleton />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(4)
  })

  it('renders a populated vault card with routes', () => {
    render(<VaultInvestCard vault={vault} />)
    expect(screen.getByText('Alpha Vault')).toBeInTheDocument()
    expect(screen.getByText('Active')).toBeInTheDocument()
    expect(screen.getAllByRole('link')).toHaveLength(2)
    expect(screen.getByRole('link', { name: 'Deposit' })).toHaveAttribute('href', `/invest/vaults/${vault.id}`)
  })

  it('renders vault card loading skeleton', () => {
    const { container } = render(<VaultInvestCardSkeleton />)
    expect(container.firstChild).toHaveClass('animate-pulse')
  })
})

describe('RecentActivity', () => {
  it('renders loading rows', () => {
    mocks.activity = { data: undefined, isLoading: true, error: null }
    const { container } = render(<RecentActivity wallet="wallet-1" />)
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(5)
  })

  it('renders empty activity', () => {
    mocks.activity = { data: { items: [] }, isLoading: false, error: null }
    render(<RecentActivity wallet="wallet-1" />)
    expect(screen.getByText('No recent activity recorded')).toBeInTheDocument()
  })

  it('renders populated activity', () => {
    mocks.activity = {
      data: { items: [{ id: 'tx-1', action: 'deposit', vaultName: 'Alpha Vault', amount: 2500, symbol: 'USDC', transactionSignature: 'tx-signature', executedAt: '2026-08-08T12:00:00Z' }] },
      isLoading: false,
      error: null,
    }
    render(<RecentActivity wallet="wallet-1" />)
    const row = screen.getByText('Alpha Vault').closest('tr')!
    expect(within(row).getByText('Deposit')).toBeInTheDocument()
    expect(within(row).getByText('$2,500 USDC')).toBeInTheDocument()
    expect(within(row).getByText('tx-signature')).toBeInTheDocument()
  })
})
