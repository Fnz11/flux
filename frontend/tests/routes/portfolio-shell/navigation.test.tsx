import React from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Sidebar } from '@/components/Sidebar'
import { MobileNav } from '@/components/MobileNav'

const mocks = vi.hoisted(() => ({
  app: { isManager: false, currentUser: null as string | null },
  setMode: vi.fn(),
  setCurrentUser: vi.fn(),
  navigate: vi.fn(),
  pathname: '/',
  wallet: { publicKey: null as null | { toBase58: () => string }, connected: false, disconnect: vi.fn() },
  portfolioReset: vi.fn(),
  vaultReset: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to?: string; [key: string]: unknown }) => (
    <a href={to} {...props}>{children}</a>
  ),
  useNavigate: () => mocks.navigate,
  useLocation: () => ({ pathname: mocks.pathname }),
}))
vi.mock('@solana/wallet-adapter-react', () => ({ useWallet: () => mocks.wallet }))
vi.mock('@/stores/app-store', () => ({
  useAppStore: <T,>(selector: (state: typeof mocks.app & { setMode: typeof mocks.setMode; setCurrentUser: typeof mocks.setCurrentUser }) => T) =>
    selector({ ...mocks.app, setMode: mocks.setMode, setCurrentUser: mocks.setCurrentUser }),
}))
vi.mock('@/stores', () => ({
  usePortfolioStore: { getState: () => ({ reset: mocks.portfolioReset }) },
  useVaultStore: { getState: () => ({ reset: mocks.vaultReset }) },
}))
vi.mock('@/lib/toast', () => ({ toastInfo: mocks.toastInfo, toastSuccess: mocks.toastSuccess }))
vi.mock('@/components/ui/WalletConnectButton', () => ({ WalletConnectButton: () => <button>Connect Wallet</button> }))
vi.mock('framer-motion', () => ({
  LazyMotion: ({ children }: { children: React.ReactNode }) => children,
  domAnimation: {},
  AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
  m: new Proxy({}, {
    get: (_target, tag) =>
      ({ children, whileTap: _whileTap, layout: _layout, layoutId: _layoutId, transition: _transition, initial: _initial, animate: _animate, exit: _exit, ...props }: { children?: React.ReactNode; [key: string]: unknown }) =>
        React.createElement(tag as string, props, children),
  }),
}))

describe('sidebar navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.app = { isManager: false, currentUser: null }
    mocks.pathname = '/'
  })

  it('shows investor links and wallet control', () => {
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /Invest/ })).toHaveAttribute('href', '/invest')
    expect(screen.getByRole('link', { name: /Portfolio/ })).toHaveAttribute('href', '/portfolio')
    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /Trade/ })).not.toBeInTheDocument()
  })

  it('shows manager links and mode controls for a signed-in user', () => {
    mocks.app = { isManager: true, currentUser: 'Wallet111' }
    render(<Sidebar />)
    expect(screen.getByRole('link', { name: /Trade/ })).toHaveAttribute('href', '/trade')
    expect(screen.getByRole('link', { name: /Payout/ })).toHaveAttribute('href', '/payout')
    expect(screen.getByRole('button', { name: 'Manager' })).toBeInTheDocument()
  })

  it('redirects from trade when switching to investor mode', () => {
    mocks.app = { isManager: true, currentUser: 'Wallet111' }
    mocks.pathname = '/trade/advanced'
    render(<Sidebar />)
    fireEvent.click(screen.getByRole('button', { name: 'Invest' }))
    expect(mocks.setMode).toHaveBeenCalledWith(false)
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/invest' })
  })

  it('collapses labels and restores them', () => {
    const { container } = render(<Sidebar />)
    const toggleButtons = container.querySelectorAll('button')
    // Click the collapse button (ChevronLeft)
    fireEvent.click(toggleButtons[0])
    expect(screen.queryByText('Main Menu')).not.toBeInTheDocument()
    expect(screen.getByTitle('Invest')).toBeInTheDocument()
    // Click the expand button (ChevronRight)
    const expandButtons = container.querySelectorAll('button')
    fireEvent.click(expandButtons[0])
    expect(screen.getByText('Main Menu')).toBeInTheDocument()
  })
})

describe('mobile navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.app = { isManager: false, currentUser: null }
    mocks.pathname = '/'
    mocks.wallet = { publicKey: null, connected: false, disconnect: vi.fn() }
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: vi.fn().mockResolvedValue(undefined) } })
  })

  it('routes investor and manager primary actions', () => {
    const { rerender } = render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /Invest/ }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/invest' })
    mocks.app = { isManager: true, currentUser: null }
    rerender(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /Vaults/ }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/vaults' })
  })

  it('opens investor menu and switches manager mode', () => {
    mocks.app = { isManager: false, currentUser: 'Wallet111' }
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /Menu/ }))
    expect(screen.getByText('Navigation Menu')).toBeInTheDocument()
    expect(screen.getByText('Investor')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Manager Mode' }))
    expect(mocks.setMode).toHaveBeenCalledWith(true)
  })

  it('shows disconnected account wallet prompt', () => {
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /Account/ }))
    expect(screen.getByText('Connect Solana Wallet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Connect Wallet' })).toBeInTheDocument()
  })

  it('copies and disconnects a connected wallet', async () => {
    mocks.app = { isManager: false, currentUser: 'CurrentUser' }
    mocks.wallet = { publicKey: { toBase58: () => '1234567890ABCDEFGHIJ' }, connected: true, disconnect: vi.fn().mockResolvedValue(undefined) }
    render(<MobileNav />)
    fireEvent.click(screen.getByRole('button', { name: /Account/ }))
    expect(screen.getByText('123456...EFGHIJ')).toBeInTheDocument()
    fireEvent.click(screen.getByTitle('Copy address'))
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('1234567890ABCDEFGHIJ'))
    expect(mocks.toastSuccess).toHaveBeenCalledWith('Wallet address copied!')
    fireEvent.click(screen.getByRole('button', { name: /Disconnect Wallet/ }))
    await waitFor(() => expect(mocks.wallet.disconnect).toHaveBeenCalled())
    expect(mocks.portfolioReset).toHaveBeenCalled()
    expect(mocks.vaultReset).toHaveBeenCalled()
    expect(mocks.setCurrentUser).toHaveBeenCalledWith(null)
  })
})
