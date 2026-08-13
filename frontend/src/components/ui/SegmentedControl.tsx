import React from 'react'
import { cn } from '@/lib/utils'

export interface SegmentedControlOption<T extends string = string> {
  label: React.ReactNode
  value: T
}

export interface SegmentedControlProps<T extends string = string> {
  options: readonly (SegmentedControlOption<T> | T)[]
  value: T
  onChange: (value: T) => void
  size?: 'xs' | 'sm' | 'md'
  className?: string
  activeClassName?: string
  inactiveClassName?: string
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'xs',
  className,
  activeClassName,
  inactiveClassName,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn(
        'flex items-center gap-1 rounded-xl border border-border-medium bg-bg-surface p-1',
        className
      )}
    >
      {options.map((opt) => {
        const optionValue = typeof opt === 'object' && opt !== null && 'value' in opt ? opt.value : (opt as T)
        const optionLabel = typeof opt === 'object' && opt !== null && 'label' in opt ? opt.label : String(opt)
        const isActive = value === optionValue

        return (
          <button
            key={optionValue}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(optionValue)}
            className={cn(
              'rounded-lg font-semibold transition-all cursor-pointer whitespace-nowrap',
              size === 'xs' && 'px-2.5 py-1 text-xs',
              size === 'sm' && 'px-3 py-1.5 text-xs',
              size === 'md' && 'px-4 py-2 text-sm',
              isActive
                ? (activeClassName ?? 'bg-primary-coral/10 text-primary-coral border border-primary-coral/30 shadow-xs')
                : (inactiveClassName ?? 'text-text-tertiary hover:text-text-primary hover:bg-bg-elevated'),
            )}
          >
            {optionLabel}
          </button>
        )
      })}
    </div>
  )
}
