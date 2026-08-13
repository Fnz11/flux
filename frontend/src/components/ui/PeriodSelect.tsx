import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select'

export interface PeriodOption {
  label: string
  points?: number
}

export function PeriodSelect({
  value,
  options,
  onChange,
  accentText,
}: {
  value: string
  options: PeriodOption[]
  onChange: (opt: PeriodOption) => void
  accentText?: string
}) {
  return (
    <Select
      value={value}
      onValueChange={(val) => {
        const found = options.find((o) => o.label === val)
        if (found) onChange(found)
      }}
    >
      <SelectTrigger
        className="h-6 w-auto gap-1 rounded-lg border-border-subtle bg-bg-inset px-2 py-0 text-[10px] font-medium text-text-secondary transition-colors hover:border-border-medium hover:text-text-primary focus:ring-0 cursor-pointer shrink-0"
      >
        <SelectValue placeholder={value} style={{ color: accentText }} />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[7.5rem] rounded-xl border-border-medium bg-bg-elevated text-text-primary shadow-xl">
        {options.map((o) => (
          <SelectItem key={o.label} value={o.label} className="text-xs text-text-secondary focus:bg-bg-inset focus:text-text-primary cursor-pointer">
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
