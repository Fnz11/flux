import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'

import { SweepButton } from './SweepButton'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium transition-[background-color,border-color,color,box-shadow,opacity] duration-400 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-coral disabled:pointer-events-none disabled:opacity-50 cursor-pointer',
  {
    variants: {
      variant: {
        default: 'bg-primary-coral text-black hover:bg-primary-coral/90 shadow-[0_0_15px_rgba(255,107,53,0.3)] hover:shadow-[0_0_25px_rgba(255,107,53,0.5)]',
        sweep: '',
        outline: 'border border-border-medium bg-transparent hover:bg-bg-inset text-text-primary hover:border-primary-coral/50',
        ghost: 'hover:bg-bg-inset text-text-secondary hover:text-text-primary',
        destructive: 'bg-status-error text-white hover:bg-status-error/90',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 px-3 text-xs',
        lg: 'h-12 px-6 text-base',
        icon: 'h-10 w-10',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  showDots?: boolean
  icon?: React.ReactNode
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, showDots = true, icon, children, ...props }, ref) => {
    if (variant === 'sweep') {
      return (
        <SweepButton ref={ref} className={className} showDots={showDots} icon={icon} {...props}>
          {children}
        </SweepButton>
      )
    }
    const Comp = asChild ? Slot : 'button'
    return <Comp className={buttonVariants({ variant, size, className })} ref={ref} {...props}>{children}</Comp>
  },
)
Button.displayName = 'Button'

export { Button }
