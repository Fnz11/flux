import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { search } from '@/services/apis/rest-api/search.service'
import { useDebounce } from '@/hooks/useDebounce'
import type { SearchResults, SearchPair, SearchVault, SearchResultKind } from '@/types'
import { useAppStore } from '@/stores/app-store'
import { SearchAutocomplete } from './SearchAutocomplete'
import { NotificationsPopover } from './NotificationsPopover'
import { WalletConnectButton } from './WalletConnectButton'

export function NavHeader() {
  const navigate = useNavigate()
  const isManager = useAppStore((s) => s.isManager)

  const [query, setQuery] = useState('')
  const [notifOpen, setNotifOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<SearchResults | null>(null)

  const debouncedQuery = useDebounce(query, 300)

  useEffect(() => {
    const q = debouncedQuery.trim()
    if (q.length < 1) {
      setResults(null)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    search({ q, role: isManager ? 'manager' : 'investor', limit: 8 })
      .then((res) => {
        if (!cancelled) setResults(res)
      })
      .catch(() => {
        if (!cancelled) setResults(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, isManager])

  const handleSelect = useCallback(
    (item: SearchPair | SearchVault, kind: SearchResultKind) => {
      if (kind === 'pairs') {
        navigate({ to: '/trade' })
      } else {
        navigate({ to: '/vaults/$id', params: { id: (item as SearchVault).id } })
      }
      setQuery('')
      setResults(null)
      setSearchOpen(false)
    },
    [navigate],
  )

  const handleSearchSetOpen = useCallback((o: boolean) => setSearchOpen(o), [])
  const handleNotifToggle = useCallback(() => setNotifOpen((o) => !o), [])

  return (
    <>
      <div className="hidden sm:flex items-center">
        <SearchAutocomplete
          query={query}
          setQuery={setQuery}
          open={searchOpen}
          setOpen={handleSearchSetOpen}
          loading={loading}
          results={results}
          onSelect={handleSelect}
        />
      </div>

      <div className="hidden sm:flex items-center gap-0.5 text-text-muted ml-2">
        <NotificationsPopover open={notifOpen} onToggle={handleNotifToggle} />
        <div className="hidden sm:block ml-1.5 border-l border-border-subtle pl-2">
          <WalletConnectButton />
        </div>
      </div>
    </>
  )
}