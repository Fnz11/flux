import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { TokenSelector } from './TokenSelector'

export interface PayInputFieldProps {
  maxBalance: number | null
  onSetMax: () => void
  tokens: string[]
  inputToken: string
  onInputTokenChange: (token: string) => void
}

export function PayInputField({
  maxBalance,
  onSetMax,
  tokens,
  inputToken,
  onInputTokenChange,
}: PayInputFieldProps) {
  const formattedMax =
    maxBalance !== null
      ? maxBalance > 0 && maxBalance < 0.01
        ? parseFloat(maxBalance.toFixed(6)).toString()
        : maxBalance.toFixed(2)
      : '0.00'

  return (
    <FormField
      name="inputAmount"
      render={({ field }) => (
        <FormItem className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-150 hover:border-white/20 focus-within:border-primary-coral/50 space-y-0">
          <div className="flex items-center justify-between">
            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">You pay</FormLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSetMax}
              className="h-auto px-2 py-0.5 text-xs text-primary-coral hover:bg-primary-coral/10 font-mono transition-colors"
            >
              Max ({formattedMax})
            </Button>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <FormControl>
              <DecimalInput
                {...field}
                id="pay-amount"
                placeholder="0.00"
                maxDecimals={9}
                className="flex-1 bg-transparent font-mono text-2xl font-bold tracking-tight text-text-primary placeholder:text-text-muted border-0 h-auto p-0 focus-visible:ring-0 rounded-none shadow-none"
              />
            </FormControl>
            <TokenSelector
              tokens={tokens}
              selected={inputToken}
              onSelect={onInputTokenChange}
            />
          </div>
          <FormMessage className="mt-1" />
        </FormItem>
      )}
    />
  )
}
