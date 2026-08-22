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
        <path d="M7.5 8.5h9v2h-3.2v5h-2.6v-5H7.5v-2z" fill="#FFF" />
      </svg>
    )
  }

  if (upperSymbol === 'PYTH') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#622B9B" />
        <path d="M12 6l4.5 11h-9L12 6z" fill="#E6D7FF" />
      </svg>
    )
  }

  if (upperSymbol === 'SOL') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" className={cn('rounded-full shrink-0 inline-block', className)}>
        <circle cx="12" cy="12" r="12" fill="#9945FF" />
        <path d="M7 15.5h10l-2 2H7l2-2zm0-7h10l-2 2H7l2-2zm2-3.5h10l-2 2H9l2-2z" fill="#FFF" />
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

  return (
    <img
      src="/logo.png"
      alt={imageAlt || 'Token'}
      aria-hidden={isAriaHidden}
      className={cn('rounded-full object-contain shrink-0 inline-block bg-white/5 p-0.5', className)}
    />
  )
}
