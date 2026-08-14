export function VaultInvestCardSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-white/12 bg-bg-elevated/3 backdrop-blur-2xl p-5 flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-5 w-32 rounded-md bg-white/5" />
            <div className="h-4 w-24 rounded-full bg-white/5" />
          </div>
          <div className="h-5 w-16 rounded-full shrink-0 bg-white/5" />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle/50 pt-3">
          <div className="space-y-1.5">
            <div className="h-3 w-10 rounded bg-white/5" />
            <div className="h-4 w-16 rounded bg-white/5" />
          </div>
          <div className="space-y-1.5">
            <div className="h-3 w-10 rounded bg-white/5" />
            <div className="h-4 w-12 rounded bg-white/5" />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 pt-1">
        <div className="h-8 flex-1 rounded-xl bg-white/5" />
        <div className="h-8 flex-1 rounded-xl bg-white/5" />
      </div>
    </div>
  )
}
