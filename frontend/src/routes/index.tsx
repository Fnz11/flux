import { createFileRoute } from '@tanstack/react-router'
import { useAppStore } from '../stores/app-store'

export const Route = createFileRoute('/')({ component: DashboardPage })

function DashboardPage() {
  const isManager = useAppStore((s) => s.isManager)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {isManager ? 'Manager Dashboard' : 'Investor Dashboard'}
        </h1>
        <p className="mt-2 text-text-secondary">
          {isManager
            ? 'Manage vaults, execute trades, and monitor performance.'
            : 'Track your investments, deposits, and portfolio performance.'}
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard title="Total Value Locked" value="$0.00" change="+0%" />
        <StatCard title="Active Vaults" value="0" change="--" />
        <StatCard title="Total Yield" value="0.00%" change="--" />
      </div>
    </div>
  )
}

function StatCard({ title, value, change }: { title: string; value: string; change: string }) {
  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-6">
      <p className="text-sm text-text-tertiary">{title}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">{value}</p>
      <p className="mt-1 text-xs text-status-success">{change}</p>
    </div>
  )
}
