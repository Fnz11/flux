import { useFormContext } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { SLIPPAGE_PRESETS } from '@/constants/ui'
import { cn } from '@/lib/utils'
import type { SwapFormValues } from '@/validations/trade'

export function SlippageField() {
  const { setValue } = useFormContext<SwapFormValues>()
  return (
    <FormField
      name="slippage"
      render={({ field }) => (
        <FormItem className="pt-2">
          <FormLabel className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Slippage Tolerance</FormLabel>
          <FormControl>
            <div className="flex items-center gap-1.5 mt-1.5">
              {SLIPPAGE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue('slippage', s, { shouldValidate: true })}
                  className={cn(
                    'rounded-xl px-3 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer',
                    field.value === s
                      ? 'bg-primary-coral text-white font-bold shadow-xs'
                      : 'border border-white/10 bg-white/[0.03] text-text-secondary hover:text-text-primary hover:bg-white/[0.06] hover:border-white/20'
                  )}
                >
                  {s}%
                </button>
              ))}
              <div className="relative flex items-center ml-1">
                <DecimalInput
                  id="custom-slippage"
                  value={field.value ?? ''}
                  onValueChange={(_, num) => field.onChange(num ?? 0)}
                  maxDecimals={2}
                  placeholder="0.5"
                  className="w-16 px-2 py-1 text-xs h-8 rounded-xl border border-white/10 bg-white/[0.03] text-center font-mono font-semibold text-text-primary focus-visible:border-primary-coral/50"
                />
                <span className="ml-1.5 text-xs text-text-tertiary font-mono">%</span>
              </div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
