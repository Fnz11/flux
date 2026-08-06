import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export type EmptyStateSize = 'lg' | 'md' | 'sm' | 'xs'

const sizeConfig: Record<
  EmptyStateSize,
  { iconBox: string; icon: string; title: string; desc: string; gap: string; pad: string }
> = {
  lg: { iconBox: 'size-14', icon: 'size-7', title: 'text-base font-bold', desc: 'text-sm', gap: 'gap-3', pad: 'py-10' },
  md: { iconBox: 'size-11', icon: 'size-5', title: 'text-sm font-bold', desc: 'text-xs', gap: 'gap-2', pad: 'py-8' },
  sm: { iconBox: 'size-9', icon: 'size-4.5', title: 'text-xs font-bold', desc: 'text-[11px]', gap: 'gap-1.5', pad: 'py-6' },
  xs: { iconBox: 'size-7', icon: 'size-3.5', title: 'text-xs font-bold', desc: 'text-[10px]', gap: 'gap-1', pad: 'py-3' },
}

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  size?: EmptyStateSize
  className?: string
}

export function EmptyState({ title, description, icon, size = 'md', className }: EmptyStateProps) {
  const s = sizeConfig[size]
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        s.gap,
        s.pad,
        className,
      )}
    >
      <div className={cn('flex items-center justify-center rounded-full bg-primary-coral/10 text-primary-coral border border-primary-coral/25 shadow-md', s.iconBox)}>
        <div className={s.icon}>{icon ?? <Inbox className="size-full" />}</div>
      </div>
      <p className={cn('text-text-primary tracking-tight', s.title)}>{title}</p>
      {description && <p className={cn('text-text-tertiary max-w-xs leading-relaxed', s.desc)}>{description}</p>}
    </div>
  )
}