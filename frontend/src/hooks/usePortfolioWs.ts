import { useMemo } from 'react'
import { useRouteWsChannel } from './useRouteWsChannel'

/**
 * Hook to subscribe to portfolio realtime updates
 * Only used on pages that display portfolio / position metrics.
 */
export function usePortfolioWs(walletAddress?: string | null) {
  const channels = useMemo(() => {
    if (!walletAddress) return []
    return ['portfolio']
  }, [walletAddress])

  useRouteWsChannel(channels, walletAddress)
}
