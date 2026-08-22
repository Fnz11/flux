import { useMemo } from 'react'
import { useRouteWsChannel } from './useRouteWsChannel'

interface IdentifiableVault {
  id?: string
  address?: string
}

/**
 * Senior engineering hook for Dynamic Viewport Subscriptions.
 * Subscribes to a batch of visible vault addresses in a single WebSocket frame
 * and automatically tears down the subscriptions when leaving the view.
 */
export function useVisibleVaultsWs(
  vaults: IdentifiableVault[] | undefined | null,
  walletAddress?: string | null
) {
  const activeChannels = useMemo(() => {
    const channels: string[] = []
    if (walletAddress) {
      channels.push(`portfolio:${walletAddress}`)
      channels.push(`user:${walletAddress}`)
    }
    if (vaults && vaults.length > 0) {
      vaults.forEach((v) => {
        const id = v.address || v.id
        if (id) {
          channels.push(`vault:${id}`)
        }
      })
    }
    return channels
  }, [walletAddress, vaults])

  useRouteWsChannel(activeChannels, walletAddress)

  return activeChannels
}
