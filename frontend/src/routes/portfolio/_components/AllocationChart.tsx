import { lazy, Suspense } from 'react'
import { PieChart } from 'lucide-react'

const AllocationChartInner = lazy(() => import('./AllocationChartInner').then(m => ({ default: m.AllocationChartInner })))

interface AllocationChartProps {
  data: { name: string; value: number; color: string }[]
  isLoading?: boolean
}

export function AllocationChart({ data, isLoading }: AllocationChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl border border-border-subtle bg-bg-elevated p-5">
        <div className="animate-pulse h-[300px] rounded-xl bg-bg-inset" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="h-full flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-elevated/40 p-5 min-h-[360px]">
        <h3 className="text-base font-semibold text-text-primary">Allocation</h3>
        <div className="flex flex-1 flex-col items-center justify-center py-12 text-center">
          <div className="size-12 rounded-full border border-border-subtle bg-bg-inset/50 flex items-center justify-center mb-3 text-text-tertiary">
            <PieChart className="size-5" />
          </div>
          <p className="text-sm font-medium text-text-secondary">No active position allocation</p>
          <p className="mt-1 text-xs text-text-muted max-w-[200px]">Asset distribution will automatically render when you deposit into vaults</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-elevated/40 p-5 min-h-[360px]">
      <h3 className="text-base font-semibold text-text-primary">Allocation</h3>
      <div className="mt-2 flex flex-1 items-center justify-center gap-6">
        <Suspense fallback={<div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-bg-inset" />}>
          <AllocationChartInner data={data} />
        </Suspense>
      </div>
    </div>
  )
}
