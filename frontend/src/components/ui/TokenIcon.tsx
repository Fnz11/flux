import { useState } from 'react'
import { cn } from '@/lib/utils'
import { getTokenMeta, type TokenInfo as TokenMeta } from '@/constants/tokens'

export type { TokenMeta }

export interface TokenIconProps {
  symbol?: string
  meta?: TokenMeta
  className?: string
  alt?: string
}

export function TokenIcon({ symbol, meta, className = 'size-5', alt }: TokenIconProps) {
  const tokenMeta = meta ?? (symbol ? getTokenMeta(symbol) : undefined)
  const [imgError, setImgError] = useState(false)
  const [currentIcon, setCurrentIcon] = useState(tokenMeta?.icon)

  if (tokenMeta?.icon !== currentIcon) {
    setCurrentIcon(tokenMeta?.icon)
    setImgError(false)
  }

  if (!tokenMeta) {
    return <span className={cn('rounded-full bg-border-subtle shrink-0 inline-block', className)} />
  }

  const upperSymbol = tokenMeta.symbol.toUpperCase()
  const imageAlt = alt !== undefined ? alt : tokenMeta.symbol
  const isAriaHidden = alt === '' ? true : undefined

  if (tokenMeta.icon && !imgError) {
    return (
      <img
        src={tokenMeta.icon}
        alt={imageAlt}
        aria-hidden={isAriaHidden}
        className={cn('rounded-full object-cover shrink-0 inline-block', className)}
        onError={() => setImgError(true)}
      />
    )
  }

  if (upperSymbol === 'USDT') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#26A17B" />
        <path d="M6.5 8.5h11v2.2h-4.2v5.8h-2.6v-5.8H6.5V8.5z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'PYTH') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#1C1434" />
        <path d="M12 4.5c-4.1 0-7.5 3.4-7.5 7.5s3.4 7.5 7.5 7.5 7.5-3.4 7.5-7.5-3.4-7.5-7.5-7.5zm-.2 2.7c1.8 0 3.2 1.4 3.2 3.2s-1.4 3.2-3.2 3.2h-1.4l-.8 3.5c-.1.4-.4.6-.8.6-.5 0-.8-.4-.7-.9l2.2-7.6h1.5zm-.1 4.7c.9 0 1.6-.7 1.6-1.6s-.7-1.6-1.6-1.6h-1.2l-.7 3.2h1.9z" fill="#E6DAFE" />
      </svg>
    )
  }

  if (upperSymbol === 'SOL') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#0D0E15" />
        <path d="M5.5 15.8c.2-.2.5-.3.8-.3h11.4c.5 0 .8.6.4 1l-2.2 2.2c-.2.2-.5.3-.8.3H3.7c-.5 0-.8-.6-.4-1l2.2-2.2z" fill="#00FFA3" />
        <path d="M5.5 5.2c.2-.2.5-.3.8-.3h11.4c.5 0 .8.6.4 1L15.9 8c-.2.2-.5.3-.8.3H3.7c-.5 0-.8-.6-.4-1l2.2-2.1z" fill="#DC1FFF" />
        <path d="M18.5 10.5c-.2-.2-.5-.3-.8-.3H6.3c-.5 0-.8.6-.4 1l2.2 2.2c.2.2.5.3.8.3h11.4c.5 0 .8-.6.4-1l-2.2-2.2z" fill="#00E0FF" />
      </svg>
    )
  }

  if (upperSymbol === 'USDC' || upperSymbol === 'USD') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#2775CA" />
        <text x="12" y="16" fontSize="12" fontWeight="bold" fill="#FFF" textAnchor="middle">$</text>
      </svg>
    )
  }

  if (upperSymbol === 'JUP') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#18181B" />
        <circle cx="12" cy="12" r="7" fill="none" stroke="#C7F284" strokeWidth="2" />
      </svg>
    )
  }

  if (['WBTC', 'CBBTC', 'TBTC', 'BTC'].includes(upperSymbol)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill={upperSymbol === 'CBBTC' ? '#0052FF' : '#F59E0B'} />
        <path d="M14.5 10.5c.6-.4.9-1.1.8-1.8 0-1.4-1.1-2.2-2.8-2.2V5h-1.2v1.5H10V5H8.8v1.5H7v1.4h1.1c.3 0 .4.2.4.4v7.4c0 .2-.1.4-.4.4H7V17h1.8v1.5H10V17h1.3v1.5h1.2V17c2.2 0 3.5-1.1 3.5-2.8 0-1.2-.6-2.1-1.5-2.5zm-4.3-2.6h2c.8 0 1.4.4 1.4 1.2s-.6 1.2-1.4 1.2h-2V7.9zm2.4 6.7h-2.4v-2.7h2.4c.9 0 1.6.5 1.6 1.3 0 .9-.7 1.4-1.6 1.4z" fill="#FFF" />
      </svg>
    )
  }

  if (['WETH', 'ETH'].includes(upperSymbol)) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#627EEA" />
        <path d="M12 4.5l-4.5 7.5L12 14.5l4.5-2.5L12 4.5zm0 10.8l-4.5-2.6L12 19.5l4.5-6.8-4.5 2.6z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'KMNO') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#00D092" />
        <path d="M8.5 7v10h2.5v-3.8l2.8 3.8h3.2l-3.8-5 3.5-5h-3l-2.7 4V7H8.5z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'DRIFT') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#5A67D8" />
        <path d="M8 7h4.5c2.5 0 4.5 2 4.5 5s-2 5-4.5 5H8V7zm2.5 7.5h2c1.2 0 2-.9 2-2.5s-.8-2.5-2-2.5h-2v5z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'JTO' || upperSymbol === 'JITOSOL') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#84CC16" />
        <path d="M13.5 7v6.5c0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5V12h2.2v1.5c0 .2.1.3.3.3s.3-.1.3-.3V7h2.2z" fill="#FFF" />
        <circle cx="12" cy="5" r="1" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'RENDER' || upperSymbol === 'RNDR') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#E11D48" />
        <circle cx="12" cy="12" r="5" fill="#FFF" />
        <circle cx="12" cy="12" r="2.5" fill="#E11D48" />
      </svg>
    )
  }

  if (upperSymbol === 'HNT') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#0284C7" />
        <path d="M8 7v10h2.5v-3.5h3V17H16V7h-2.5v3.5h-3V7H8z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'MOBILE') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#38BDF8" />
        <path d="M8 16V8h2.2l1.8 3.5L13.8 8H16v8h-2v-4.5l-1.5 2.7h-1L10 11.5V16H8z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'HONEY') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#FBBF24" />
        <path d="M12 5l5.2 3v6L12 17l-5.2-3V8L12 5zm0 2.2L8.5 9.2v4.6L12 15.6l3.5-1.8V9.2L12 7.2z" fill="#18181B" />
      </svg>
    )
  }

  if (upperSymbol === 'IO') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#6366F1" />
        <circle cx="15" cy="12" r="3.5" fill="none" stroke="#FFF" strokeWidth="1.8" />
        <path d="M8.5 8v8" stroke="#FFF" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    )
  }

  if (upperSymbol === 'W') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#0D0D12" />
        <circle cx="12" cy="12" r="8" fill="none" stroke="#6366F1" strokeWidth="2" />
        <path d="M8 9.5l2 4.5 2-3.5 2 3.5 2-4.5" fill="none" stroke="#FFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (upperSymbol === 'CLOUD') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#38BDF8" />
        <path d="M7.5 15.5h9c1.4 0 2.5-1.1 2.5-2.5 0-1.2-.9-2.2-2.1-2.4-.2-2-1.9-3.6-4-3.6-1.5 0-2.8.8-3.4 2-.4-.2-.9-.3-1.4-.3-1.7 0-3 1.3-3 3 0 1.5 1.1 2.8 2.4 2.8z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'MSOL' || upperSymbol === 'MNDE') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#10B981" />
        <path d="M7 16V8l5 5 5-5v8h-2.5v-4.5L12 14l-2.5-2.5V16H7z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'BSOL' || upperSymbol === 'BLZE') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#F97316" />
        <path d="M12 4c.5 2 2.5 4 2.5 6.5 0 2.5-2 4.5-4.5 4.5-1.5 0-3-.8-3.8-2 .5 3 3 5 6.3 5 3.6 0 6.5-2.9 6.5-6.5 0-3.8-3.5-6.5-7-7.5z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'EURC') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#1E40AF" />
        <text x="12" y="16.5" fontSize="13" fontWeight="bold" fill="#FFF" textAnchor="middle">€</text>
      </svg>
    )
  }

  if (upperSymbol === 'PYUSD') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#003087" />
        <path d="M8 6.5h4.8c1.8 0 3.2 1.2 3.2 2.8 0 1.7-1.4 2.9-3.2 2.9H10.5V17H8V6.5zm2.5 3.8h2.1c.6 0 1-.4 1-.9 0-.6-.4-1-1-1h-2.1v1.9z" fill="#0079C1" />
        <path d="M10 8.5h4.8c1.8 0 3.2 1.2 3.2 2.8 0 1.7-1.4 2.9-3.2 2.9H12.5V19H10V8.5zm2.5 3.8h2.1c.6 0 1-.4 1-.9 0-.6-.4-1-1-1h-2.1v1.9z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'USDY') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#002D72" />
        <path d="M8 8l4 5 4-5h-2.5l-1.5 2.2L10.5 8H8zm2.8 4.5v4.5h2.4v-4.5H10.8z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'RAY') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#131A2A" />
        <path d="M12 4l6 10.5h-4.5L12 8.5l-1.5 6H6L12 4z" fill="#5AC4BE" />
        <circle cx="12" cy="15" r="2" fill="#FF5C5C" />
      </svg>
    )
  }

  if (upperSymbol === 'ORCA') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#FFE259" />
        <path d="M7 13c1.5-3 5-5 9-4-1 2-3 4-6 4H7z" fill="#1E293B" />
        <circle cx="14" cy="10" r="1" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'SHARES') {
    return (
      <img
        src="/logo.png"
        alt={imageAlt || 'Flux Shares'}
        aria-hidden={isAriaHidden}
        className={cn('rounded-full object-contain shrink-0 inline-block bg-white/5 p-0.5', className)}
      />
    )
  }

  const badgeText = upperSymbol.length > 4 ? upperSymbol.slice(0, 3) : upperSymbol
  return (
    <span
      className={cn(
        'rounded-full shrink-0 inline-flex items-center justify-center font-bold text-[9px] uppercase tracking-tighter text-white select-none',
        className,
      )}
      style={{ backgroundColor: tokenMeta.color || '#4B5563' }}
      title={tokenMeta.name || tokenMeta.symbol}
      aria-label={imageAlt}
    >
      {badgeText}
    </span>
  )
}
