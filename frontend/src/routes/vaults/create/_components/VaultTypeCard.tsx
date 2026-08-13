import React from 'react'
import { CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VaultType } from '@/constants/vault'

export interface VaultTypeCardProps {
  type: VaultType
  selected: boolean
  onSelect: (type: VaultType) => void
  icon: React.ReactNode
  iconClassName: string
  title: string
  badge: string
  badgeClassName: string
  description: string
}

export function VaultTypeCard({
  type,
  selected,
  onSelect,
  icon,
  iconClassName,
  title,
  badge,
  badgeClassName,
  description,
}: VaultTypeCardProps) {
  const select = () => onSelect(type)
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={select}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          select()
        }
      }}
      className={cn(
        'cursor-pointer rounded-xl border p-5 transition-all relative space-y-3',
        selected
          ? 'border-primary-coral bg-primary-coral/5 shadow-md shadow-primary-coral/5 ring-1 ring-primary-coral/40'
          : 'border-border-subtle bg-bg-inset/60 hover:border-border-subtle/80 hover:bg-bg-inset'
      )}
    >
      <div className="flex items-start justify-between">
        <div className={cn('flex size-10 items-center justify-center rounded-lg', iconClassName)}>
          {icon}
        </div>
        {selected && <CheckCircle2 className="size-5 text-primary-coral" />}
      </div>
      <div>
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
          <span className={badgeClassName}>{badge}</span>
        </div>
        <p className="mt-1 text-xs text-text-tertiary leading-relaxed">{description}</p>
      </div>
    </div>
  )
}
