import { lazy, Suspense } from 'react'

const AllocationChartInner = lazy(() => import('./AllocationChartInner').then(m => ({ default: m.AllocationChartInner })))

interface AllocationChartProps {
  data: { name: string; value: number; color: string }[]
  isLoading?: boolean
}

export function AllocationChart({ data, isLoading }: AllocationChartProps) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <div className="animate-pulse h-[300px] rounded-lg bg-bg-inset" />
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
        <h3 className="text-base font-semibold text-text-primary">Allocation</h3>
        <p className="mt-12 text-center text-sm text-text-muted">No positions to display</p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-border-subtle bg-bg-elevated p-5">
      <h3 className="text-base font-semibold text-text-primary">Allocation</h3>
      <div className="mt-2 flex items-start gap-6">
        <Suspense fallback={<div className="h-[220px] w-[220px] animate-pulse rounded-lg bg-bg-inset" />}>
          <AllocationChartInner data={data} />
        </Suspense>
      </div>
    </div>
  )
}
