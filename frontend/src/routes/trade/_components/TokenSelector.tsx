import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, ChevronDown, Search, SearchX, X } from 'lucide-react'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils'
import { TOKENS } from '@/constants/tokens'

interface TokenMeta {
  symbol: string
  name: string
  color: string
  icon?: string
}

interface TokenSelectorProps {
  tokens: string[]
  selected: string
  onSelect: (token: string) => void
  label?: string
}

const tokenMetaMap: Record<string, TokenMeta> = {
  SOL: {
    symbol: 'SOL',
    name: 'Solana',
    color: '#9945FF',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png',
  },
  USDC: {
    symbol: 'USDC',
    name: 'USD Coin',
    color: '#2775CA',
    icon: 'https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/logo.png',
  },
  USDT: {
    symbol: 'USDT',
    name: 'Tether',
    color: '#26A17B',
    icon: 'https://coin-images.coingecko.com/coins/images/325/large/Tether.png',
  },
  JUP: {
    symbol: 'JUP',
    name: 'Jupiter',
    color: '#F2804F',
    icon: 'https://static.jup.ag/jup/icon.png',
  },
  PYTH: {
    symbol: 'PYTH',
    name: 'Pyth Network',
    color: '#E6D7FF',
    icon: 'https://coin-images.coingecko.com/coins/images/31924/large/pyth.png',
  },
}

function getTokenMeta(symbol: string): TokenMeta {
  const found = TOKENS.find((t) => t.symbol === symbol)
  if (found) return found
  return tokenMetaMap[symbol] ?? { symbol, name: symbol, color: '#737373' }
}

function TokenIcon({ meta, className = 'size-5' }: { meta: TokenMeta; className?: string }) {
  const [imgError, setImgError] = useState(false)

  if (meta.icon && !imgError) {
    return (
      <img
        src={meta.icon}
        alt={meta.symbol}
        className={cn('rounded-full object-cover shrink-0', className)}
        onError={() => setImgError(true)}
      />
    )
  }

  // High quality SVG icon fallbacks
  if (meta.symbol === 'USDT') {
    return (
      <svg viewBox="0 0 24 24" className={cn('rounded-full shrink-0', className)}>
        <circle cx="12" cy="12" r="12" fill="#26A17B" />
        <path d="M7.5 8.5h9v2h-3.2v5h-2.6v-5H7.5v-2z" fill="#FFF" />
      </svg>
    )
  }

  if (meta.symbol === 'PYTH') {
    return (
      <svg viewBox="0 0 24 24" className={cn('rounded-full shrink-0', className)}>
        <circle cx="12" cy="12" r="12" fill="#622B9B" />
        <path d="M12 6l4.5 11h-9L12 6z" fill="#E6D7FF" />
      </svg>
    )
  }

  if (meta.symbol === 'SOL') {
    return (
      <svg viewBox="0 0 24 24" className={cn('rounded-full shrink-0', className)}>
        <circle cx="12" cy="12" r="12" fill="#9945FF" />
        <path d="M7 15.5h10l-2 2H7l2-2zm0-7h10l-2 2H7l2-2zm2-3.5h10l-2 2H9l2-2z" fill="#FFF" />
      </svg>
    )
  }

  if (meta.symbol === 'USDC') {
    return (
      <svg viewBox="0 0 24 24" className={cn('rounded-full shrink-0', className)}>
        <circle cx="12" cy="12" r="12" fill="#2775CA" />
        <text x="12" y="16" fontSize="12" fontWeight="bold" fill="#FFF" textAnchor="middle">$</text>
      </svg>
    )
  }

  if (meta.symbol === 'JUP') {
    return (
      <svg viewBox="0 0 24 24" className={cn('rounded-full shrink-0', className)}>
        <circle cx="12" cy="12" r="12" fill="#18181B" />
        <circle cx="12" cy="12" r="7" fill="none" stroke="#C7F284" strokeWidth="2" />
      </svg>
    )
  }

  return (
    <span
      className={cn('rounded-full shrink-0', className)}
      style={{ backgroundColor: meta.color }}
    />
  )
}

export function TokenSelector({ tokens, selected, onSelect, label }: TokenSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const availableTokens = useMemo(() => {
    // Exclude BONK and ensure SOL, USDC, USDT, JUP, PYTH
    const filteredList = tokens.filter((t) => t !== 'BONK')
    return filteredList.length > 0 ? filteredList : ['SOL', 'USDC', 'USDT', 'JUP', 'PYTH']
  }, [tokens])

  const filtered = useMemo(
    () =>
      availableTokens.filter(
        (t) =>
          t.toLowerCase().includes(query.toLowerCase()) ||
          getTokenMeta(t).name.toLowerCase().includes(query.toLowerCase()),
      ),
    [availableTokens, query],
  )

  const selectedMeta = getTokenMeta(selected)

  const handleClose = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative">
      {label && <Label className="mb-1 text-xs text-text-tertiary">{label}</Label>}

      <Button
        variant="outline"
        type="button"
        onClick={() => setOpen(!open)}
        className="h-10 px-3 min-w-[120px] justify-between gap-2.5 rounded-xl border-border-subtle bg-bg-elevated/80 hover:bg-bg-elevated hover:border-border-medium transition-all shadow-xs cursor-pointer"
      >
        <span className="flex items-center gap-2">
          <TokenIcon meta={selectedMeta} className="size-5" />
          <span className="font-semibold text-sm text-text-primary">{selectedMeta.symbol}</span>
        </span>
        <ChevronDown className={cn('size-4 text-text-muted transition-transform duration-200', open && 'rotate-180')} />
      </Button>

      {open && (
        <>
          {/* Backdrop overlay */}
          <button
            type="button"
            aria-label="Close token selector"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); handleClose() }
            }}
          />

          {/* Combobox Popover */}
          <div className="absolute left-0 sm:left-auto right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-2xl border border-border-medium bg-bg-elevated/95 p-3 shadow-2xl backdrop-blur-xl animate-in fade-in-50 zoom-in-95">
            {/* Search Input Header */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-muted" />
              <Input
                id="token-search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tokens..."
                className="h-8 pl-8 pr-7 text-xs rounded-xl bg-bg-inset border-border-subtle focus:border-primary-coral focus:ring-0"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary cursor-pointer"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Token Items List */}
            <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
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
                  return (
                    <button
                      key={token}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors cursor-pointer',
                        isSelected
                          ? 'bg-primary-coral/15 text-primary-coral font-semibold'
                          : 'hover:bg-bg-inset/80 text-text-primary',
                      )}
                      onClick={() => {
                        onSelect(token)
                        handleClose()
                      }}
                    >
                      <TokenIcon meta={meta} className="size-6" />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-semibold leading-tight">{meta.symbol}</span>
                        <span className="text-[10px] text-text-tertiary leading-tight truncate">{meta.name}</span>
                      </div>
                      {isSelected && <Check className="size-4 shrink-0 text-primary-coral" />}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
