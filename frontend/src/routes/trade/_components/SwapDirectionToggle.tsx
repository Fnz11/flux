import { ArrowDownUp } from 'lucide-react'

export interface SwapDirectionToggleProps {
  onToggle: () => void
}

export function SwapDirectionToggle({ onToggle }: SwapDirectionToggleProps) {
  return (
    <div className="flex justify-center -my-2 relative z-10">
      <button
        type="button"
        onClick={onToggle}
        aria-label="Swap direction"
        className="flex size-8 items-center justify-center rounded-xl border border-white/10 bg-bg-elevated hover:bg-white/[0.08] hover:border-white/20 text-text-secondary hover:text-text-primary transition-all duration-150 shadow-md cursor-pointer"
      >
        <ArrowDownUp className="size-3.5" />
      </button>
    </div>
  )
}
