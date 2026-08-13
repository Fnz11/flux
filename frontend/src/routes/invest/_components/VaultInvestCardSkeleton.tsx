export function VaultInvestCardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-border-subtle bg-bg-elevated p-6">
      <div className="flex items-start justify-between">
        <div className="h-5 w-36 rounded bg-bg-inset" />
        <div className="h-5 w-20 rounded-full bg-bg-inset" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="h-4 w-20 rounded bg-bg-inset" />
        <div className="h-4 w-20 rounded bg-bg-inset" />
      </div>
      <div className="mt-4 flex gap-2">
        <div className="h-10 flex-1 rounded-xl bg-bg-inset" />
        <div className="h-10 flex-1 rounded-xl bg-bg-inset" />
      </div>
    </div>
  )
}
