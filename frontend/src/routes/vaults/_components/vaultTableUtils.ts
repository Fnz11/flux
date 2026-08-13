import type { KeyboardEvent } from 'react'

export function handleSortKeyDown(event: KeyboardEvent, onSort: () => void) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault()
    onSort()
  }
}

export function formatMinRaise(min?: number) {
  if (!min || min === 0) return '$1 USD'
  return `$${min.toLocaleString()} USD`
}

export function formatDate(dateStr: string) {
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}
