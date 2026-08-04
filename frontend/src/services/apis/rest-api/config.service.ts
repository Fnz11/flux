import { api } from '@/lib/api'
import type { AppConfig } from '@/types'

export function getConfig(): Promise<AppConfig> {
  return api.get('/config')
}
