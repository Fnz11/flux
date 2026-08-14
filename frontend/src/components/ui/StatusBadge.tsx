import { cn } from '@/lib/utils'

export type BadgeStatus = 'Active' | 'Fundraising' | 'Dormant' | 'Pending' | 'Failed' | 'success' | 'failed' | string

interface StatusBadgeProps {
  status: BadgeStatus
  label?: string
  className?: string
}

const colorMap: Record<string, { bg: string; dot: string }> = {
  Active: { bg: 'bg-primary-coral/15 text-primary-coral border-primary-coral/25', dot: 'bg-primary-coral' },
  Fundraising: { bg: 'bg-primary-gold/15 text-primary-gold border-primary-gold/25', dot: 'bg-primary-gold' },
  Dormant: { bg: 'bg-neutral-500/15 text-neutral-400 border-neutral-500/25', dot: 'bg-neutral-400' },
  Pending: { bg: 'bg-status-warn/15 text-status-warn border-status-warn/25', dot: 'bg-status-warn' },
  Failed: { bg: 'bg-status-error/15 text-status-error border-status-error/25', dot: 'bg-status-error' },
  success: { bg: 'bg-status-success/15 text-status-success border-status-success/25', dot: 'bg-status-success' },
  failed: { bg: 'bg-status-error/15 text-status-error border-status-error/25', dot: 'bg-status-error' },
}

export function StatusBadge({ status, label, className }: StatusBadgeProps) {
  const normalizedKey = Object.keys(colorMap).find(
    (k) => k.toLowerCase() === (status || '').toLowerCase()
  ) ?? 'Active'
  const colors = colorMap[normalizedKey]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold font-sans border',
        colors.bg,
        className,
      )}
    >
      <span className={cn('size-1.5 rounded-full shrink-0', colors.dot)} />
      {label ?? (status ? status.charAt(0).toUpperCase() + status.slice(1) : '')}
    </span>
  )
}
