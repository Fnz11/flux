import { Button } from '@/components/ui/button'
import { ArrowDownUp } from 'lucide-react'

export interface SwapDirectionToggleProps {
  onToggle: () => void
}

export function SwapDirectionToggle({ onToggle }: SwapDirectionToggleProps) {
  return (
    <div className="flex justify-center">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onToggle}
        aria-label="Swap direction"
      >
        <ArrowDownUp className="size-4" />
      </Button>
    </div>
  )
}
