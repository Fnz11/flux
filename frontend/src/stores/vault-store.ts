import { create } from 'zustand'
import type { Vault } from '@/types'
import { getVaults, getVault, updateVaultMetadata } from '@/services/apis/rest-api/vault.service'

interface VaultUIState {
  selectedVaultId: string | null
  searchQuery: string
  filterCategory: string
  isCreateModalOpen: boolean
  vaults: Vault[]
  currentVault: Vault | null
  isLoading: boolean
  error: string | null
}

interface VaultUIActions {
  setSelectedVaultId: (id: string | null) => void
  setSearchQuery: (query: string) => void
  setFilterCategory: (category: string) => void
  setCreateModalOpen: (open: boolean) => void
  fetchVaults: () => Promise<Vault[]>
  fetchVaultById: (id: string) => Promise<Vault | null>
  updateVaultMetadata: (id: string, metadata: Parameters<typeof updateVaultMetadata>[1]) => Promise<Vault>
  reset: () => void
}

export type VaultStore = VaultUIState & VaultUIActions

export const useVaultStore = create<VaultStore>()((set) => ({
  selectedVaultId: null,
  searchQuery: '',
  filterCategory: 'all',
  isCreateModalOpen: false,
  vaults: [],
  currentVault: null,
  isLoading: false,
  error: null,

  setSelectedVaultId: (id) => set({ selectedVaultId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setFilterCategory: (category) => set({ filterCategory: category }),
  setCreateModalOpen: (open) => set({ isCreateModalOpen: open }),

  fetchVaults: async () => {
    set({ isLoading: true, error: null })
    try {
      const data = await getVaults()
      set({ vaults: data, isLoading: false })
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ error: msg, isLoading: false })
      throw err
    }
  },

  fetchVaultById: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const data = await getVault(id)
      set({ currentVault: data, isLoading: false })
      return data
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ error: msg, isLoading: false })
      return null
    }
  },

  updateVaultMetadata: async (id, metadata) => {
    const updated = await updateVaultMetadata(id, metadata)
    set((state) => ({
      vaults: state.vaults.map((v) => (v.id === id ? updated : v)),
      currentVault: state.currentVault?.id === id ? updated : state.currentVault,
    }))
    return updated
  },

  reset: () => set({ selectedVaultId: null, searchQuery: '', filterCategory: 'all', isCreateModalOpen: false, vaults: [], currentVault: null, isLoading: false, error: null }),
}))
