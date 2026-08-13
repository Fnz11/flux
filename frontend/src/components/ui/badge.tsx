import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary-coral focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-primary-coral text-black hover:bg-primary-coral/80',
        secondary:
          'border-transparent bg-bg-elevated text-text-secondary hover:bg-bg-elevated/80',
        destructive:
          'border-transparent bg-status-error text-white hover:bg-status-error/80',
        outline: 'text-text-primary border-border-medium bg-bg-inset/80',
        success:
          'border-status-success/20 bg-status-success/10 text-status-success',
        warning:
          'border-amber-500/20 bg-amber-500/10 text-amber-400',
        coral:
          'border-primary-coral/20 bg-primary-coral/10 text-primary-coral',
        gold:
          'border-primary-gold/20 bg-primary-gold/10 text-primary-gold',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
