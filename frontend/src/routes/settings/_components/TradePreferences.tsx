import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useConfigStore } from '@/stores/config-store'
import { Button } from '@/components/ui/button'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Sliders } from 'lucide-react'
import { tradePreferencesSchema, type TradePreferencesFormValues } from '@/validations/trade'
import { BPS_PRESETS } from '@/constants/ui'

export function TradePreferences() {
  const config = useConfigStore((s) => s.config)
  const updateConfig = useConfigStore((s) => s.updateConfig)
  const [saved, setSaved] = useState(false)

  const form = useForm<TradePreferencesFormValues>({
    resolver: zodResolver(tradePreferencesSchema),
    defaultValues: {
      slippageBps: '50',
      dustThreshold: config?.dustThreshold?.toString() || '0.001',
    },
  })

  useEffect(() => {
    if (config?.dustThreshold !== undefined) {
      form.setValue('dustThreshold', config.dustThreshold.toString())
    }
  }, [config?.dustThreshold, form])

  const onSubmit = (data: TradePreferencesFormValues) => {
    updateConfig({
      dustThreshold: parseFloat(data.dustThreshold) || 0.001,
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="rounded-xl border border-border-subtle bg-bg-elevated p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Sliders className="size-5 text-primary-gold" />
        <h2 className="text-base font-semibold text-text-primary">Trade Execution Parameters</h2>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="slippageBps"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="slippage">Max Slippage Tolerance (BPS)</FormLabel>
                  <FormControl>
                    <div className="flex gap-2">
                      {BPS_PRESETS.map((bps) => (
                        <Button
                          key={bps}
                          type="button"
                          variant={field.value === bps ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => form.setValue('slippageBps', bps, { shouldValidate: true })}
                        >
                          {(parseInt(bps) / 100).toFixed(1)}%
                        </Button>
                      ))}
                      <DecimalInput
                        id="slippage"
                        maxDecimals={0}
                        {...field}
                        className="w-24 font-mono text-xs"
                      />
                    </div>
                  </FormControl>
                  <FormDescription>Trades revert if execution price moves beyond this limit.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="dustThreshold"
              render={({ field }) => (
                <FormItem>
                  <FormLabel htmlFor="dust">Dust Asset Threshold (SOL)</FormLabel>
                  <FormControl>
                    <DecimalInput
                      id="dust"
                      maxDecimals={4}
                      placeholder="0.001"
                      {...field}
                      className="font-mono text-xs"
                    />
                  </FormControl>
                  <FormDescription>Positions below this value are excluded from portfolio rebalancing.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            {saved && <span className="text-xs text-status-success font-medium">Settings saved!</span>}
            <Button type="submit" className="bg-primary-coral text-black hover:bg-primary-coral/90">
              Save Preferences
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}

