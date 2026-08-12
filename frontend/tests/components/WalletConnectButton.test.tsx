import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { WalletConnectButton } from '@/components/ui/WalletConnectButton'

const mocks = vi.hoisted(() => ({
  wallet: {
    wallets: [] as Array<{ adapter: { name: string; icon?: string }; readyState: string }>,
    select: vi.fn(),
    disconnect: vi.fn(),
    connected: false,
    publicKey: null as { toBase58: () => string } | null,
  },
  setCurrentUser: vi.fn(),
  portfolioReset: vi.fn(),
  vaultReset: vi.fn(),
}))

vi.mock('@solana/wallet-adapter-react', () => ({ useWallet: () => mocks.wallet }))
vi.mock('@/stores/app-store', () => ({
  useAppStore: (selector: (state: { setCurrentUser: typeof mocks.setCurrentUser }) => unknown) =>
    selector({ setCurrentUser: mocks.setCurrentUser }),
}))
vi.mock('@/stores', () => ({
  usePortfolioStore: { getState: () => ({ reset: mocks.portfolioReset }) },
  useVaultStore: { getState: () => ({ reset: mocks.vaultReset }) },
}))
vi.mock('@/components/ui/modal', () => ({
  Modal: ({ open, title, children }: { open: boolean; title: string; children: React.ReactNode }) =>
    open ? <section aria-label={title}>{children}</section> : null,
}))

describe('WalletConnectButton', () => {
  beforeEach(() => {
    mocks.wallet.wallets = []
    mocks.wallet.connected = false
    mocks.wallet.publicKey = null
    mocks.wallet.select.mockReset()
    mocks.wallet.disconnect.mockReset()
    mocks.setCurrentUser.mockReset()
    mocks.portfolioReset.mockReset()
    mocks.vaultReset.mockReset()
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    })
  })

  it('renders disconnected state and clears user data', async () => {
    render(<WalletConnectButton />)
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeInTheDocument()
    await waitFor(() => expect(mocks.setCurrentUser).toHaveBeenCalledWith(null))
    expect(mocks.portfolioReset).toHaveBeenCalledOnce()
    expect(mocks.vaultReset).toHaveBeenCalledOnce()
  })

  it('shows no-wallet guidance in the wallet modal', () => {
    render(<WalletConnectButton />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    expect(screen.getByText(/no wallet extension detected/i)).toBeInTheDocument()
  })

  it('lists available wallets and readiness', () => {
    mocks.wallet.wallets = [
      { adapter: { name: 'Phantom', icon: '/phantom.svg' }, readyState: 'Installed' },
      { adapter: { name: 'Solflare' }, readyState: 'Loadable' },
    ]
    render(<WalletConnectButton />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    expect(screen.getByRole('button', { name: /phantom installed/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /solflare loadable/i })).toBeInTheDocument()
    expect(screen.getByAltText('Phantom')).toHaveAttribute('src', '/phantom.svg')
  })

  it('selects a wallet and closes the modal', () => {
    mocks.wallet.wallets = [{ adapter: { name: 'Phantom' }, readyState: 'Installed' }]
    render(<WalletConnectButton />)
    fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }))
    fireEvent.click(screen.getByRole('button', { name: /phantom installed/i }))
    expect(mocks.wallet.select).toHaveBeenCalledWith('Phantom')
    expect(screen.queryByLabelText('Connect Wallet')).not.toBeInTheDocument()
  })

  it('syncs and displays a connected wallet with a truncated address', async () => {
    mocks.wallet.connected = true
    mocks.wallet.publicKey = { toBase58: () => 'ABCD1234567890WXYZ' }
    render(<WalletConnectButton />)
    expect(screen.getByText('ABCD...WXYZ')).toBeInTheDocument()
    await waitFor(() => expect(mocks.setCurrentUser).toHaveBeenCalledWith('ABCD1234567890WXYZ'))
  })

  it('opens and closes the connected account menu', () => {
    mocks.wallet.connected = true
    mocks.wallet.publicKey = { toBase58: () => 'ABCD1234567890WXYZ' }
    render(<WalletConnectButton />)
    const account = screen.getByRole('button', { name: /your account/i })
    fireEvent.click(account)
    expect(screen.getByRole('button', { name: /copy address/i })).toBeInTheDocument()
    fireEvent.click(account)
    expect(screen.queryByRole('button', { name: /copy address/i })).not.toBeInTheDocument()
  })

  it('copies the full connected address', async () => {
    mocks.wallet.connected = true
    mocks.wallet.publicKey = { toBase58: () => 'ABCD1234567890WXYZ' }
    render(<WalletConnectButton />)
    fireEvent.click(screen.getByRole('button', { name: /your account/i }))
    fireEvent.click(screen.getByRole('button', { name: /copy address/i }))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('ABCD1234567890WXYZ'))
    expect(screen.getByText('Copied!')).toBeInTheDocument()
  })

  it('disconnects and resets wallet-dependent stores', async () => {
    mocks.wallet.connected = true
    mocks.wallet.publicKey = { toBase58: () => 'ABCD1234567890WXYZ' }
    mocks.wallet.disconnect.mockResolvedValue(undefined)
    render(<WalletConnectButton />)
    mocks.setCurrentUser.mockClear()
    mocks.portfolioReset.mockClear()
    mocks.vaultReset.mockClear()
    fireEvent.click(screen.getByRole('button', { name: /your account/i }))
    fireEvent.click(screen.getByRole('button', { name: /disconnect/i }))
    await waitFor(() => expect(mocks.wallet.disconnect).toHaveBeenCalledOnce())
    expect(mocks.setCurrentUser).toHaveBeenCalledWith(null)
    expect(mocks.portfolioReset).toHaveBeenCalledOnce()
    expect(mocks.vaultReset).toHaveBeenCalledOnce()
  })
})
