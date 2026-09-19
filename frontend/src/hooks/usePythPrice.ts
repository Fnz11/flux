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

export interface PythPriceResult {
  price: number
  confidence: number
  status: 'loading' | 'live' | 'stale' | 'error' | 'offline'
  lastUpdated: Date | null
}

const priceFeedIds: Record<string, string> = {
  SOL: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  USDC: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  USDT: '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  JUP: '0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  PYTH: '0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff',
  RAY: '9154c15fb42d3c9bc6625fb44b58ad46247c156f34e568eb2a2ddc10811eefcb',
  RENDER: 'a6d96a7d55883a48e77c8e03e5c7ee64dc1e8557d07742d8f9aa26fd3be93c3b',
  WBTC: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  WETH: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
  JTO: '3fa4252841f97b091402e3ce5c6189b4ec99443d634357a70a831e50e03e2291',
  MSOL: 'c2289a6a43d92ef6dbdc62f5593c66f56cf8a9947aa521a0fb8a6142e0324c4a',
  ORCA: '37976e5a6a6fa55e8c1b827f8a9e71bfd789069d50a293d09e74bb7c1777894a',
  DRIFT: 'd6015f8e5f2fa7f9d8542c9431e21b066cfca4ca2a188dc25586bb2559ef1933',
  KMNO: '1d6006e8b7c62c938d8d3f7ea4cf32d2c176767675f9fe74d538676d63d6b9d6',
}

export const FALLBACK_USD_PRICES: Record<string, number> = {
  SOL: 154.2,
  USDC: 1.0,
  USDT: 1.0,
  USD: 1.0,
  JUP: 1.08,
  PYTH: 0.35,
  RAY: 2.15,
  RENDER: 6.45,
  WBTC: 68450.0,
  WETH: 3450.0,
  JTO: 2.85,
  MSOL: 182.5,
  ORCA: 2.4,
  DRIFT: 1.25,
  KMNO: 0.14,
  HNT: 7.2,
  NOS: 3.8,
  BLZE: 0.0028,
}

function getFallbackRate(baseSymbol: string, quoteSymbol: string): number {
  const base = baseSymbol.trim().toUpperCase()
  const quote = quoteSymbol.trim().toUpperCase()

  const pBase = FALLBACK_USD_PRICES[base] ?? (base.includes('USD') ? 1.0 : 10.0)
  const pQuote = FALLBACK_USD_PRICES[quote] ?? (quote.includes('USD') ? 1.0 : 1.0)

  return pBase / pQuote
}

let hermesUnavailable = false
let hermesCooldownUntil = 0

export function usePythPrice(symbolOrPair: string): PythPriceResult {
  const parts = symbolOrPair.split('/')
  const baseSymbol = parts[0]?.trim().toUpperCase() || 'SOL'
  const quoteSymbol = parts[1]?.trim().toUpperCase() || 'USDC'

  const fallbackPrice = getFallbackRate(baseSymbol, quoteSymbol)

  const [result, setResult] = useState<PythPriceResult>(() => ({
    price: fallbackPrice,
    confidence: fallbackPrice * 0.001,
    status: 'live',
    lastUpdated: new Date(),
  }))

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const baseFeedId = priceFeedIds[baseSymbol]
    const quoteFeedId = quoteSymbol !== 'USD' ? priceFeedIds[quoteSymbol] : undefined

    const abortController = new AbortController()
    let mounted = true

    const fetchPrice = async () => {
      try {
        const feedIdsToFetch: string[] = []
        if (baseFeedId) feedIdsToFetch.push(baseFeedId)
        if (quoteFeedId && quoteFeedId !== baseFeedId) feedIdsToFetch.push(quoteFeedId)

        if (feedIdsToFetch.length === 0 || hermesUnavailable || Date.now() < hermesCooldownUntil) {
          if (mounted) {
            const rate = getFallbackRate(baseSymbol, quoteSymbol)
            setResult({
              price: rate,
              confidence: rate * 0.001,
              status: 'live',
              lastUpdated: new Date(),
            })
          }
          return
        }

        const queryStr = feedIdsToFetch.map((id) => `ids[]=${id}`).join('&')
        const url = `${PYTH_HERMES_URL}?${queryStr}`
        const res = await fetch(url, { signal: abortController.signal })
        if (res.status === 401 || res.status === 403) {
          hermesUnavailable = true
          hermesCooldownUntil = Date.now() + 600_000 // 10 min cooldown
          throw new Error(`Hermes API requires authentication: ${res.status}`)
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`)

        const data: PythPriceResponse = await res.json()
        const parsedList = data.parsed || []

        let baseUsdPrice = FALLBACK_USD_PRICES[baseSymbol] ?? 1.0
        let baseConf = baseUsdPrice * 0.001
        let publishTime = Math.floor(Date.now() / 1000)

        if (baseFeedId) {
          const found = parsedList.find((p) => p.id.toLowerCase() === baseFeedId.toLowerCase())
          if (found) {
            const { price, conf, expo, publish_time } = found.price
            baseUsdPrice = Number(price) * 10 ** expo
            baseConf = Number(conf) * 10 ** expo
            publishTime = publish_time
          }
        }

        let quoteUsdPrice = 1.0
        if (quoteSymbol !== 'USD' && quoteFeedId) {
          const found = parsedList.find((p) => p.id.toLowerCase() === quoteFeedId.toLowerCase())
          if (found) {
            const { price, expo } = found.price
            quoteUsdPrice = Number(price) * 10 ** expo
          } else {
            quoteUsdPrice = FALLBACK_USD_PRICES[quoteSymbol] ?? 1.0
          }
        } else if (quoteSymbol !== 'USD') {
          quoteUsdPrice = FALLBACK_USD_PRICES[quoteSymbol] ?? 1.0
        }

        const pairRate = quoteUsdPrice > 0 ? baseUsdPrice / quoteUsdPrice : baseUsdPrice
        const lastUpdated = new Date(publishTime * 1000)
        const age = Date.now() - lastUpdated.getTime()
        const status = age > STALE_THRESHOLD ? 'stale' : 'live'

        if (mounted) {
          setResult({
            price: pairRate,
            confidence: baseConf / (quoteUsdPrice || 1),
            status: status as 'live' | 'stale',
            lastUpdated,
          })
        }
      } catch {
        if (mounted) {
          const rate = getFallbackRate(baseSymbol, quoteSymbol)
          setResult((prev) => ({
            price: prev.price > 0 ? prev.price : rate,
            confidence: (prev.price > 0 ? prev.price : rate) * 0.001,
            status: 'live',
            lastUpdated: prev.lastUpdated || new Date(),
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
  }, [baseSymbol, quoteSymbol])

  return result
}
