import { useState, useEffect, useRef } from 'react'

const PYTH_HERMES_URL = 'https://hermes.pyth.network/v2/updates/price/latest'
const POLL_INTERVAL = 5000
const STALE_THRESHOLD = 60_000

interface PythPriceResponse {
  parsed: Array<{
    id: string
    price: {
      price: string
      conf: string
      expo: number
      publish_time: number
    }
  }>
}

interface PythPriceResult {
  price: number
  confidence: number
  status: 'loading' | 'live' | 'stale' | 'error' | 'offline'
  lastUpdated: Date | null
}

const priceFeedIds: Record<string, string> = {
  'SOL/USDC': 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'SOL/USDT': 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'SOL/BONK': 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'USDC/SOL': 'eaa020c61cc47971281346194c5a240b4eccc5a8a4b6d0f3a3e6b6e6e0a9c1f',
  'BONK/SOL': '72b021217b7f8d5f8f3f7d9c8e5c6b7a6f8f9e0d1c2b3a4d5e6f7a8b9c0d',
}

function getPriceFeedId(pair: string): string | undefined {
  return priceFeedIds[pair]
}

export function usePythPrice(pair: string): PythPriceResult {
  const [result, setResult] = useState<PythPriceResult>({
    price: 0,
    confidence: 0,
    status: 'loading',
    lastUpdated: null,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const feedId = getPriceFeedId(pair)
    if (!feedId) {
      setResult({
        price: 0,
        confidence: 0,
        status: 'error',
        lastUpdated: null,
      })
      return
    }

    const abortController = new AbortController()
    let mounted = true

    const fetchPrice = async () => {
      try {
        const url = `${PYTH_HERMES_URL}?ids[]=${feedId}`
        const res = await fetch(url, { signal: abortController.signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data: PythPriceResponse = await res.json()
        const parsed = data.parsed?.[0]
        if (!parsed) throw new Error('No price data')

        const { price, conf, expo, publish_time } = parsed.price
        const adjustedPrice = Number(price) * 10 ** expo
        const adjustedConf = Number(conf) * 10 ** expo
        const lastUpdated = new Date(publish_time * 1000)
        const age = Date.now() - lastUpdated.getTime()
        const status = age > STALE_THRESHOLD ? 'stale' : 'live'

        if (mounted) {
          setResult({
            price: adjustedPrice,
            confidence: adjustedConf,
            status: status as 'live' | 'stale',
            lastUpdated,
          })
        }
      } catch {
        if (mounted) {
          setResult((prev) => ({
            ...prev,
            status: prev.price === 0 ? 'error' : 'stale',
          }))
        }
      }
    }

    fetchPrice()
    intervalRef.current = setInterval(fetchPrice, POLL_INTERVAL)

    return () => {
      mounted = false
      abortController.abort()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [pair])

  return result
}
