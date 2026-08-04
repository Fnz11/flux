import { useMemo } from 'react'
import { usePortfolioStore } from '@/stores'

export function usePortfolioPnl() {
  const positions = usePortfolioStore((s) => s.positions)

  return useMemo(() => {
    if (!positions.length) {
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
