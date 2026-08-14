import type { ReactNode } from 'react'

export function ConfirmationRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-tertiary">{label}</span>
      <span className="text-sm font-medium text-text-primary flex items-center gap-1.5">{value}</span>
    </div>
  )
}
