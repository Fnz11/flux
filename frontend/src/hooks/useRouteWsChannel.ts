import { useEffect } from 'react'
import { useWebSocketStore } from '@/stores/websocket-store'

export function useRouteWsChannel(channels: (string | null | undefined)[]) {
  const subscribe = useWebSocketStore((s) => s.subscribe)
  const unsubscribe = useWebSocketStore((s) => s.unsubscribe)

  const validChannels = channels.filter((c): c is string => Boolean(c))
  const channelKey = validChannels.join(',')

  useEffect(() => {
    if (validChannels.length === 0) return

    validChannels.forEach((channel) => {
      subscribe(channel)
    })

    return () => {
      validChannels.forEach((channel) => {
        unsubscribe(channel)
      })
    }
  }, [channelKey, subscribe, unsubscribe])
}
