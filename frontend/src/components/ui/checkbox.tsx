import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
}

const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, disabled, ...props }, ref) => {
    return (
      <div className="relative inline-flex items-center">
        <input
          type="checkbox"
          ref={ref}
          checked={checked}
          disabled={disabled}
          onChange={(e) => onCheckedChange?.(e.target.checked)}
          className="peer sr-only"
          {...props}
        />
        <div
          onClick={() => !disabled && onCheckedChange?.(!checked)}
          className={cn(
            'flex size-4 shrink-0 items-center justify-center rounded border border-border-subtle bg-bg-inset transition-colors cursor-pointer',
            'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-coral/40',
            checked && 'bg-primary-coral border-primary-coral text-white',
            disabled && 'cursor-not-allowed opacity-50',
            className
          )}
        >
          {checked && <Check className="size-3 stroke-[3]" />}
        </div>
      </div>
    )
  }
)
Checkbox.displayName = 'Checkbox'

export { Checkbox }
