import { lazy, Suspense } from 'react'
import { PieChart } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/skeleton'

const AllocationChartInner = lazy(() =>
  import('./AllocationChartInner').then((m) => ({ default: m.AllocationChartInner }))
)

interface AllocationChartProps {
  data: { name: string; value: number; color?: string }[]
  isLoading?: boolean
  className?: string
}

export function AllocationChart({ data, isLoading, className }: AllocationChartProps) {
  const totalValue = data.reduce((sum, d) => sum + d.value, 0)
  const formattedTotal = totalValue.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  if (isLoading) {
    return (
      <SectionCard
        icon={<PieChart className="size-4 text-primary-gold" />}
        title="Vault Allocation"
        description="Capital distribution across your invested vaults"
        className={`h-full flex flex-col justify-between ${className || ''}`}
        contentClassName="flex-1 flex flex-col justify-center min-h-[360px]"
      >
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 py-4">
          <div className="relative size-60 lg:size-64 rounded-full border-8 border-bg-inset animate-pulse flex items-center justify-center">
            <Skeleton className="size-32 rounded-full" />
          </div>
          <div className="space-y-3 flex-1 w-full">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="size-2.5 rounded-full" />
                <Skeleton className="h-4 w-28 rounded" />
                <Skeleton className="h-4 w-14 rounded ml-auto" />
              </div>
            ))}
          </div>
        </div>
      </SectionCard>
    )
  }

  return (
    <SectionCard
      icon={<PieChart className="size-4 text-primary-gold" />}
      title="Vault Allocation"
      description="Capital distribution across your invested vaults"
      className={`h-full flex flex-col justify-between ${className || ''}`}
      contentClassName="flex-1 flex flex-col justify-center min-h-[360px]"
      rightContent={
        totalValue > 0 ? (
          <div className="text-right">
            <span className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary block">
              TOTAL INVESTED
            </span>
            <span className="font-mono text-sm font-bold text-text-primary">
              ${formattedTotal}
            </span>
          </div>
        ) : null
      }
    >
      {data.length === 0 ? (
        <div className="py-12 flex flex-1 items-center justify-center">
          <EmptyState
            icon={<PieChart className="size-5" />}
            title="No active position allocation"
            description="Deposit into vaults to see your investment distribution and allocation breakdown."
            size="md"
          />
        </div>
      ) : (
        <div className="flex flex-1 items-center w-full h-full">
          <Suspense fallback={<div className="h-[300px] w-full animate-pulse rounded-xl bg-bg-inset" />}>
            <AllocationChartInner data={data as { name: string; value: number; color: string }[]} />
          </Suspense>
        </div>
      )}
    </SectionCard>
  )
}
