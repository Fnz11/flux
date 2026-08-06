import { useEffect, useRef } from 'react'
import { useWebSocketStore } from '@/stores/websocket-store'

export function useRouteWsChannel(channels: (string | null | undefined)[]) {
  const subscribe = useWebSocketStore((s) => s.subscribe)
  const unsubscribe = useWebSocketStore((s) => s.unsubscribe)

  const validChannels = channels.filter((c): c is string => Boolean(c))
  const channelKey = validChannels.join(',')

  const channelsRef = useRef(validChannels)

  useEffect(() => {
    channelsRef.current = validChannels
  })

  useEffect(() => {
    const activeChannels = channelsRef.current
    if (activeChannels.length === 0) return

    activeChannels.forEach((channel) => {
      subscribe(channel)
    })

    return () => {
      activeChannels.forEach((channel) => {
        unsubscribe(channel)
      })
    }
  }, [channelKey, subscribe, unsubscribe])
}
