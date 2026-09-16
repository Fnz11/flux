import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { makeVault } from './fixtures'

const mocks = vi.hoisted(() => ({
  id: 'vault-1',
  navigate: vi.fn(),
  create: vi.fn(),
  createPending: false,
  update: vi.fn(),
  vault: undefined as ReturnType<typeof makeVault> | undefined,
  fetchConfig: vi.fn(),
  wallet: {
    connected: true,
    publicKey: { toBase58: () => 'mock-wallet' } as { toBase58: () => string } | null,
    wallets: [],
  },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useParams: () => ({ id: mocks.id }),
  }),
  useNavigate: () => mocks.navigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

vi.mock('@solana/wallet-adapter-react', () => ({
  useWallet: () => mocks.wallet,
  useConnection: () => ({ connection: {} }),
}))

vi.mock('../../../src/routes/vaults/_hooks/useCreateVault', () => ({
  useCreateVault: () => ({ handleSubmit: mocks.create, isPending: mocks.createPending }),
}))
vi.mock('../../../src/hooks/usePythPrice', () => ({ usePythPrice: () => ({ status: 'live', price: 160 }) }))
vi.mock('../../../src/services/hooks', () => ({
  useVaultDetailQuery: () => ({ data: mocks.vault }),
  useUpdateVaultMetadataMutation: () => ({ mutateAsync: mocks.update }),
}))
vi.mock('../../../src/stores', () => ({
  useConfigStore: (selector: (state: Record<string, unknown>) => unknown) => selector({
    config: { focusAssetsWhitelist: ['SOL', 'USDC'], dustThreshold: 0.001, minRaiseAmount: 0, lockupPeriod: 0 },
    fetchConfig: mocks.fetchConfig,
  }),
  usePortfolioStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector({ reset: vi.fn() }),
    { getState: () => ({ reset: vi.fn() }) }
  ),
  useVaultStore: Object.assign(
    (selector: (state: Record<string, unknown>) => unknown) => selector({ reset: vi.fn() }),
    { getState: () => ({ reset: vi.fn() }) }
  ),
}))

import { CreateVaultPage } from '../../../src/routes/vaults/create.tsx'
import { Route as EditRoute } from '../../../src/routes/vaults/$id/edit'

const EditVaultPage = (EditRoute as unknown as { component: React.ComponentType }).component

describe('create vault form', () => {
  beforeEach(() => {
    mocks.create.mockReset()
    mocks.createPending = false
    mocks.wallet = {
      connected: true,
      publicKey: { toBase58: () => 'mock-wallet' },
      wallets: [],
    }
  })

  it('shows connect wallet prompt when wallet is not connected', () => {
    mocks.wallet = { connected: false, publicKey: null, wallets: [] }
    render(<CreateVaultPage />)
    expect(screen.getByText('Connect Your Wallet')).toBeInTheDocument()
    expect(screen.getByText('Please connect your wallet to create and manage investment vaults.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /CREATE VAULT/ })).not.toBeInTheDocument()
  })

  it('starts with submit disabled until terms accepted', () => {
    render(<CreateVaultPage />)
    expect(screen.getByRole('button', { name: /CREATE VAULT/ })).toBeDisabled()
  })

  it('shows identity validation errors', async () => {
    render(<CreateVaultPage />)
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /CREATE VAULT/ }))
    expect(await screen.findByText('Display name must be at least 2 characters')).toBeInTheDocument()
    expect(mocks.create).not.toHaveBeenCalled()
  })

  it('submits valid default configuration and identity', async () => {
    mocks.create.mockResolvedValue(undefined)
    render(<CreateVaultPage />)
    fireEvent.change(screen.getByLabelText('Display Name'), { target: { value: 'Yield Vault' } })
    fireEvent.change(screen.getByLabelText(/Strategy Description/), { target: { value: 'A valid strategy description.' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: /CREATE VAULT/ }))
    await waitFor(() => expect(mocks.create).toHaveBeenCalledTimes(1))
    expect(mocks.create.mock.calls[0][0]).toMatchObject({
      displayName: 'Yield Vault',
      acceptedAssets: ['SOL', 'USDC', 'USDT'],
      minRaiseAmount: 1,
      agreedToTerms: true,
    })
  })

  it('shows pending submission state', () => {
    mocks.createPending = true
    render(<CreateVaultPage />)
    expect(screen.getByRole('button', { name: /Creating Vault on Solana/ })).toBeDisabled()
  })
})

describe('edit vault form', () => {
  beforeEach(() => {
    mocks.navigate.mockReset()
    mocks.update.mockReset()
    mocks.fetchConfig.mockReset()
    mocks.vault = makeVault()
    mocks.wallet = {
      connected: true,
      publicKey: { toBase58: () => 'ManagerAddress1111222233334444' },
      wallets: [],
    }
  })

  it('shows access denied when user is not the manager', async () => {
    mocks.wallet = {
      connected: true,
      publicKey: { toBase58: () => 'other-wallet-address' },
      wallets: [],
    }
    render(<EditVaultPage />)
    expect(await screen.findByText('Manager Wallet Required')).toBeInTheDocument()
    expect(screen.getByText(/Your connected wallet is not the designated manager/)).toBeInTheDocument()
  })

  it('loads current metadata and configured assets', async () => {
    render(<EditVaultPage />)
    expect(await screen.findByDisplayValue('Alpha Vault')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'SOL' })).toBeInTheDocument()
    expect(mocks.fetchConfig).toHaveBeenCalled()
  })

  it('validates required display name', async () => {
    render(<EditVaultPage />)
    const name = await screen.findByDisplayValue('Alpha Vault')
    fireEvent.change(name, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    expect(await screen.findByText('Display name is required')).toBeInTheDocument()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it('submits changed metadata then navigates', async () => {
    mocks.update.mockResolvedValue(undefined)
    render(<EditVaultPage />)
    const name = await screen.findByDisplayValue('Alpha Vault')
    fireEvent.change(name, { target: { value: 'Updated Vault' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalledWith({
      id: 'vault-1',
      metadata: {
        displayName: 'Updated Vault',
        description: 'A diversified Solana strategy.',
        focusAssets: ['SOL', 'USDC'],
      },
    }))
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/vaults/$id', params: { id: 'vault-1' } })
  })

  it('stays on form after mutation error', async () => {
    mocks.update.mockRejectedValue(new Error('server error'))
    render(<EditVaultPage />)
    fireEvent.change(await screen.findByDisplayValue('Alpha Vault'), { target: { value: 'Failed Update' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }))
    await waitFor(() => expect(mocks.update).toHaveBeenCalled())
    expect(mocks.navigate).not.toHaveBeenCalled()
    expect(screen.getByDisplayValue('Failed Update')).toBeInTheDocument()
  })
})
