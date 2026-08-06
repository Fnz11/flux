import { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

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
  SOL: { symbol: 'SOL', name: 'Solana', color: '#9945FF' },
  USDC: { symbol: 'USDC', name: 'USD Coin', color: '#2775CA' },
  USDT: { symbol: 'USDT', name: 'Tether', color: '#26A17B' },
  ETH: { symbol: 'ETH', name: 'Ethereum', color: '#627EEA' },
  BTC: { symbol: 'BTC', name: 'Bitcoin', color: '#F7931A' },
  BONK: { symbol: 'BONK', name: 'Bonk', color: '#FF7543' },
  JUP: { symbol: 'JUP', name: 'Jupiter', color: '#F2804F' },
  PYTH: { symbol: 'PYTH', name: 'Pyth Network', color: '#E6D7FF' },
  RAY: { symbol: 'RAY', name: 'Raydium', color: '#4B8BFF' },
  SRM: { symbol: 'SRM', name: 'Serum', color: '#00D1FF' },
}

function getTokenMeta(symbol: string): TokenMeta {
  return tokenMetaMap[symbol] ?? { symbol, name: symbol, color: '#737373' }
}

export function TokenSelector({ tokens, selected, onSelect, label }: TokenSelectorProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const filtered = useMemo(
    () =>
      tokens.filter(
        (t) =>
          t.toLowerCase().includes(query.toLowerCase()) ||
          getTokenMeta(t).name.toLowerCase().includes(query.toLowerCase()),
      ),
    [tokens, query],
  )

  const selectedMeta = getTokenMeta(selected)

  const handleClose = () => {
    setOpen(false)
    setQuery('')
  }

  return (
    <div className="relative">
      {label && <Label className="mb-1">{label}</Label>}

      <Button
        variant="outline"
        onClick={() => setOpen(!open)}
        className="w-full justify-between gap-2"
      >
        <span className="flex items-center gap-2">
          <span
            className="size-5 rounded-full"
            style={{ backgroundColor: selectedMeta.color }}
          />
          <span className="font-medium">{selectedMeta.symbol}</span>
        </span>
        <ChevronDown className={cn('size-4 text-text-muted transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close token selector"
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={handleClose}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { e.stopPropagation(); handleClose() }
            }}
          />
          <div className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-border-medium bg-bg-elevated shadow-xl">
            <div className="flex items-center justify-between border-b border-border-subtle p-2">
              <Label htmlFor="token-search" className="text-xs text-text-tertiary">Search tokens</Label>
              <Button variant="ghost" size="icon" onClick={handleClose}>
                <X className="size-4" />
              </Button>
            </div>
            <div className="p-2">
              <Input
                id="token-search"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search tokens..."
              />
            </div>
            <div className="max-h-48 overflow-y-auto p-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-text-muted">No tokens found</p>
              ) : (
                filtered.map((token) => {
                  const meta = getTokenMeta(token)
                  const isSelected = token === selected
                  return (
                    <Button
                      key={token}
                      variant="ghost"
                      className={cn('w-full justify-start gap-2', isSelected && 'bg-primary-coral/10 text-primary-coral')}
                      onClick={() => {
                        onSelect(token)
                        handleClose()
                      }}
                    >
                      <span
                        className="size-5 rounded-full"
                        style={{ backgroundColor: meta.color }}
                      />
                      <span className="font-medium">{meta.symbol}</span>
                      <span className="text-xs text-text-muted">{meta.name}</span>
                      {isSelected && <Check className="ml-auto size-4" />}
                    </Button>
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
