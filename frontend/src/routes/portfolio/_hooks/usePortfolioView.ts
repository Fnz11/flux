import { useState, useMemo } from 'react'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'
import { usePortfolioHistoryQuery } from '@/services/hooks/useQuery/usePortfolioHistoryQuery'
import type { PortfolioPosition } from '@/types'

type SortKey = 'value' | 'pnl' | 'name'

export function usePortfolioView(walletAddressOrPositions?: string | PortfolioPosition[]) {
  const isString = typeof walletAddressOrPositions === 'string'
  const walletAddress = isString ? walletAddressOrPositions : ''
  const { positions: enriched } = usePortfolioPnl(walletAddressOrPositions)

  const { data: historyPoints = [] } = usePortfolioHistoryQuery(walletAddress)

  const [sortBy, setSortBy] = useState<SortKey | undefined>(undefined)
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
    if (!sortBy) return enriched
    const copy = [...enriched]
    copy.sort((a, b) => {
      let cmp = 0
      if (sortBy === 'value') cmp = a.currentValue - b.currentValue
      else if (sortBy === 'pnl') cmp = a.pnl - b.pnl
      else if (sortBy === 'name') cmp = a.vaultName.localeCompare(b.vaultName)
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

  const allocationData = enriched.map((p) => ({
    name: p.vaultName,
    value: p.currentValue,
    color: '',
  }))

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