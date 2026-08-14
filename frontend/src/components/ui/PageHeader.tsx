import type { ReactNode } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { NavHeader } from './NavHeader'
import { Button } from './button'

interface PageHeaderProps {
  title: string
  subtitle: string
  action?: ReactNode
  backTo?: string
  onBack?: () => void
}

export function PageHeader({ title, subtitle, action, backTo, onBack }: PageHeaderProps) {
  const navigate = useNavigate()

  const handleBack = () => {
    if (onBack) {
      onBack()
    } else if (backTo) {
      navigate({ to: backTo as never })
    }
  }

  return (
    <div className="relative md:sticky md:top-0 z-10 md:z-30 flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center bg-transparent md:bg-bg-void/30 md:backdrop-blur-2xl border-b-0 md:border-b border-border-subtle/30 py-1 md:py-2 mx-0 px-0 md:-mx-6 md:px-4 lg:-mx-8 mt-0 md:-mt-6 mb-3 md:mb-5">
      <div className="flex items-center gap-3">
        {(backTo || onBack) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="flex h-8 px-2.5 gap-1.5 text-xs text-text-tertiary hover:text-text-primary border-border-subtle hover:bg-bg-inset shrink-0"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back</span>
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-bold tracking-tight text-text-primary">{title}</h1>
          <p className="text-[12px] text-text-secondary">{subtitle}</p>
        </div>
      </div>

      <div className="flex items-center justify-start md:justify-end gap-3 md:gap-4 w-full md:w-auto flex-wrap">
        <div className="hidden md:flex items-center">
          <NavHeader />
        </div>
        
        {action && (
          <div className="flex items-center gap-2 flex-wrap">
            {action}
          </div>
        )}
      </div>
    </div>
  )
}
