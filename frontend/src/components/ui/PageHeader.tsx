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
      navigate({ to: backTo as any })
    }
  }

  return (
    <div className="sticky top-0 z-40 flex flex-col items-start justify-between gap-3 md:flex-row md:items-center bg-bg-void/30 backdrop-blur-2xl border-b border-border-subtle/30 py-2 -mx-6 px-4 lg:-mx-8 -mt-6 mb-5">
      <div className="flex items-center gap-3">
        {(backTo || onBack) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            className="h-8 px-2.5 gap-1.5 text-xs text-text-tertiary hover:text-text-primary border-border-subtle hover:bg-bg-inset shrink-0"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back</span>
          </Button>
        )}
        <div>
          <h1 className="text-lg font-bold tracking-tight text-text-primary">{title}</h1>
          <p className="text-[12px] text-text-secondary">{subtitle}</p>
        </div>
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
