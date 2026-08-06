import { create } from 'zustand'
import type { PortfolioPosition } from '@/types'
import { getPortfolio } from '@/services/apis/rest-api/portfolio.service'

interface PortfolioUIState {
  selectedPositionId: string | null
  timeRange: string
  sortBy: string
  positions: PortfolioPosition[]
  isLoading: boolean
  error: string | null
}

interface PortfolioUIActions {
  setSelectedPositionId: (id: string | null) => void
  setTimeRange: (range: string) => void
  setSortBy: (sort: string) => void
  fetchPortfolio: (walletAddress: string) => Promise<PortfolioPosition[]>
  reset: () => void
}

export type PortfolioStore = PortfolioUIState & PortfolioUIActions

export const usePortfolioStore = create<PortfolioStore>()((set) => ({
  selectedPositionId: null,
  timeRange: '30d',
  sortBy: 'value',
  positions: [],
  isLoading: false,
  error: null,

  setSelectedPositionId: (id) => set({ selectedPositionId: id }),
  setTimeRange: (range) => set({ timeRange: range }),
  setSortBy: (sort) => set({ sortBy: sort }),

  fetchPortfolio: async (walletAddress) => {
    set({ isLoading: true, error: null })
    try {
      const positions = await getPortfolio(walletAddress)
      set({ positions, isLoading: false })
      return positions
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ error: msg, isLoading: false })
      return []
    }
  },

  reset: () => set({ selectedPositionId: null, timeRange: '30d', sortBy: 'value', positions: [], isLoading: false, error: null }),
}))
