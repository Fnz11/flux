import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useConfigStore } from '../src/stores/config-store'
import { getConfig } from '../src/services/apis/rest-api/config.service'

vi.mock('../src/services/apis/rest-api/config.service', () => ({
  getConfig: vi.fn(),
}))

describe('useConfigStore', () => {
  beforeEach(() => {
    useConfigStore.setState({ config: null, isLoading: false, error: null })
    vi.resetAllMocks()
  })

  it('initializes without config or request state', () => {
    expect(useConfigStore.getState()).toMatchObject({ config: null, isLoading: false, error: null })
  })

  it('loads config and exposes loading while pending', async () => {
    const config = { dustThreshold: 0.01, focusAssetsWhitelist: ['SOL'], minRaiseAmount: 10, lockupPeriod: 7 }
    let resolveConfig!: (value: typeof config) => void
    vi.mocked(getConfig).mockReturnValue(new Promise((resolve) => {
      resolveConfig = resolve
    }))

    const request = useConfigStore.getState().fetchConfig()
    expect(useConfigStore.getState().isLoading).toBe(true)
    resolveConfig(config)
    await request

    expect(useConfigStore.getState()).toMatchObject({ config, isLoading: false, error: null })
  })

  it('uses safe defaults and records an API failure', async () => {
    vi.mocked(getConfig).mockRejectedValue(new Error('Config unavailable'))

    await useConfigStore.getState().fetchConfig()

    expect(useConfigStore.getState()).toMatchObject({
      config: { dustThreshold: 0.001, focusAssetsWhitelist: [], minRaiseAmount: 0, lockupPeriod: 0 },
      isLoading: false,
      error: 'Config unavailable',
    })
  })

  it('merges partial updates into defaults or existing config', () => {
    useConfigStore.getState().updateConfig({ minRaiseAmount: 25 })
    expect(useConfigStore.getState().config).toEqual({
      dustThreshold: 0.001,
      focusAssetsWhitelist: [],
      minRaiseAmount: 25,
      lockupPeriod: 0,
    })

    useConfigStore.getState().updateConfig({ dustThreshold: 0.02 })
    expect(useConfigStore.getState().config).toMatchObject({ minRaiseAmount: 25, dustThreshold: 0.02 })
  })
})
