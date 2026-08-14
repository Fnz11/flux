import { useConfigStore } from '@/stores/config-store'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { cn } from '@/lib/utils'

interface TokenAmountProps {
  amount: number | string
  symbol?: string
  showUsd?: boolean
  usdValue?: number
  showIcon?: boolean
  decimals?: number
  compact?: boolean
  className?: string
}

function formatAmount(value: number, decimals: number, compact?: boolean): string {
  const abs = Math.abs(value)
  if (compact && abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`
  if (compact && abs >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`
  if (compact && abs >= 1_000) return `${(value / 1_000).toFixed(2)}K`
  if (abs < 0.000001 && abs > 0) return '< 0.000001'
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: decimals,
  })
}

export function TokenAmount({
  amount,
  symbol,
  showUsd,
  usdValue,
  showIcon,
  decimals = 6,
  compact,
  className,
}: TokenAmountProps) {
  const config = useConfigStore((s) => s.config)
  const threshold = config?.dustThreshold ?? 0.001

  const numAmount = typeof amount === 'string' ? Number.parseFloat(amount) : amount

  if (Number.isNaN(numAmount)) {
    return <span className={cn('font-mono text-text-muted', className)}>—</span>
  }

  if (numAmount > 0 && numAmount < threshold) {
    return (
      <span className={cn('font-mono text-text-muted inline-flex items-center', className)}>
        {showIcon && symbol && (
          <TokenIcon symbol={symbol} className="mr-1 inline-block size-3.5 align-middle" />
        )}
        &lt; Dust
        {symbol && (
          <span className="ml-1 text-xs text-text-tertiary">{symbol}</span>
        )}
      </span>
    )
  }

  return (
    <span className={cn('font-mono text-text-primary inline-flex items-center', className)}>
      {showIcon && symbol && (
        <TokenIcon symbol={symbol} className="mr-1 inline-block size-3.5 align-middle" />
      )}
      {formatAmount(numAmount, decimals, compact)}
      {symbol && <span className="ml-1 text-text-muted">{symbol}</span>}
      {showUsd && usdValue !== undefined && (
        <span className="ml-1 text-xs text-text-tertiary">
          (${formatAmount(usdValue, 2)})
        </span>
      )}
    </span>
  )
}
