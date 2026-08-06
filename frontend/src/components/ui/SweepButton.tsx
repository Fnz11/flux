import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SweepButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode
  showDots?: boolean
}

const DotMatrix = () => (
  <div className="flex flex-col gap-[2px]">
    {[0, 1, 2, 3, 4].map((row) => (
      <div key={row} className="flex gap-[2px]">
        {[0, 1, 2, 3, 4].map((col) => {
          const isActive = (row + col) % 2 === 0 || row === 2 || col === 2
          return (
            <span
              key={col}
              className={cn(
                'h-[3px] w-[3px] rounded-full transition-colors duration-400',
                isActive ? 'bg-black' : 'bg-black/30',
              )}
            />
          )
        })}
      </div>
    ))}
  </div>
)

export const SweepButton = React.forwardRef<HTMLButtonElement, SweepButtonProps>(
  ({ className, children, icon, showDots = true, disabled, type = 'button', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        className={cn(
          'group relative inline-flex items-center justify-center gap-2 rounded-xl border border-border-medium bg-bg-surface py-2 pr-5 pl-11 text-sm font-medium text-white transition-[box-shadow,opacity] duration-300 ease-out overflow-hidden shadow-[0_0_20px_rgba(255,107,53,0.20)] hover:shadow-[0_0_30px_rgba(255,107,53,0.5)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-coral disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none',
          className
        )}
        {...props}
      >
        {/* Sliding Icon / Dot Grid Box */}
        <div className="absolute inset-y-1 left-1 my-auto flex h-7 w-7 items-center justify-center rounded-[5px] bg-gradient-to-br from-primary-coral to-primary-gold text-black shadow-md transition-[left,transform] duration-300 ease-out group-hover:left-[calc(100%-2.15rem)] group-hover:rotate-180 z-20">
          {icon ? icon : showDots ? <DotMatrix /> : null}
        </div>

        {/* Clip-path sweep layer */}
        <div
          className="absolute -inset-px rounded-xl bg-gradient-to-r from-primary-coral via-primary-amber to-primary-gold opacity-95 transition-[clip-path] duration-300 ease-out [clip-path:inset(0_100%_0_0)] group-hover:[clip-path:inset(0_0%_0_0)] pointer-events-none z-0"
          aria-hidden="true"
        />

        {/* Ambient glow highlight */}
        <div
          className="absolute -inset-1 rounded-xl bg-primary-coral/20 blur-md opacity-0 transition-opacity duration-300 group-hover:opacity-100 pointer-events-none z-[-1]"
          aria-hidden="true"
        />

        {/* Button Content Label */}
        <span className="relative z-10 flex items-center gap-1.5 font-medium tracking-tight text-white transition-[transform,color] duration-300 ease-out group-hover:-translate-x-4 group-hover:text-black">
          {children}
        </span>
      </button>
    )
  }
)

SweepButton.displayName = 'SweepButton'
