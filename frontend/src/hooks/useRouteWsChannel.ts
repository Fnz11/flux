import { useEffect, useRef, useMemo } from 'react'
import { useWebSocketStore } from '@/stores/websocket-store'

export function useRouteWsChannel(channels: (string | null | undefined)[], wallet?: string | null) {
  const subscribeMany = useWebSocketStore((s) => s.subscribeMany)
  const unsubscribeMany = useWebSocketStore((s) => s.unsubscribeMany)

  const channelKey = useMemo(() => {
    return channels.filter((c): c is string => Boolean(c)).sort().join(',')
  }, [channels])

  const subscribedRef = useRef<string[]>([])

  useEffect(() => {
    const validChannels = channels.filter((c): c is string => Boolean(c))
    if (validChannels.length === 0) return

    const prev = subscribedRef.current
    const toSubscribe = validChannels.filter((c) => !prev.includes(c))
    const toUnsubscribe = prev.filter((c) => !validChannels.includes(c))

    if (toUnsubscribe.length > 0) {
      unsubscribeMany(toUnsubscribe)
    }
    if (toSubscribe.length > 0) {
      subscribeMany(toSubscribe, wallet || undefined)
    }

    subscribedRef.current = validChannels
  }, [channelKey, wallet, subscribeMany, unsubscribeMany])

  useEffect(() => {
    return () => {
      if (subscribedRef.current.length > 0) {
        unsubscribeMany(subscribedRef.current)
        subscribedRef.current = []
      }
    }
  }, [unsubscribeMany])
}
