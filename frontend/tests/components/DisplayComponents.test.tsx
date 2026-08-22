import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AddressPill } from '@/components/ui/AddressPill'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TokenAmount } from '@/components/ui/TokenAmount'
import { EmptyState } from '@/components/ui/EmptyState'
import { EmptyVaultsTable } from '@/components/ui/EmptyVaultsTable'
import { WalletPrompt } from '@/components/ui/WalletPrompt'

const configMock = vi.hoisted(() => ({ config: null as { dustThreshold: number } | null }))
vi.mock('@/stores/config-store', () => ({
  useConfigStore: (selector: (state: typeof configMock) => unknown) => selector(configMock),
}))
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ content, children }: { content: React.ReactNode; children: React.ReactNode }) => <div>{children}<span>{content}</span></div>,
}))
vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    connected: false,
    publicKey: null,
    wallets: [],
    select: vi.fn(),
    disconnect: vi.fn(),
  }),
}))

describe('AddressPill', () => {
  beforeEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('truncates using the requested length while exposing the full address', () => {
    render(<AddressPill address="ABCDEFGH12345678" length={3} />)
    expect(screen.getByText('ABC...678')).toBeInTheDocument()
    expect(screen.getByText('ABCDEFGH12345678')).toBeInTheDocument()
  })

  it('copies the full address when enabled', async () => {
    render(<AddressPill address="ABCDEFGH12345678" showCopy />)
    fireEvent.click(screen.getByRole('button', { name: /copy address/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABCDEFGH12345678'))
  })

  it('renders explorer link to open in new tab', () => {
    render(<AddressPill address="ABCDEFGH12345678" showExplorer />)
    const link = screen.getByRole('link', { name: /open in solana explorer/i })
    expect(link).toHaveAttribute('href', expect.stringContaining('solscan.io/account/ABCDEFGH12345678'))
    expect(link).toHaveAttribute('target', '_blank')
  })
})

describe('StatusBadge', () => {
  it('normalizes lowercase status labels', () => {
    render(<StatusBadge status="success" />)
    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('uses a custom label and status styling', () => {
    render(<StatusBadge status="Failed" label="Rejected" />)
    expect(screen.getByText('Rejected')).toHaveClass('text-status-error')
  })
})

describe('TokenAmount', () => {
  beforeEach(() => { configMock.config = null })

  it('formats amount, symbol, and USD value', () => {
    render(<TokenAmount amount={1234.5} symbol="SOL" showUsd usdValue={2500} decimals={2} />)
    expect(screen.getByText(/1,234.50/)).toHaveTextContent('SOL')
    expect(screen.getByText('($2,500.00)')).toBeInTheDocument()
  })

  it('uses compact notation for large values', () => {
    render(<TokenAmount amount={1_250_000} compact />)
    expect(screen.getByText('1.25M')).toBeInTheDocument()
  })

  it('renders invalid numeric input as unavailable', () => {
    render(<TokenAmount amount="not-a-number" />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('honors configured dust threshold', () => {
    configMock.config = { dustThreshold: 0.1 }
    render(<TokenAmount amount={0.05} symbol="SOL" showIcon />)
    expect(screen.getByText(/Dust/)).toBeInTheDocument()
    expect(screen.getByText('SOL')).toBeInTheDocument()
  })
})

describe('empty states', () => {
  it('renders custom empty-state content and sizing', () => {
    render(<EmptyState title="Nothing here" description="Create the first item" icon={<span>Custom icon</span>} size="xs" />)
    expect(screen.getByText('Nothing here')).toBeInTheDocument()
    expect(screen.getByText('Create the first item')).toBeInTheDocument()
    expect(screen.getByText('Custom icon')).toBeInTheDocument()
  })

  it('renders vault table headers and empty message', () => {
    render(<EmptyVaultsTable headers={['Name', 'TVL']} title="No matching vaults" />)
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'TVL' })).toBeInTheDocument()
    expect(screen.getByText('No matching vaults')).toBeInTheDocument()
  })
})

describe('WalletPrompt', () => {
  it('renders title, description, and connect button', () => {
    render(<WalletPrompt title="Connect Your Wallet" description="Please connect wallet to continue." />)
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument()
    expect(screen.getByText('Please connect wallet to continue.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Connect Wallet/i })).toBeInTheDocument()
  })
})
