import { useEffect, useRef, useState } from 'react'
import { usePortfolioPnl } from '@/hooks/usePortfolioPnl'

export function PnLTicker() {
  const { totalPnl } = usePortfolioPnl()
  const [flash, setFlash] = useState<'green' | 'red' | null>(null)
  const prevRef = useRef(totalPnl)

  useEffect(() => {
    if (totalPnl === prevRef.current) return
    const dir = totalPnl > prevRef.current ? 'green' : 'red'
    prevRef.current = totalPnl
    setFlash(dir)
    const timer = setTimeout(() => setFlash(null), 600)
    return () => clearTimeout(timer)
  }, [totalPnl])

  const prefersReduced = usePrefersReducedMotion()

  const flashBg = !prefersReduced
    ? flash === 'green'
      ? 'bg-status-success/20'
      : flash === 'red'
        ? 'bg-status-error/20'
        : ''
    : ''

  return (
    <div className={`rounded-2xl border border-border-subtle bg-bg-elevated p-5 transition-colors duration-300 ${flashBg}`}>
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">Real-Time PnL</p>
      <p className={`mt-1.5 text-3xl font-semibold tracking-tight ${totalPnl >= 0 ? 'text-status-success' : 'text-status-error'}`}>
        {totalPnl >= 0 ? '+' : ''}${totalPnl.toLocaleString()}
      </p>
    </div>
  )
}

function usePrefersReducedMotion() {
  const [prefers, setPrefers] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefers(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefers(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return prefers
}
