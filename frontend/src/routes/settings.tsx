import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings')({ component: SettingsPage })

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
        <p className="mt-2 text-text-secondary">Configure platform preferences and account settings.</p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
        <p className="text-sm text-text-tertiary">Settings interface coming soon.</p>
      </div>
    </div>
  )
}
