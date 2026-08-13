import { FormLabel } from '@/components/ui/form'
import { TokenSelector } from './TokenSelector'

export interface ReceiveSectionProps {
  outputAmount: number
  tokens: string[]
  outputToken: string
  onOutputTokenChange: (token: string) => void
}

export function ReceiveSection({
  outputAmount,
  tokens,
  outputToken,
  onOutputTokenChange,
}: ReceiveSectionProps) {
  return (
    <div className="rounded-xl border border-border-subtle/50 bg-bg-inset p-4 hover:border-border-medium transition-colors">
      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">You receive</FormLabel>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="flex-1 font-mono text-2xl font-bold tracking-tight text-text-primary">
          {outputAmount > 0 ? outputAmount.toFixed(6) : '0.00'}
        </p>
        <TokenSelector
          tokens={tokens}
          selected={outputToken}
          onSelect={onOutputTokenChange}
        />
      </div>
    </div>
  )
}
