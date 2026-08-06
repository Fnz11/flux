import * as React from 'react'
import { cn } from '@/lib/utils'

const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn('flex h-10 w-full rounded-xl border border-white/12 bg-bg-inset/70 px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-coral/60 focus-visible:border-primary-coral disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none', className)}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
