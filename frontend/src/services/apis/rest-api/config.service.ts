import { api } from '@/lib/api'
import { mapApiConfigToConfig, type RawApiConfig } from '@/lib/mappers'
import type { AppConfig } from '@/types'

export async function getConfig(): Promise<AppConfig> {
  const res = await api.get<RawApiConfig | { data?: RawApiConfig }>('/config')
  const payload = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res
  return mapApiConfigToConfig(payload as RawApiConfig)
}
