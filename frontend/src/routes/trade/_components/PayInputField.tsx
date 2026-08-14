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
  return (
    <FormField
      name="inputAmount"
      render={({ field }) => (
        <FormItem className="rounded-xl bg-bg-inset p-4 space-y-0">
          <div className="flex items-center justify-between">
            <FormLabel className="text-xs text-text-tertiary">You pay</FormLabel>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onSetMax}
              className="h-auto px-2 py-0.5 text-xs text-primary-coral hover:bg-primary-coral/10 font-mono transition-colors"
            >
              Max ({maxBalance !== null ? maxBalance.toFixed(2) : '10.0'})
            </Button>
          </div>
          <div className="mt-1 flex items-center gap-3">
            <FormControl>
              <DecimalInput
                {...field}
                id="pay-amount"
                placeholder="0.00"
                maxDecimals={9}
                className="flex-1 bg-transparent font-mono text-xl border-0 h-auto p-0 focus-visible:ring-0 rounded-none shadow-none"
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
