import { cn } from '@/lib/utils'

interface ToggleGroupProps {
  options: { label: string; value: string }[]
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
}

function ToggleGroup({ options, value, onChange, size = 'md' }: ToggleGroupProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-bg-inset p-0.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
            value === opt.value
              ? 'bg-primary-coral text-black'
              : 'text-text-tertiary hover:text-text-primary',
            size === 'sm' ? 'px-2 py-1 text-xs' : 'px-3 py-1.5',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export { ToggleGroup }
