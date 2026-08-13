export function ConfirmationRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-text-tertiary">{label}</span>
      <span className="text-sm font-medium text-text-primary">{value}</span>
    </div>
  )
}
