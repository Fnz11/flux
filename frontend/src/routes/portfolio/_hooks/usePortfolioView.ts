import { useState, useMemo } from 'react'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { usePortfolioHistoryQuery } from '@/services/hooks/useQuery/usePortfolioHistoryQuery'
import type { PortfolioHistoryRange } from '@/services/apis/rest-api/portfolio_history.service'
import type { PortfolioPosition } from '@/types'

type SortKey = 'value' | 'pnl' | 'name' | 'created_at'

export function usePortfolioView(
  walletAddressOrPositions?: string | PortfolioPosition[],
  range: PortfolioHistoryRange = '30d',
) {
  const isString = typeof walletAddressOrPositions === 'string'
  const walletAddress = isString ? walletAddressOrPositions : ''
  const { positions: enriched } = usePortfolioPnl(walletAddressOrPositions)

  const { data: historyPoints = [] } = usePortfolioHistoryQuery(walletAddress, range)

  const [sortBy, setSortBy] = useState<SortKey | undefined>('created_at')
  const [sortAsc, setSortAsc] = useState(false)

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      if (!sortAsc) {
        setSortAsc(true)
      } else {
        setSortBy(undefined)
        setSortAsc(false)
      }
    } else {
      setSortBy(key)
      setSortAsc(false)
    }
  }

  const sortedPositions = useMemo(() => {
    const activeSort = sortBy ?? 'created_at'
    const copy = [...enriched]
    copy.sort((a, b) => {
      let cmp = 0
      if (activeSort === 'value') cmp = a.currentValue - b.currentValue
      else if (activeSort === 'pnl') cmp = a.pnl - b.pnl
      else if (activeSort === 'name') cmp = a.vaultName.localeCompare(b.vaultName)
      else if (activeSort === 'created_at') {
        const timeA = new Date(a.investedAt || a.createdAt || 0).getTime()
        const timeB = new Date(b.investedAt || b.createdAt || 0).getTime()
        const valA = isNaN(timeA) ? 0 : timeA
        const valB = isNaN(timeB) ? 0 : timeB
        cmp = valA - valB
      }
      return sortAsc ? cmp : -cmp
    })
    return copy
  }, [enriched, sortBy, sortAsc])

  const performanceData = useMemo(() => {
    if (walletAddress && historyPoints.length > 1) {
      return historyPoints.map((p) => ({
        date: new Date(p.date).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }),
        value: p.value,
      }))
    }

    if (enriched.length > 1) {
      const byInvested = [...enriched].sort((a, b) => a.totalInvested - b.totalInvested)
      const first = byInvested[0]
      const last = byInvested[byInvested.length - 1]
      return [
        { date: 'Start', value: first.totalInvested },
        { date: 'Now', value: last.currentValue },
      ]
    }

    return []
  }, [walletAddress, historyPoints, enriched])

  const allocationData = useMemo(() => {
    return [...enriched]
      .map((p) => ({
        name: p.vaultName,
        value: p.currentValue,
        color: '',
      }))
      .sort((a, b) => b.value - a.value)
  }, [enriched])

  return {
    sortedPositions,
    sortBy,
    setSortBy,
    sortAsc,
    toggleSort,
    performanceData,
    allocationData,
  }
}