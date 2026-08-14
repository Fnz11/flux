import type { KeyboardEvent } from 'react'
export { formatDate, formatMinRaise, formatCurrency, formatNumber, formatPercent, formatDateTime } from '@/lib/format'

export function handleSortKeyDown(event: KeyboardEvent, onSort: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onSort()
  }
}


