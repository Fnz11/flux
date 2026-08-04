import { useState, useMemo } from 'react'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'

type SortKey = 'value' | 'pnl' | 'name'

export function usePortfolioView() {
  const { totalPnl, totalInvested, totalValue, positions: enriched } = usePortfolioPnl()

  const [sortBy, setSortBy] = useState<SortKey>('value')
  const [sortAsc, setSortAsc] = useState(false)

  const toggleSort = (key: SortKey) => {
    if (sortBy === key) {
      setSortAsc((prev) => !prev)
    } else {
      setSortBy(key)
      setSortAsc(false)
    }
  }

  const sortedPositions = useMemo(() => {
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

  const performanceData = [
    { date: 'Jan', value: totalInvested },
    { date: 'Feb', value: totalInvested + totalPnl * 0.3 },
    { date: 'Mar', value: totalInvested + totalPnl * 0.5 },
    { date: 'Apr', value: totalInvested + totalPnl * 0.7 },
    { date: 'May', value: totalInvested + totalPnl * 0.9 },
    { date: 'Jun', value: totalValue },
  ]

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
