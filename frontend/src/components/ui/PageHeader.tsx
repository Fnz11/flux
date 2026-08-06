import type { ReactNode } from 'react'
import { NavHeader } from './NavHeader'

interface PageHeaderProps {
  title: string
  subtitle: string
  action?: ReactNode
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div className="sticky top-0 z-40 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center w-full bg-bg-void/20 backdrop-blur-2xl border-b border-border-subtle/30 pb-3 pt-3 -mx-6 px-6 sm:-mx-8 sm:px-8 -mt-6 mb-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-text-primary">{title}</h1>
        <p className="mt-0.5 text-[12px] text-text-secondary">{subtitle}</p>
      </div>

      <div className="flex items-center gap-4">
        <NavHeader />
        
        {action && (
          <div>
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
