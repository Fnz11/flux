import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makePosition, makeVault } from './vaults/fixtures'

const mocks = vi.hoisted(() => ({
  isManager: false,
  walletAddress: 'wallet123',
  positions: [] as ReturnType<typeof makePosition>[],
  vaults: [] as ReturnType<typeof makeVault>[],
  isLoading: false,
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (config: any) => ({
    ...config,
    options: config,
  }),
  useNavigate: () => vi.fn(),
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => ({
    publicKey: mocks.walletAddress ? { toBase58: () => mocks.walletAddress } : null,
  }),
}))

vi.mock('../../src/stores', () => {
  const storeFn: any = (selector: (state: any) => unknown) => selector({ isManager: mocks.isManager, positions: mocks.positions })
  storeFn.setState = vi.fn()
  storeFn.getState = () => ({ reset: vi.fn(), positions: mocks.positions })

  const vaultStore: any = (selector: (state: any) => unknown) => selector({})
  vaultStore.getState = () => ({ reset: vi.fn() })

  return {
    useAppStore: storeFn,
    usePortfolioStore: storeFn,
    useVaultStore: vaultStore,
  }
})

vi.mock('../../src/services/hooks', () => ({
  useVaultsQuery: () => ({ data: mocks.vaults, isLoading: mocks.isLoading }),
  usePortfolioQuery: () => ({ data: mocks.positions, isLoading: mocks.isLoading }),
}))

vi.mock('../../src/hooks/useRouteWsChannel', () => ({
  useRouteWsChannel: vi.fn(),
}))

vi.mock('../../src/hooks/useRealtimeSync', () => ({
  useRealtimeSync: vi.fn(),
}))

vi.mock('../../src/routes/_components/ManagerVaultsList', () => ({
  ManagerVaultsList: () => <div data-testid="manager-vaults-list" />,
}))

vi.mock('../../src/routes/_components/InvestorVaultsList', () => ({
  InvestorVaultsList: () => <div data-testid="investor-vaults-list" />,
}))

vi.mock('../../src/routes/portfolio/_components/PortfolioSummary', () => ({
  PortfolioSummary: () => <div data-testid="portfolio-summary" />,
}))

import { Route } from '../../src/routes/index'

describe('Dashboard Route', () => {
  beforeEach(() => {
    mocks.isManager = false
    mocks.walletAddress = 'wallet123'
    mocks.positions = [makePosition(), makePosition({ vaultId: 'v2' })]
    mocks.vaults = [
      makeVault({ id: 'v1', managerAddress: 'wallet123', status: 'Active' }),
      makeVault({ id: 'v2', managerAddress: 'other', status: 'Active' }),
    ]
    mocks.isLoading = false
  })

  it('renders Invested Vaults label and count for investor mode', () => {
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('Invested Vaults')).toBeInTheDocument()
    expect(screen.getByText('Vaults with active positions')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('renders Your Vaults label and count for manager mode', () => {
    mocks.isManager = true
    const Component = (Route as any).options.component
    render(<Component />)

    expect(screen.getByText('Your Vaults')).toBeInTheDocument()
    expect(screen.getByText('Vaults under your authority')).toBeInTheDocument()
    expect(screen.getByText('1')).toBeInTheDocument()
  })
})
