import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface SectionCardProps {
  icon?: ReactNode
  title?: ReactNode | string
  description?: ReactNode | string
  rightContent?: ReactNode
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  iconWrapperClassName?: string
  noPadding?: boolean
}

export function SectionCard({
  icon,
  title,
  description,
  rightContent,
  children,
  className,
  headerClassName,
  contentClassName,
  iconWrapperClassName,
  noPadding = false,
}: SectionCardProps) {
  const hasHeader = Boolean(title || icon || description || rightContent)

  return (
    <div
      className={cn(
        'rounded-2xl border border-white/12 bg-bg-elevated/3 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] flex flex-col overflow-hidden',
        noPadding ? 'p-0' : 'p-5',
        className,
      )}
    >
      {hasHeader && (
        <div
          className={cn(
            'flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border-subtle/50 pb-4 shrink-0',
            noPadding && 'p-4 sm:p-5 pb-4',
            headerClassName,
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            {icon && (
              <div
                className={cn(
                  'flex size-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-text-primary shrink-0',
                  iconWrapperClassName,
                )}
              >
                {icon}
              </div>
            )}
            {(title || description) && (
              <div className="min-w-0">
                {title && (
                  <h2 className="text-sm font-bold tracking-tight text-text-primary flex items-center gap-2">
                    {title}
                  </h2>
                )}
                {description && (
                  typeof description === 'string' ? (
                    <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{description}</p>
                  ) : (
                    <div className="text-xs text-text-tertiary mt-0.5">{description}</div>
                  )
                )}
              </div>
            )}
          </div>

          {rightContent && (
            <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto overflow-x-auto no-scrollbar">
              {rightContent}
            </div>
          )}
        </div>
      )}

      <div className={cn(hasHeader && !noPadding && 'mt-4', 'flex-1 flex flex-col', contentClassName)}>
        {children}
      </div>
    </div>
  )
}
