import { useMemo } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import { usePortfolioQuery } from '@/services/hooks/useQuery/usePortfolioQuery'
import type { PortfolioPosition } from '@/types'

export function usePortfolioPnl(walletAddressOrPositions?: string | PortfolioPosition[]) {
  const { publicKey } = useWallet()
  const isString = typeof walletAddressOrPositions === 'string'
  const walletAddress = isString
    ? walletAddressOrPositions
    : (!walletAddressOrPositions && publicKey ? publicKey.toBase58() : '')
  const { data: queriedPositions = [] } = usePortfolioQuery(walletAddress)

  const positions = useMemo(() => {
    if (Array.isArray(walletAddressOrPositions)) {
      return walletAddressOrPositions
    }
    return queriedPositions
  }, [walletAddressOrPositions, queriedPositions])

  return useMemo(() => {
    if (!positions || !positions.length) {
      return {
        totalInvested: 0,
        totalValue: 0,
        totalPnl: 0,
        totalPnlPercent: 0,
        positions: [],
      }
    }

    const totalInvested = positions.reduce((sum, p) => sum + p.totalInvested, 0)
    const totalValue = positions.reduce((sum, p) => sum + p.currentValue, 0)
    const totalPnl = totalValue - totalInvested
    const totalPnlPercent = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0

    const enriched = positions.map((p) => ({
      ...p,
      shareOfPortfolio: totalValue > 0 ? (p.currentValue / totalValue) * 100 : 0,
    }))

    return {
      totalInvested,
      totalValue,
      totalPnl,
      totalPnlPercent,
      positions: enriched,
    }
  }, [positions])
}
