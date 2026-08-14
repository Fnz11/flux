import { useState, useCallback } from 'react'

export type SortOrder = 'asc' | 'desc'

export interface UseTableSortOptions<T extends string = string> {
  sortBy?: T
  sortOrder?: SortOrder
  defaultOrder?: SortOrder
  allowClear?: boolean
  onSortChange?: (sortBy?: T, sortOrder?: SortOrder) => void
}

export function useTableSort<T extends string = string>(options: UseTableSortOptions<T> = {}) {
  const {
    sortBy: controlledSortBy,
    sortOrder: controlledSortOrder,
    defaultOrder = 'desc',
    allowClear = true,
    onSortChange,
  } = options

  const [internalSortBy, setInternalSortBy] = useState<T | undefined>(controlledSortBy)
  const [internalSortOrder, setInternalSortOrder] = useState<SortOrder | undefined>(controlledSortOrder)

  const isControlled = controlledSortBy !== undefined || onSortChange !== undefined
  const sortBy = isControlled ? controlledSortBy : internalSortBy
  const sortOrder = isControlled ? controlledSortOrder : internalSortOrder

  const handleSort = useCallback(
    (column: T) => {
      let nextSortBy: T | undefined = column
      let nextSortOrder: SortOrder | undefined = defaultOrder

      if (sortBy === column) {
        if (sortOrder === 'desc') {
          nextSortOrder = 'asc'
        } else if (sortOrder === 'asc') {
          if (allowClear) {
            nextSortBy = undefined
            nextSortOrder = undefined
          } else {
            nextSortOrder = 'desc'
          }
        } else {
          nextSortOrder = 'desc'
        }
      }

      if (onSortChange) {
        onSortChange(nextSortBy, nextSortOrder)
      } else {
        setInternalSortBy(nextSortBy)
        setInternalSortOrder(nextSortOrder)
      }
    },
    [sortBy, sortOrder, defaultOrder, allowClear, onSortChange],
  )

  return {
    sortBy,
    sortOrder,
    handleSort,
    setSortBy: setInternalSortBy,
    setSortOrder: setInternalSortOrder,
  }
}
