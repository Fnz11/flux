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
  disabledTokens?: string[]
}

export function PayInputField({
  maxBalance,
  onSetMax,
  tokens,
  inputToken,
  onInputTokenChange,
  disabledTokens,
}: PayInputFieldProps) {
  const formattedMax =
    maxBalance !== null
      ? Number(maxBalance).toLocaleString(undefined, {
          minimumFractionDigits: 2,
          maximumFractionDigits: Number(maxBalance) < 1 && Number(maxBalance) > 0 ? 6 : 4,
        })
      : '0.00'

  return (
    <FormField
      name="inputAmount"
      render={({ field }) => (
        <FormItem className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-all duration-150 hover:border-white/20 focus-within:border-primary-coral/50 space-y-0">
          <div className="flex items-center justify-between">
            <FormLabel className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">You Pay</FormLabel>
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
                placeholder="0.00"
                maxDecimals={9}
                className="flex-1 bg-transparent font-mono text-2xl font-bold tracking-tight text-text-primary placeholder:text-text-muted border-0 h-auto p-0 focus-visible:ring-0 rounded-none shadow-none"
              />
            </FormControl>
            <TokenSelector
              tokens={tokens}
              selected={inputToken}
              onSelect={onInputTokenChange}
              disabledTokens={disabledTokens}
              aria-label="Select pay token"
            />
          </div>
          <FormMessage className="mt-1" />
        </FormItem>
      )}
    />
  )
}
