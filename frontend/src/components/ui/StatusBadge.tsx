type BadgeStatus = 'Active' | 'Fundraising' | 'Dormant' | 'Pending' | 'Failed' | 'success' | 'failed'

interface StatusBadgeProps {
  status: BadgeStatus
  label?: string
}

const colorMap: Record<BadgeStatus, { bg: string; dot: string }> = {
  Active: { bg: 'bg-primary-coral/20 text-primary-coral', dot: 'bg-primary-coral' },
  Fundraising: { bg: 'bg-primary-gold/20 text-primary-gold', dot: 'bg-primary-gold' },
  Dormant: { bg: 'bg-neutral-500/20 text-neutral-400', dot: 'bg-neutral-400' },
  Pending: { bg: 'bg-status-warn/20 text-status-warn', dot: 'bg-status-warn' },
  Failed: { bg: 'bg-status-error/20 text-status-error', dot: 'bg-status-error' },
  success: { bg: 'bg-status-success/20 text-status-success', dot: 'bg-status-success' },
  failed: { bg: 'bg-status-error/20 text-status-error', dot: 'bg-status-error' },
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colors = colorMap[status]
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${colors.bg}`}
    >
      <span className={`size-1.5 rounded-full ${colors.dot}`} />
      {label ?? status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}
