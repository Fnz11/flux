import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, ChevronDown, Search, SearchX, X } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { ResponsiveDrawer, useIsMobile } from '@/components/ui/ResponsiveDrawer'
import { cn } from '@/lib/utils'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { getTokenMeta } from '@/constants/tokens'

interface TokenSelectorProps {
  tokens: string[]
  selected: string
  onSelect: (token: string) => void
  label?: string
  disabledTokens?: string[]
  'aria-label'?: string
}

export function TokenSelector({ tokens, selected, onSelect, label, disabledTokens, 'aria-label': ariaLabel }: TokenSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const isMobile = useIsMobile()

  const availableTokens = useMemo(() => {
    return tokens && tokens.length > 0 ? tokens : ['SOL', 'USDC', 'USDT', 'JUP', 'PYTH']
  }, [tokens])

  const filtered = useMemo(
    () =>
      availableTokens.filter(
        (t) =>
          t.toLowerCase().includes(query.toLowerCase()) ||
          (getTokenMeta(t).name || '').toLowerCase().includes(query.toLowerCase()),
      ),
    [availableTokens, query],
  )

  const selectedMeta = getTokenMeta(selected)

  const handleClose = () => {
    setOpen(false)
    setQuery('')
  }

  const renderTokenList = () => (
    <div className="space-y-1">
      {/* Search Input Header */}
      <div className="relative mb-2">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-text-muted" />
        <Input
          id="token-search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tokens..."
          className="h-9 pl-9 pr-8 text-xs rounded-xl bg-bg-inset border-border-subtle focus:border-primary-coral focus:ring-0"
        />
        {query && (
          <button
            type="button"
            title="Clear search"
            aria-label="Clear search"
            onClick={() => setQuery('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer p-1"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Token Items List */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5 max-sm:max-h-none sm:max-h-64" role="listbox">
        {filtered.length === 0 ? (
          <EmptyState
            size="xs"
            icon={<SearchX className="size-full" />}
            title="No tokens found"
            description="Try a different search"
          />
        ) : (
          filtered.map((token) => {
            const meta = getTokenMeta(token)
            const isSelected = token === selected
            const isDisabled = disabledTokens?.includes(token)
            return (
              <button
                key={token}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={isDisabled}
                className={cn(
                  'flex w-full items-center gap-3.5 rounded-xl px-3 py-2.5 text-left transition-colors',
                  isDisabled
                    ? 'opacity-40 cursor-not-allowed'
                    : isSelected
                    ? 'bg-primary-coral/15 text-primary-coral font-semibold border border-primary-coral/30 cursor-pointer'
                    : 'hover:bg-bg-inset/80 text-text-primary border border-transparent cursor-pointer',
                )}
                onClick={() => {
                  if (isDisabled) return
                  onSelect(token)
                  handleClose()
                }}
              >
                <TokenIcon meta={meta} className="size-7" />
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-xs font-bold leading-tight">{meta.symbol}</span>
                  <span className="text-[11px] text-text-tertiary leading-tight truncate">{meta.name}</span>
                </div>
                {isSelected && <Check className="size-4 shrink-0 text-primary-coral" />}
              </button>
            )
          })
        )}
      </div>
    </div>
  )

  return (
    <div className={cn('relative', open && 'z-50')}>
      {label && <Label className="mb-1 text-xs text-text-tertiary">{label}</Label>}

      <Button
        variant="outline"
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen(!open)}
        className="h-10 px-3 min-w-[120px] justify-between gap-2.5 rounded-xl border-border-subtle bg-bg-elevated/80 hover:bg-bg-elevated hover:border-border-medium transition-colors shadow-xs cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <TokenIcon meta={selectedMeta} className="size-5" />
          <span className="font-semibold text-sm text-text-primary">{selectedMeta.symbol}</span>
        </span>
        <ChevronDown className={cn('size-4 text-text-muted transition-transform duration-200', open && 'rotate-180')} />
      </Button>

      {/* Mobile Drawer */}
      {isMobile ? (
        <ResponsiveDrawer
          open={open}
          onOpenChange={setOpen}
          title="Select Token"
          description="Choose a token for swap execution"
        >
          {renderTokenList()}
        </ResponsiveDrawer>
      ) : (
        /* Desktop Popover */
        open && (
          <>
            <button
              type="button"
              aria-label="Close token selector"
              tabIndex={-1}
              className="fixed inset-0 z-40 cursor-default"
              onClick={handleClose}
            />
            <div className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-white/15 bg-bg-elevated/95 p-3 shadow-[0_16px_50px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-3xl animate-in fade-in-50 zoom-in-95">
              {renderTokenList()}
            </div>
          </>
        )
      )}
    </div>
  )
}
