import { FormLabel } from '@/components/ui/form'
import { TokenSelector } from './TokenSelector'

export interface ReceiveSectionProps {
  outputAmount: number
  tokens: string[]
  outputToken: string
  onOutputTokenChange: (token: string) => void
  disabledTokens?: string[]
}

export function ReceiveSection({
  outputAmount,
  tokens,
  outputToken,
  onOutputTokenChange,
  disabledTokens,
}: ReceiveSectionProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-150 hover:border-white/20">
      <FormLabel className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">You receive</FormLabel>
      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="flex-1 font-mono text-2xl font-bold tracking-tight text-text-primary">
          {outputAmount > 0 ? outputAmount.toFixed(6) : '0.00'}
        </p>
        <TokenSelector
          tokens={tokens}
          selected={outputToken}
          onSelect={onOutputTokenChange}
          disabledTokens={disabledTokens}
          aria-label="Select receive token"
        />
      </div>
    </div>
  )
}
