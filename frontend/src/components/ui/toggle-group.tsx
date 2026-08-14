import { cn } from '@/lib/utils'
import { Button } from './button'

interface ToggleGroupProps {
  options: { label: React.ReactNode; value: string; icon?: React.ReactNode }[]
  value: string
  onChange: (value: string) => void
  size?: 'sm' | 'md'
}

function ToggleGroup({ options, value, onChange, size = 'md' }: ToggleGroupProps) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-bg-inset p-0.5">
      {options.map((opt) => (
        <Button
          key={opt.value}
          type="button"
          variant={value === opt.value ? 'default' : 'ghost'}
          size={size === 'sm' ? 'sm' : 'default'}
          onClick={() => onChange(opt.value)}
          className={cn(
            'flex items-center gap-1.5 text-xs font-medium',
            value === opt.value
              ? 'bg-primary-coral text-black hover:bg-primary-coral/90'
              : 'text-text-tertiary hover:text-text-primary',
            size === 'sm' ? 'h-7 px-2 py-1 text-xs' : 'h-8 px-3 py-1.5',
          )}
        >
          {opt.icon}
          {opt.label}
        </Button>
      ))}
    </div>
  )
}

export { ToggleGroup }
