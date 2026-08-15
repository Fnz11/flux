import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Route } from '@/routes/invest/vaults/index'

const mocks = vi.hoisted(() => ({
  vaults: [] as any[],
  isLoading: false,
  error: null as Error | null,
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: any) => options,
  useNavigate: () => vi.fn(),
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}))

vi.mock('@/services/hooks/useQuery/useVaultsQuery', () => ({
  useVaultsQuery: () => ({
    data: mocks.vaults,
    isLoading: mocks.isLoading,
    error: mocks.error,
  }),
}))

const VaultInvestListPage = (Route as any).component

describe('VaultInvestListPage', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    mocks.vaults = []
    mocks.isLoading = false
    mocks.error = null
  })

  it('renders without maximum depth exceeded when empty', () => {
    render(
      <QueryClientProvider client={queryClient}>
        <VaultInvestListPage />
      </QueryClientProvider>,
    )
    expect(screen.getByText('Vaults')).toBeInTheDocument()
  })

  it('renders with populated vaults', () => {
    mocks.vaults = [
      {
        id: 'vault-1',
        address: 'VaultAddress123456789',
        managerAddress: 'manager-1',
        managerId: 'manager-1',
        status: 'Active',
        metadata: {
          displayName: 'Alpha Vault',
          description: 'Alpha strategy',
          focusAssets: ['SOL', 'USDC'],
        },
        performanceFeeBps: 1000,
        managementFeeBps: 200,
        tvl: 100000,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]

    render(
      <QueryClientProvider client={queryClient}>
        <VaultInvestListPage />
      </QueryClientProvider>,
    )
    expect(screen.getByText('Alpha Vault')).toBeInTheDocument()
  })
})
