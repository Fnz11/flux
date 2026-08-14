export function VaultInvestCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border-subtle bg-bg-elevated p-6 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-36 rounded-md bg-bg-inset" />
          <div className="h-4 w-28 rounded-full bg-bg-inset" />
        </div>
        <div className="h-5 w-16 rounded-full shrink-0 bg-bg-inset" />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 pt-1">
        <div className="space-y-1.5">
          <div className="h-3 w-10 rounded bg-bg-inset" />
          <div className="h-4.5 w-20 rounded bg-bg-inset" />
        </div>
        <div className="space-y-1.5">
          <div className="h-3 w-10 rounded bg-bg-inset" />
          <div className="h-4.5 w-14 rounded bg-bg-inset" />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 pt-1">
        <div className="h-9 flex-1 rounded-xl bg-bg-inset" />
        <div className="h-9 flex-1 rounded-xl bg-bg-inset" />
      </div>
    </div>
  )
}
