export function VaultStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-xl border border-border-subtle bg-bg-elevated p-5 shadow-xs">
          <div className="h-3 w-16 rounded bg-bg-inset" />
          <div className="mt-2.5 h-7 w-24 rounded bg-bg-inset" />
        </div>
      ))}
    </div>
  )
}
