import { cn } from '@/lib/utils'

interface StatCardProps {
  title: string
  value: string
  accent?: 'coral' | 'gold' | 'green' | 'red'
  change?: { value: number; isPositive: boolean }
}

function StatCard({ title, value, accent, change }: StatCardProps) {
  const borderColor = accent === 'coral' ? 'border-l-primary-coral' : accent === 'gold' ? 'border-l-primary-gold' : 'border-l-transparent'

  return (
    <div className={cn('rounded-xl border border-border-subtle bg-bg-elevated p-5 border-l-4', borderColor)}>
      <p className="text-xs font-medium uppercase tracking-wider text-text-muted">{title}</p>
      <p className="mt-1.5 text-2xl font-semibold tracking-tight text-text-primary">{value}</p>
      {change && (
        <p className={cn('mt-0.5 text-xs', change.isPositive ? 'text-status-success' : 'text-status-error')}>
          {change.isPositive ? '↑' : '↓'} {Math.abs(change.value).toFixed(2)}
        </p>
      )}
    </div>
  )
}

export { StatCard }
