import type { WSEventHandler } from './types'
import type { PortfolioPosition } from '@/types'

export interface PortfolioPayload {
  wallet_address?: string
  wallet?: string
  pnl?: number | string
  pnl_delta?: number | string
}

export const portfolioHandler: WSEventHandler<PortfolioPayload> = {
  types: ['portfolio_update'],

  handleBatch: (messages, { queryClient }) => {
    if (messages.length === 0) return

    let totalDelta = 0
    let absolutePnl: number | undefined

    for (const msg of messages) {
      const data = msg.data
      if (!data) continue

      if (data.pnl_delta !== undefined) {
        totalDelta += Number(data.pnl_delta)
      } else if (data.pnl !== undefined) {
        absolutePnl = Number(data.pnl)
      }
    }

    if (totalDelta === 0 && absolutePnl === undefined) return

    queryClient.setQueriesData<PortfolioPosition[]>(
      { queryKey: ['portfolio'] },
      (oldPositions) => {
        if (!oldPositions || oldPositions.length === 0) return oldPositions

        return oldPositions.map((pos) => {
          const delta = totalDelta !== 0 ? totalDelta : (absolutePnl! - (pos.pnl || 0))
          const updatedPnl = (pos.pnl || 0) + delta
          const updatedCurrentValue = Math.max(0, (pos.totalInvested || 0) + updatedPnl)
          const updatedPnlPercent = pos.totalInvested > 0 ? (updatedPnl / pos.totalInvested) * 100 : 0

          return {
            ...pos,
            currentValue: updatedCurrentValue,
            pnl: updatedPnl,
            pnlPercent: updatedPnlPercent,
          }
        })
      }
    )
  },
}
