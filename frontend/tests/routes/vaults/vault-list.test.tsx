import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeVault } from './fixtures'

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  search: {} as Record<string, string | undefined>,
  query: { data: [] as ReturnType<typeof makeVault>[], isLoading: false },
  queryParams: undefined as unknown,
  wallet: {
    connected: true,
    publicKey: { toBase58: () => 'ManagerAddress1111222233334444' } as { toBase58: () => string } | null,
  },
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mocks.wallet,
  useConnection: () => ({ connection: {} }),
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    fullPath: '/vaults/',
    useSearch: () => mocks.search,
  }),
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

vi.mock('@/services/hooks', () => ({
  useInfiniteVaultsQuery: (params: unknown) => {
    mocks.queryParams = params
    return {
      data: { pages: [{ vaults: mocks.query.data, total: mocks.query.data.length, page: 1, limit: 20, hasMore: false }] },
      isLoading: mocks.query.isLoading,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }
  },
  useVaultsQuery: (params: unknown) => {
    mocks.queryParams = params
    return mocks.query
  },
}))
vi.mock('@/services/hooks/useQuery/useVaultsQuery', () => ({
  useInfiniteVaultsQuery: (params: unknown) => {
    mocks.queryParams = params
    return {
      data: { pages: [{ vaults: mocks.query.data, total: mocks.query.data.length, page: 1, limit: 20, hasMore: false }] },
      isLoading: mocks.query.isLoading,
      fetchNextPage: vi.fn(),
      hasNextPage: false,
      isFetchingNextPage: false,
    }
  },
  useVaultsQuery: (params: unknown) => {
    mocks.queryParams = params
    return mocks.query
  },
}))

vi.mock('../../../src/hooks/useRouteWsChannel', () => ({ useRouteWsChannel: vi.fn() }))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Route } from '../../../src/routes/vaults/index'

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })

const VaultsListPage = (Route as unknown as { component: React.ComponentType }).component

function renderWithClient(ui: React.ReactElement) {
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>)
}

describe('vault list route', () => {
  beforeEach(() => {
    mocks.navigate.mockReset()
    mocks.search = {}
    mocks.query = { data: [], isLoading: false }
    mocks.queryParams = undefined
    mocks.wallet = {
      connected: true,
      publicKey: { toBase58: () => 'ManagerAddress1111222233334444' },
    }
  })

  it('renders wallet prompt when wallet is not connected', () => {
    mocks.wallet = { connected: false, publicKey: null }
    renderWithClient(<VaultsListPage />)
    expect(screen.getAllByText('Connect Wallet')[0]).toBeInTheDocument()
    expect(screen.getByText(/Please connect your manager wallet to view and manage your vaults/)).toBeInTheDocument()
  })

  it('renders loading state without empty copy', () => {
    mocks.query.isLoading = true
    const { container } = renderWithClient(<VaultsListPage />)
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument()
    expect(screen.queryByText('No vaults found')).not.toBeInTheDocument()
  })

  it('renders default empty state', () => {
    renderWithClient(<VaultsListPage />)
    expect(screen.getByText('No vaults found')).toBeInTheDocument()
    expect(screen.getByText(/Create your first Solana investment vault/)).toBeInTheDocument()
  })

  it('renders status-specific empty state', () => {
    mocks.search = { status: 'Dormant' }
    renderWithClient(<VaultsListPage />)
    expect(screen.getByText('No vaults found with status "Dormant"')).toBeInTheDocument()
  })

  it('renders populated vault table', () => {
    mocks.query.data = [makeVault()]
    renderWithClient(<VaultsListPage />)
    expect(screen.getByText('Alpha Vault')).toBeInTheDocument()
    expect(screen.getByText('+12.34%')).toBeInTheDocument()
  })

  it('passes search filters to query hook', () => {
    mocks.search = { status: 'Active', sortBy: 'tvl', sortOrder: 'desc' }
    renderWithClient(<VaultsListPage />)
    expect(mocks.queryParams).toMatchObject({ status: 'Active', sortBy: 'tvl', sortOrder: 'desc' })
  })

  it('changes status and preserves prior search', () => {
    mocks.search = { sortBy: 'pnl', sortOrder: 'desc' }
    renderWithClient(<VaultsListPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Active' }))
    const call = mocks.navigate.mock.calls[0][0]
    expect(call.replace).toBe(true)
    expect(call.search(mocks.search)).toEqual({ ...mocks.search, status: 'Active' })
  })

  it('toggles current sort direction through desc -> asc -> none', () => {
    mocks.search = { sortBy: 'pnl', sortOrder: 'desc' }
    mocks.query.data = [makeVault()]
    renderWithClient(<VaultsListPage />)
    fireEvent.click(screen.getByRole('columnheader', { name: /PNL/ }))
    const call1 = mocks.navigate.mock.calls[0][0]
    expect(call1.search(mocks.search)).toMatchObject({ sortBy: 'pnl', sortOrder: 'asc' })
  })

  it('resets sort to undefined when clicking header a 3rd time (from asc to none)', () => {
    mocks.search = { sortBy: 'pnl', sortOrder: 'asc' }
    mocks.query.data = [makeVault()]
    renderWithClient(<VaultsListPage />)
    fireEvent.click(screen.getByRole('columnheader', { name: /PNL/ }))
    const call = mocks.navigate.mock.calls[0][0]
    expect(call.search(mocks.search)).toEqual({ sortBy: undefined, sortOrder: undefined })
  })

  it('initiates sorting as desc on first click', () => {
    mocks.search = {}
    mocks.query.data = [makeVault()]
    renderWithClient(<VaultsListPage />)
    fireEvent.click(screen.getByRole('columnheader', { name: /PNL/ }))
    const call = mocks.navigate.mock.calls[0][0]
    expect(call.search(mocks.search)).toMatchObject({ sortBy: 'pnl', sortOrder: 'desc' })
  })

  it('links to vault creation', () => {
    renderWithClient(<VaultsListPage />)
    expect(screen.getByRole('link', { name: 'Create Vault' })).toHaveAttribute('href', '/vaults/create')
  })
})
