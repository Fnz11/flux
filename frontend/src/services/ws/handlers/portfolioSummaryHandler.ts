import type { WSEventHandler } from './types'
import type { PortfolioSummaryResponse } from '@/services/apis/rest-api/portfolioSummary.service'

export interface PortfolioSummaryPayload {
  wallet_address?: string
  wallet?: string
  total_invested?: number | string
  current_value?: number | string
  total_pnl?: number | string
  pnl_delta?: number | string
  pnl_percent?: number | string
}

export const portfolioSummaryHandler: WSEventHandler<PortfolioSummaryPayload> = {
  types: ['portfolio_summary_update'],

  handleBatch: (messages, { queryClient }) => {
    if (messages.length === 0) return

    let totalDelta = 0
    let latestSummary: Partial<PortfolioSummaryResponse> | undefined

    for (const msg of messages) {
      const data = msg.data
      if (!data) continue

      if (data.pnl_delta !== undefined) {
        totalDelta += Number(data.pnl_delta)
      }

      if (data.total_invested !== undefined || data.current_value !== undefined || data.total_pnl !== undefined) {
        latestSummary = {
          total_invested: data.total_invested !== undefined ? Number(data.total_invested) : undefined,
          current_value: data.current_value !== undefined ? Number(data.current_value) : undefined,
          total_pnl: data.total_pnl !== undefined ? Number(data.total_pnl) : undefined,
          pnl_percent: data.pnl_percent !== undefined ? Number(data.pnl_percent) : undefined,
        }
      }
    }

    if (totalDelta === 0 && !latestSummary) return

    queryClient.setQueriesData<PortfolioSummaryResponse>(
      { queryKey: ['portfolio-summary'] },
      (oldSummary) => {
        if (!oldSummary) return oldSummary

        const nextInvested = latestSummary?.total_invested !== undefined ? latestSummary.total_invested : oldSummary.total_invested
        const nextPnl = latestSummary?.total_pnl !== undefined ? latestSummary.total_pnl : (oldSummary.total_pnl + totalDelta)
        const nextCurrentValue = latestSummary?.current_value !== undefined ? latestSummary.current_value : Math.max(0, nextInvested + nextPnl)
        const nextPnlPercent = nextInvested > 0 ? (nextPnl / nextInvested) * 100 : 0

        return {
          ...oldSummary,
          total_invested: nextInvested,
          current_value: nextCurrentValue,
          total_pnl: nextPnl,
          pnl_percent: nextPnlPercent,
        }
      }
    )
  },
}
