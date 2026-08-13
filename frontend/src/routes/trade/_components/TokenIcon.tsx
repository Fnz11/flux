import { useState } from 'react'
import { cn } from '@/lib/utils'

export interface TokenMeta {
  symbol: string
  name: string
  color: string
  icon?: string
  mint?: string
  decimals?: number
}

export function TokenIcon({ meta, className = 'size-5' }: { meta: TokenMeta; className?: string }) {
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
