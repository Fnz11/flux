import React from 'react'
import { cn } from '@/lib/utils'

export interface NotificationBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  count?: number
  showZero?: boolean
}

export function NotificationBadge({
  count,
  showZero = false,
  className,
  children,
  ...props
}: NotificationBadgeProps) {
  if (count === undefined && !children) return null
  if (count === 0 && !showZero) return null

  const display = children ?? (count !== undefined && count > 9 ? '9+' : count)

  return (
    <span
      className={cn(
        'absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-gradient-to-r from-primary-coral to-primary-amber text-[10px] font-bold leading-none text-black shadow-md pointer-events-none',
        className
      )}
      {...props}
    >
      {display}
    </span>
  )
}
