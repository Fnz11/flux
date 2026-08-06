import { api } from '@/lib/api'
import type { SearchResults, SearchRole, SearchPair, SearchVault } from '@/types'
export interface SearchParams { q: string; role: SearchRole; limit?: number }
export async function search(params: SearchParams): Promise<SearchResults> {
  const q = new URLSearchParams()
  q.set('q', params.q); q.set('role', params.role)
  if (params.limit) q.set('limit', String(params.limit))
  const res = await api.get(`/search?${q.toString()}`) as unknown as { kind: string; items: Array<{ symbol?: string; id?: string; address?: string; display_name?: string; tvl?: number }> }
  if (res?.kind === 'pairs') {
    const items: SearchPair[] = (res.items ?? []).map(i => ({ symbol: i.symbol ?? '' }))
    return { kind: 'pairs', items }
  }
  const items: SearchVault[] = (res.items ?? []).map(v => ({ id: v.id ?? '', address: v.address ?? '', displayName: v.display_name ?? '', tvl: v.tvl ?? 0 }))
  return { kind: 'vaults', items }
}