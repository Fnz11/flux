import { create } from 'zustand'
import { getConfig } from '@/services/apis/rest-api/config.service'
import { formatError } from '@/lib/errors'
import type { AppConfig } from '../types'

interface ConfigState {
  config: AppConfig | null
  isLoading: boolean
  error: string | null
}

interface ConfigActions {
  fetchConfig: () => Promise<void>
}

type ConfigStore = ConfigState & ConfigActions

const DEFAULT_CONFIG: AppConfig = {
  dustThreshold: 0.001,
  focusAssetsWhitelist: [],
  minRaiseAmount: 0,
  lockupPeriod: 0,
}

export const useConfigStore = create<ConfigStore>()((set) => ({
  config: null,
  isLoading: false,
  error: null,

  fetchConfig: async () => {
    set({ isLoading: true, error: null })
    try {
      const config = await getConfig()
      set({ config, isLoading: false })
    } catch (err) {
      set({
        config: DEFAULT_CONFIG,
        isLoading: false,
        error: formatError(err, 'Failed to fetch config'),
      })
    }
  },
}))
