import { useState, useEffect, useCallback } from 'react'

export interface UseDebouncedSearchOptions {
  value?: string
  onChange?: (value: string | undefined) => void
  delay?: number
}

export function useDebouncedSearch({
  value = '',
  onChange,
  delay = 300,
}: UseDebouncedSearchOptions = {}) {
  const [searchInput, setSearchInput] = useState(value)

  useEffect(() => {
    setSearchInput(value)
  }, [value])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== value) {
        const trimmed = searchInput.trim()
        onChange?.(trimmed ? trimmed : undefined)
      }
    }, delay)
    return () => clearTimeout(timer)
  }, [searchInput, value, onChange, delay])

  const clearSearch = useCallback(() => {
    setSearchInput('')
  }, [])

  return {
    searchInput,
    setSearchInput,
    clearSearch,
  }
}
