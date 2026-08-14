import type { Control } from 'react-hook-form'
import { Activity, CheckCircle2 } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { RAISE_UNITS, type RaiseUnit } from '@/constants/vault'
import { TokenIcon } from '@/components/ui/TokenIcon'
import type { CreateVaultFormValues } from '@/validations/vault'

export interface BasicConfigSectionProps {
  control: Control<CreateVaultFormValues>
  minRaiseUnit: RaiseUnit
  acceptedAssets: string[]
  solPrice: number
  minRaiseUsd: number
  onSetMinRaiseUnit: (unit: RaiseUnit) => void
  onToggleAsset: (asset: string) => void
}

export function BasicConfigSection({
  control,
  minRaiseUnit,
  acceptedAssets,
  solPrice,
  minRaiseUsd,
  onSetMinRaiseUnit,
  onToggleAsset,
}: BasicConfigSectionProps) {
  return (
    <SectionCard
      icon={<Activity className="size-4 text-primary-coral" />}
      title="03. Basic Configuration"
      description="Set minimum fundraising targets, accepted deposit assets, and live price oracle rates."
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <FormField
            control={control}
            name="minRaiseAmount"
            render={({ field }) => (
              <FormItem className="space-y-1.5">
                <FormLabel className="text-xs text-text-secondary">Min. Raise Amount</FormLabel>
                <div className="flex items-center gap-2">
                  <FormControl>
                    <DecimalInput
                      {...field}
                      value={field.value ?? ''}
                      onValueChange={(_, num) => field.onChange(num ?? 0)}
                      maxDecimals={4}
                      placeholder="0.00"
                      className="bg-bg-inset border-border-subtle font-mono text-base"
                    />
                  </FormControl>

                  <div className="flex rounded-lg bg-bg-inset p-1 border border-border-subtle gap-1">
                    {RAISE_UNITS.map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => onSetMinRaiseUnit(unit)}
                        className={cn(
                          'flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors cursor-pointer',
                          minRaiseUnit === unit
                            ? 'bg-primary-coral text-white'
                            : 'text-text-tertiary hover:text-text-primary'
                        )}
                      >
                        <TokenIcon symbol={unit} alt="" className="size-3.5" />
                        {unit}
                      </button>
                    ))}
                  </div>
                </div>
                <p className="text-[11px] font-mono text-text-tertiary">
                  ≈ ${minRaiseUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="space-y-1.5">
            <FormLabel className="text-xs text-text-secondary">Select Accepted Asset</FormLabel>
            <div className="flex gap-2">
              {RAISE_UNITS.map((asset) => {
                const isSelected = acceptedAssets.includes(asset)
                return (
                  <button
                    key={asset}
                    type="button"
                    onClick={() => onToggleAsset(asset)}
                    className={cn(
                      'flex-1 py-2.5 px-3 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center justify-center gap-2 cursor-pointer',
                      isSelected
                        ? 'border-primary-coral bg-primary-coral/10 text-primary-coral'
                        : 'border-border-subtle bg-bg-inset/50 text-text-tertiary hover:text-text-primary hover:border-border-subtle/80'
                    )}
                  >
                    <TokenIcon symbol={asset} alt="" className="size-4" />
                    <span>{asset}</span>
                    {isSelected && <CheckCircle2 className="size-3.5 ml-auto text-primary-coral shrink-0" />}
                  </button>
                )
              })}
            </div>
            <p className="text-[11px] text-text-tertiary">Whitelisted token mints for vault deposits.</p>
          </div>
        </div>

        <div className="rounded-xl border border-border-subtle/80 bg-bg-inset/80 p-3.5 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center gap-2">
            <div className="flex size-2 rounded-full bg-status-success animate-pulse" />
            <span className="text-text-secondary font-sans text-xs">USD RATE (Pyth Oracle)</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-text-primary font-semibold">
              1 SOL = ${solPrice.toFixed(2)} USD
            </span>
            <span className="text-[10px] bg-status-success/10 text-status-success px-2 py-0.5 rounded border border-status-success/20 font-sans font-medium flex items-center gap-1">
              <CheckCircle2 className="size-3" /> Live
            </span>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
