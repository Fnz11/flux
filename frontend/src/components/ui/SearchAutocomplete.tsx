import { useEffect, useState } from 'react'
import { Search, CornerDownLeft, Loader2, X, TrendingUp, ShieldCheck } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from './dialog'
import { cn } from '@/lib/utils'
import type { SearchResults, SearchPair, SearchVault, SearchResultKind } from '@/types'

interface SearchAutocompleteProps {
  query: string
  setQuery: (q: string) => void
  open: boolean
  setOpen: (open: boolean) => void
  loading: boolean
  results: SearchResults | null
  onSelect: (item: SearchPair | SearchVault, kind: SearchResultKind) => void
}

export function SearchAutocomplete({ query, setQuery, open, setOpen, loading, results, onSelect }: SearchAutocompleteProps) {
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Reset index when query or results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [query, results])

  // Keyboard shortcut listener (Cmd+F, Cmd+K, Ctrl+F, Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key.toLowerCase() === 'f' || e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [setOpen])

  const items = results?.items || []

  // Handle arrow key navigation and Enter selection inside input
  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!items.length) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % items.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + items.length) % items.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[selectedIndex]
      if (item && results) {
        onSelect(item as any, results.kind)
      }
    }
  }

  return (
    <>
      {/* Search trigger button */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center rounded-full border border-border-subtle bg-bg-inset/30 px-3 py-1.5 backdrop-blur-md text-text-muted hover:border-border-medium hover:text-text-primary transition-all group cursor-pointer"
      >
        <Search className="size-3.5 text-text-muted group-hover:text-text-primary transition-colors" strokeWidth={1.5} />
        <span className="ml-2 text-[13px] text-text-muted group-hover:text-text-secondary transition-colors">
          Search asset...
        </span>
        <kbd className="ml-3 rounded bg-bg-elevated/60 px-1.5 py-0.5 text-[10px] font-medium text-text-muted border border-border-subtle/50 group-hover:border-border-subtle transition-colors">
          ⌘F
        </kbd>
      </button>

      {/* Search Command Palette Modal */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl p-0 overflow-hidden bg-bg-surface/95 backdrop-blur-2xl border-border-subtle/80 shadow-2xl rounded-2xl top-[20%] -translate-y-0 [&>button]:hidden">
          <DialogTitle className="sr-only">Search Modal</DialogTitle>

          {/* Search Input Bar */}
          <div className="flex items-center border-b border-border-subtle/40 px-4 py-3.5 bg-bg-inset/20">
            <Search className="size-4 text-text-muted shrink-0" strokeWidth={1.5} />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search assets, trading pairs, or vaults..."
              className="ml-3 h-7 w-full border-none bg-transparent text-sm text-text-primary placeholder:text-text-muted/60 focus:outline-none focus:ring-0"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="p-1 rounded-md text-text-muted hover:text-text-primary hover:bg-bg-elevated transition-colors"
                title="Clear query"
              >
                <X className="size-4" />
              </button>
            ) : (
              <kbd className="rounded bg-bg-elevated/60 px-1.5 py-0.5 text-[10px] font-medium text-text-muted border border-border-subtle/50">
                ESC
              </kbd>
            )}
          </div>

          {/* Search Results / Content Container */}
          <div className="max-h-[380px] overflow-y-auto p-2 space-y-1">
            {loading ? (
              <div className="flex items-center justify-center gap-2 px-4 py-10 text-[13px] text-text-muted">
                <Loader2 className="size-4 animate-spin text-text-secondary" strokeWidth={1.5} />
                <span>Searching ecosystem...</span>
              </div>
            ) : !query.trim() ? (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-text-tertiary">Type a symbol (e.g., SOL, WBTC) or vault name to search</p>
              </div>
            ) : !results || results.items.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-text-muted">
                No matching assets or vaults found for "{query}"
              </div>
            ) : results.kind === 'pairs' ? (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Trading Pairs
                </div>
                {(results.items as SearchPair[]).map((pair, idx) => {
                  const isSelected = idx === selectedIndex
                  return (
                    <button
                      key={pair.symbol}
                      type="button"
                      onClick={() => onSelect(pair, 'pairs')}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex w-full items-center justify-between px-3 py-2.5 rounded-lg text-left text-[13px] transition-all group cursor-pointer',
                        isSelected
                          ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-subtle/60'
                          : 'text-text-secondary hover:text-text-primary border border-transparent',
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            'flex size-7 items-center justify-center rounded-full bg-bg-inset border text-text-secondary transition-colors',
                            isSelected ? 'border-primary-gold/40 text-primary-gold' : 'border-border-subtle',
                          )}
                        >
                          <TrendingUp className="size-3.5" />
                        </div>
                        <span className="font-semibold">{pair.symbol}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-text-muted group-hover:text-text-secondary">
                        <span>Trade</span>
                        <CornerDownLeft className="size-3.5 ml-1" strokeWidth={1.5} />
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div>
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-text-muted">
                  Vaults
                </div>
                {(results.items as SearchVault[]).map((vault, idx) => {
                  const isSelected = idx === selectedIndex
                  return (
                    <button
                      key={vault.id}
                      type="button"
                      onClick={() => onSelect(vault, 'vaults')}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={cn(
                        'flex w-full items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-left transition-all group cursor-pointer',
                        isSelected
                          ? 'bg-bg-elevated text-text-primary shadow-sm border border-border-subtle/60'
                          : 'text-text-secondary hover:text-text-primary border border-transparent',
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={cn(
                            'flex size-7 items-center justify-center rounded-full bg-bg-inset border text-text-secondary shrink-0 transition-colors',
                            isSelected ? 'border-primary-gold/40 text-primary-gold' : 'border-border-subtle',
                          )}
                        >
                          <ShieldCheck className="size-3.5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="truncate text-[13px] font-semibold">{vault.displayName}</span>
                          <span className={cn('truncate text-[11px] text-text-muted')}>
                            {vault.address.length > 20 ? `${vault.address.slice(0, 8)}…${vault.address.slice(-8)}` : vault.address}
                          </span>
                        </div>
                      </div>
                      <CornerDownLeft className="size-3.5 shrink-0 text-text-muted group-hover:text-text-primary transition-colors" strokeWidth={1.5} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-between border-t border-border-subtle/30 px-4 py-2.5 bg-bg-inset/20 text-[11px] text-text-muted">
            <span className="flex items-center gap-1.5">
              <span>Navigate</span>
              <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated text-[10px] font-medium border border-border-subtle text-text-secondary">↑</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated text-[10px] font-medium border border-border-subtle text-text-secondary">↓</kbd>
            </span>
            <span className="flex items-center gap-1.5">
              <span>Select</span>
              <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated text-[10px] font-medium border border-border-subtle text-text-secondary">↵</kbd>
            </span>
            <span className="flex items-center gap-1.5">
              <span>Toggle</span>
              <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated text-[10px] font-medium border border-border-subtle text-text-secondary">⌘K</kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-bg-elevated text-[10px] font-medium border border-border-subtle text-text-secondary">⌘F</kbd>
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}