import { useFormContext } from 'react-hook-form'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { SLIPPAGE_PRESETS } from '@/constants/ui'
import type { SwapFormValues } from '@/validations/trade'

export function SlippageField() {
  const { setValue } = useFormContext<SwapFormValues>()
  return (
    <FormField
      name="slippage"
      render={({ field }) => (
        <FormItem className="pt-1">
          <FormLabel className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">Slippage Tolerance</FormLabel>
          <FormControl>
            <div className="flex items-center gap-1.5">
              {SLIPPAGE_PRESETS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setValue('slippage', s, { shouldValidate: true })}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-all cursor-pointer ${
                    field.value === s
                      ? 'bg-gradient-to-r from-primary-coral to-primary-amber text-black font-bold shadow-xs'
                      : 'border border-border-subtle bg-bg-inset text-text-tertiary hover:text-text-primary'
                  }`}
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
                  className="w-16 px-2 py-1 text-xs h-7 rounded-lg border-border-subtle bg-bg-inset text-center font-mono font-semibold"
                />
                <span className="ml-1 text-xs text-text-tertiary">%</span>
              </div>
            </div>
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
