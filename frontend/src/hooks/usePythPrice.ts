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
  'SOL': 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'SOL/USD': 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  'USDC': 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  'USDT': '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  'BONK': '72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419',
  'JUP': '0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  'PYTH': '0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff',
}

function getFeedId(key: string): string | undefined {
  if (priceFeedIds[key]) return priceFeedIds[key]
  const base = key.split('/')[0]
  return priceFeedIds[base]
}

export function usePythPrice(symbolOrPair: string): PythPriceResult {
  const [result, setResult] = useState<PythPriceResult>({
    price: 0,
    confidence: 0,
    status: 'loading',
    lastUpdated: null,
  })

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const feedId = getFeedId(symbolOrPair)
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
        let adjustedPrice = Number(price) * 10 ** expo
        let adjustedConf = Number(conf) * 10 ** expo

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
  }, [symbolOrPair])

  return result
}
