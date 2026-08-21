import { useQueries } from '@tanstack/react-query'
import { getHistory, mapApiTrade } from '@/services/apis/rest-api/trade.service'
import type { ApiTrade } from '@/types'
import { useMemo } from 'react'

export function useTradeHistory(vaultIds: string[]) {
  const results = useQueries({
    queries: vaultIds.map((id) => ({
      queryKey: ['trades', id],
      queryFn: () => getHistory(id).catch(() => ({ trades: [] as ApiTrade[], vault_id: id })),
      enabled: Boolean(id),
    })),
  })

  const isLoading = results.some((r) => r.isLoading)

  const trades = useMemo(() => {
    const allTrades = results.flatMap((r) => r.data?.trades || []).map(mapApiTrade)
    allTrades.sort((a, b) => new Date(b.executed_at).getTime() - new Date(a.executed_at).getTime())
    return allTrades
  }, [results])

  return { trades, isLoading }
}
