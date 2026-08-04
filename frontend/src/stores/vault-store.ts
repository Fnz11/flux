import { create } from 'zustand'
import { getVaults, getVault, updateVaultMetadata as updateVaultMeta } from '@/services/apis/rest-api/vault.service'
import { formatError } from '@/lib/errors'
import type { Vault, VaultMetadata } from '../types'

interface VaultState {
  vaults: Vault[]
  currentVault: Vault | null
  isLoading: boolean
  error: string | null
}

interface VaultActions {
  fetchVaults: () => Promise<void>
  fetchVaultById: (id: string) => Promise<void>
  updateVaultMetadata: (id: string, metadata: Partial<VaultMetadata>) => Promise<void>
  invalidateCache: () => void
}

type VaultStore = VaultState & VaultActions

export const useVaultStore = create<VaultStore>()((set, get) => ({
  vaults: [],
  currentVault: null,
  isLoading: false,
  error: null,

  fetchVaults: async () => {
    set({ isLoading: true, error: null })
    try {
      const vaults = await getVaults()
      set({ vaults, isLoading: false })
    } catch (err) {
      set({
        isLoading: false,
        error: formatError(err, 'Failed to fetch vaults'),
      })
    }
  },

  fetchVaultById: async (id) => {
    set({ isLoading: true, error: null })
    try {
      const vault = await getVault(id)
      set({ currentVault: vault, isLoading: false })
    } catch (err) {
      set({
        isLoading: false,
        error: formatError(err, 'Failed to fetch vault'),
      })
    }
  },

  updateVaultMetadata: async (id, metadata) => {
    set({ error: null })
    try {
      const updated = await updateVaultMeta(id, metadata)
      set((s) => ({
        vaults: s.vaults.map((v) => (v.id === id ? updated : v)),
        currentVault: s.currentVault?.id === id ? updated : s.currentVault,
      }))
    } catch (err) {
      set({ error: formatError(err, 'Failed to update vault') })
    }
  },

  invalidateCache: () => {
    const { currentVault } = get()
    if (currentVault) {
      get().fetchVaultById(currentVault.id)
    }
  },
}))
