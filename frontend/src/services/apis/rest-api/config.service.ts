import { api } from '@/lib/api'
import { mapApiConfigToConfig } from '@/lib/mappers'
import type { AppConfig } from '@/types'

export async function getConfig(): Promise<AppConfig> {
  const raw = await api.get('/config')
  return mapApiConfigToConfig(raw)
}
