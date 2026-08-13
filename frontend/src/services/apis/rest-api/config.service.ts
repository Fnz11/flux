import { api } from '@/lib/api'
import { mapApiConfigToConfig, type RawApiConfig } from '@/lib/mappers'
import type { AppConfig } from '@/types'

export async function getConfig(): Promise<AppConfig> {
  const raw = await api.get<RawApiConfig>('/config')
  return mapApiConfigToConfig(raw)
}
