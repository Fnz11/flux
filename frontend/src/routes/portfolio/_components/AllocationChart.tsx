import { lazy, Suspense } from 'react'
import { PieChart } from 'lucide-react'

const AllocationChartInner = lazy(() => import('./AllocationChartInner').then(m => ({ default: m.AllocationChartInner })))

interface AllocationChartProps {
  data: { name: string; value: number; color: string }[]
  isLoading?: boolean
}

import { Skeleton } from '@/components/ui/skeleton'

export function AllocationChart({ data, isLoading }: AllocationChartProps) {
  if (isLoading) {
    return (
      <div className="h-full flex flex-col justify-between rounded-xl border border-border-subtle bg-bg-elevated/40 p-5 min-h-[360px]">
        <div className="flex items-center justify-between">
          <Skeleton className="h-5 w-24 rounded-md" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <div className="flex flex-1 items-center justify-center gap-8 py-6">
          {/* Circular Donut Skeleton Ring */}
          <div className="relative size-36 rounded-full border-8 border-bg-inset animate-pulse flex items-center justify-center">
            <Skeleton className="size-16 rounded-full" />
          </div>
          {/* Legend Items Skeleton */}
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton className="h-3.5 w-14 rounded" />
                <Skeleton className="h-3.5 w-10 rounded" />
              </div>
            ))}
          </div>
        </div>
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
