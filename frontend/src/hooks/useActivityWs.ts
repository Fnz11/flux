import { useMemo } from 'react'
import { useRouteWsChannel } from './useRouteWsChannel'

/**
 * Hook to subscribe to personal investment activity realtime updates (user:<wallet>:activity)
 * Translates cleanly to 'activity' over WebSocket.
 */
export function useActivityWs(walletAddress?: string | null) {
  const channels = useMemo(() => {
    if (!walletAddress) return []
    return ['activity']
  }, [walletAddress])

  useRouteWsChannel(channels, walletAddress)
}
