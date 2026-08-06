import { cn } from '@/lib/utils'

interface LoadingSkeletonProps {
  className?: string
  count?: number
  lines?: number
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-bg-inset', className)} />
}

export function LoadingSkeleton({ className, count = 1, lines }: LoadingSkeletonProps) {
  if (lines) {
    return (
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={cn('animate-pulse rounded-xl bg-bg-inset', className)}
            style={{ width: i === lines - 1 ? '60%' : '100%' }}
          />
        ))}
      </div>
    )
  }

  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className={className} />
      ))}
    </>
  )
}

