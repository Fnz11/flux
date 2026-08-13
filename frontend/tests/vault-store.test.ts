import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useVaultStore } from '../src/stores/vault-store'
import { getVaults, getVault, updateVaultMetadata } from '../src/services/apis/rest-api/vault.service'
import type { Vault } from '../src/types'

vi.mock('../src/services/apis/rest-api/vault.service', () => ({
  getVaults: vi.fn(),
  getVault: vi.fn(),
  updateVaultMetadata: vi.fn(),
}))

function createTestVault(overrides: Partial<Vault> = {}): Vault {
  return {
    id: 'v_1',
    address: 'Vault11111111111111111111111111111111111111',
    managerAddress: 'Manager11111111111111111111111111111111111',
    managerId: 'manager_1',
    status: 'Active',
    metadata: {
      displayName: 'Test Vault',
      description: 'Test Description',
      focusAssets: ['SOL'],
    },
    performanceFeeBps: 1000,
    managementFeeBps: 200,
    tvl: 1000,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    ...overrides,
  }
}

describe('Vault Store', () => {
  beforeEach(() => {
    useVaultStore.getState().reset()
    vi.resetAllMocks()
  })

  it('initializes with default state', () => {
    const state = useVaultStore.getState()
    expect(state.selectedVaultId).toBeNull()
    expect(state.searchQuery).toBe('')
    expect(state.filterCategory).toBe('all')
    expect(state.vaults).toEqual([])
    expect(state.isLoading).toBe(false)
    expect(state.error).toBeNull()
  })

  it('updates searchQuery and filterCategory', () => {
    useVaultStore.getState().setSearchQuery('Alpha')
    useVaultStore.getState().setFilterCategory('Active')
    
    expect(useVaultStore.getState().searchQuery).toBe('Alpha')
    expect(useVaultStore.getState().filterCategory).toBe('Active')
  })

  it('fetchVaults sets vaults and loading state on success', async () => {
    const mockVaults = [createTestVault({ id: 'v_1', tvl: 1000 })]
    vi.mocked(getVaults).mockResolvedValue(mockVaults)

    const promise = useVaultStore.getState().fetchVaults()
    
    // Check loading state while fetching
    expect(useVaultStore.getState().isLoading).toBe(true)
    
    const vaults = await promise
    
    expect(vaults).toEqual(mockVaults)
    expect(useVaultStore.getState().vaults).toEqual(mockVaults)
    expect(useVaultStore.getState().isLoading).toBe(false)
    expect(useVaultStore.getState().error).toBeNull()
  })

  it('fetchVaults sets error on failure', async () => {
    const error = new Error('Network Error')
    vi.mocked(getVaults).mockRejectedValue(error)

    await expect(useVaultStore.getState().fetchVaults()).rejects.toThrow('Network Error')
    
    expect(useVaultStore.getState().isLoading).toBe(false)
    expect(useVaultStore.getState().error).toBe('Network Error')
    expect(useVaultStore.getState().vaults).toEqual([])
  })

  it('fetchVaultById stores and returns the requested vault', async () => {
    const vault = createTestVault({ id: 'v_1', metadata: { displayName: 'Alpha', description: '', focusAssets: [] } })
    vi.mocked(getVault).mockResolvedValue(vault)

    const result = await useVaultStore.getState().fetchVaultById('v_1')

    expect(getVault).toHaveBeenCalledWith('v_1')
    expect(result).toBe(vault)
    expect(useVaultStore.getState().currentVault).toBe(vault)
    expect(useVaultStore.getState().isLoading).toBe(false)
  })

  it('fetchVaultById returns null and records lookup failures', async () => {
    vi.mocked(getVault).mockRejectedValue(new Error('Vault not found'))

    const result = await useVaultStore.getState().fetchVaultById('missing')

    expect(result).toBeNull()
    expect(useVaultStore.getState().currentVault).toBeNull()
    expect(useVaultStore.getState().error).toBe('Vault not found')
    expect(useVaultStore.getState().isLoading).toBe(false)
  })

  it('updateVaultMetadata updates existing vault in list and currentVault', async () => {
    const mockVault = createTestVault({ id: 'v_1', metadata: { displayName: 'Old', description: '', focusAssets: [] } })
    const updatedVault = createTestVault({ id: 'v_1', metadata: { displayName: 'New', description: '', focusAssets: [] } })
    
    useVaultStore.setState({ 
      vaults: [mockVault], 
      currentVault: mockVault 
    })
    
    vi.mocked(updateVaultMetadata).mockResolvedValue(updatedVault)
    
    await useVaultStore.getState().updateVaultMetadata('v_1', { displayName: 'New' })
    
    expect(useVaultStore.getState().vaults[0].metadata.displayName).toBe('New')
    expect(useVaultStore.getState().currentVault?.metadata.displayName).toBe('New')
  })

  it('reset restores UI and request state defaults', () => {
    const v = createTestVault({ id: 'v_1' })
    useVaultStore.setState({
      selectedVaultId: 'v_1',
      searchQuery: 'alpha',
      filterCategory: 'active',
      isCreateModalOpen: true,
      vaults: [v],
      currentVault: v,
      isLoading: true,
      error: 'stale',
    })

    useVaultStore.getState().reset()

    expect(useVaultStore.getState()).toMatchObject({
      selectedVaultId: null,
      searchQuery: '',
      filterCategory: 'all',
      isCreateModalOpen: false,
      vaults: [],
      currentVault: null,
      isLoading: false,
      error: null,
    })
  })
})
