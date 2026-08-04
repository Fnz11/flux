import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-border-subtle bg-bg-elevated p-12 text-center">
      {icon && <div className="mb-4 text-text-muted">{icon}</div>}
      <p className="text-base font-medium text-text-primary">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-text-muted">{description}</p>
      )}
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-4 rounded-lg bg-primary-coral px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-primary-coral/90"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
