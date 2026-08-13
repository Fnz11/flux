import React from 'react'

export function VaultOverviewMetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-4">
      <p className="text-xs text-text-tertiary">{label}</p>
      <div className="mt-1">{value}</div>
    </div>
  )
}
