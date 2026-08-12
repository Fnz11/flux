import { beforeEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api'
import {
  createVault,
  getVault,
  getVaultBalances,
  getVaults,
  updateVaultMetadata,
} from '@/services/apis/rest-api/vault.service'

vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}))

const apiVault = {
  id: 'vault-1',
  address: 'address-1',
  manager_id: 'manager-1',
  manager_address: 'wallet-1',
  status: 'Active',
  metadata: {
    display_name: 'Alpha Vault',
    description: 'Momentum strategy',
    focus_assets: ['SOL', 'USDC'],
  },
  performance_fee_bps: 2000,
  management_fee_bps: 100,
  tvl: '1250.5',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-02T00:00:00.000Z',
}

describe('vault service', () => {
  beforeEach(() => vi.resetAllMocks())

  it('requests the vault list without an empty query string', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ vaults: [], total: 0 })

    await expect(getVaults()).resolves.toEqual([])
    expect(api.get).toHaveBeenCalledWith('/vaults')
  })

  it('omits the All status and empty optional filters', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([])

    await getVaults({ status: 'All', sortBy: '', managerAddress: '' })

    expect(api.get).toHaveBeenCalledWith('/vaults')
  })

  it('builds and URL-encodes every vault filter', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([])

    await getVaults({
      status: 'Fund Raising',
      sortBy: 'total value',
      sortOrder: 'desc',
      managerAddress: 'wallet/a+b',
    })

    expect(api.get).toHaveBeenCalledWith(
      '/vaults?status=Fund+Raising&sort_by=total+value&sort_order=desc&manager_address=wallet%2Fa%2Bb',
    )
  })

  it('maps vaults from an envelope and converts numeric fields', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ vaults: [apiVault], total: 1 })

    const [vault] = await getVaults()

    expect(vault).toMatchObject({
      id: 'vault-1',
      managerAddress: 'wallet-1',
      tvl: 1250.5,
      performanceFeeBps: 2000,
      metadata: { displayName: 'Alpha Vault', focusAssets: ['SOL', 'USDC'] },
    })
  })

  it('accepts a bare vault array response', async () => {
    vi.mocked(api.get).mockResolvedValueOnce([apiVault])

    await expect(getVaults()).resolves.toHaveLength(1)
  })

  it('returns an empty list for a malformed vault envelope', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ unexpected: true })

    await expect(getVaults()).resolves.toEqual([])
  })

  it('gets and maps one vault from its exact endpoint', async () => {
    vi.mocked(api.get).mockResolvedValueOnce(apiVault)

    await expect(getVault('vault/one')).resolves.toMatchObject({ id: 'vault-1', tvl: 1250.5 })
    expect(api.get).toHaveBeenCalledWith('/vaults/vault/one')
  })

  it('posts the create payload unchanged and maps the response', async () => {
    const input = { metadata: { displayName: 'New', description: '', focusAssets: ['SOL'] } }
    vi.mocked(api.post).mockResolvedValueOnce({ ...apiVault, id: 'vault-2' })

    await expect(createVault(input)).resolves.toMatchObject({ id: 'vault-2' })
    expect(api.post).toHaveBeenCalledWith('/vaults', input)
  })

  it('patches only metadata at the vault metadata endpoint', async () => {
    const metadata = { description: 'Updated' }
    vi.mocked(api.patch).mockResolvedValueOnce(apiVault)

    await updateVaultMetadata('vault-1', metadata)

    expect(api.patch).toHaveBeenCalledWith('/vaults/vault-1', metadata)
  })

  it('supports bare and enveloped balance arrays', async () => {
    const balances = [{ mint: 'mint-1', symbol: 'SOL', amount: 2, usdValue: 300 }]
    vi.mocked(api.get)
      .mockResolvedValueOnce(balances)
      .mockResolvedValueOnce({ balances })

    await expect(getVaultBalances('vault-1')).resolves.toEqual(balances)
    await expect(getVaultBalances('vault-1')).resolves.toEqual(balances)
    expect(api.get).toHaveBeenNthCalledWith(1, '/vaults/vault-1/balances')
  })

  it('returns no balances for malformed data and propagates request failures', async () => {
    vi.mocked(api.get).mockResolvedValueOnce({ balances: null })
    await expect(getVaultBalances('vault-1')).resolves.toEqual([])

    const error = new Error('offline')
    vi.mocked(api.get).mockRejectedValueOnce(error)
    await expect(getVaults()).rejects.toBe(error)
  })
})
