import { create } from 'zustand'
import { getPortfolio } from '@/services/apis/rest-api/portfolio.service'
import { formatError } from '@/lib/errors'
import type { PortfolioPosition } from '../types'

interface PortfolioState {
  positions: PortfolioPosition[]
  isLoading: boolean
  error: string | null
}

interface PortfolioActions {
  fetchPortfolio: (walletAddress: string) => Promise<void>
  updatePosition: (vaultId: string, updates: Partial<PortfolioPosition>) => void
}

type PortfolioStore = PortfolioState & PortfolioActions

export const usePortfolioStore = create<PortfolioStore>()((set) => ({
  positions: [],
  isLoading: false,
  error: null,

  fetchPortfolio: async (walletAddress) => {
    set({ isLoading: true, error: null })
    try {
      const positions = await getPortfolio(walletAddress)
      set({ positions, isLoading: false })
    } catch (err) {
      set({
        isLoading: false,
        error: formatError(err, 'Failed to fetch portfolio'),
      })
    }
  },

  updatePosition: (vaultId, updates) =>
    set((s) => ({
      positions: s.positions.map((pos) =>
        pos.vaultId === vaultId ? { ...pos, ...updates } : pos,
      ),
    })),
}))
