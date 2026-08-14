import type { Control } from 'react-hook-form'
import { Percent, Clock } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { DecimalInput } from '@/components/ui/DecimalInput'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import { cn } from '@/lib/utils'
import { FEE_WITHDRAWAL_PERIODS, type LockupPeriodUnit, type FeeWithdrawalPeriod } from '@/constants/vault'
import type { CreateVaultFormValues } from '@/validations/vault'

export interface AdvancedSettingsSectionProps {
  control: Control<CreateVaultFormValues>
  lockupPeriodUnit: LockupPeriodUnit
  feeWithdrawalPeriod: FeeWithdrawalPeriod
  onLockupPeriodUnitChange: (unit: LockupPeriodUnit) => void
  onSetFeeWithdrawalPeriod: (period: FeeWithdrawalPeriod) => void
}

export function AdvancedSettingsSection({
  control,
  lockupPeriodUnit,
  feeWithdrawalPeriod,
  onLockupPeriodUnitChange,
  onSetFeeWithdrawalPeriod,
}: AdvancedSettingsSectionProps) {
  return (
    <SectionCard
      icon={<Percent className="size-4 text-primary-coral" />}
      title="04. Advanced Settings"
      description="Customize lockup durations, performance benchmarks, and fee structures."
    >
      <div className="space-y-6">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/50 pb-1.5 flex items-center gap-1.5">
            <Clock className="size-3.5 text-primary-coral" />
            Investment Parameters
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="minInvestment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-text-secondary">Min. Investment</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <DecimalInput
                        {...field}
                        value={field.value ?? ''}
                        onValueChange={(_, num) => field.onChange(num ?? 0)}
                        maxDecimals={4}
                        placeholder="0.001"
                        className="bg-bg-inset border-border-subtle font-mono pr-14"
                      />
                    </FormControl>
                    <span className="absolute right-3 top-2.5 text-xs font-mono text-text-tertiary">SOL</span>
                  </div>
                  <p className="text-[10px] text-text-tertiary">Protocol min: $0.01 USD</p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="lockupPeriodValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs text-text-secondary">Lockup Period</FormLabel>
                  <div className="flex gap-2">
                    <FormControl>
                      <DecimalInput
                        {...field}
                        value={field.value ?? ''}
                        onValueChange={(_, num) => field.onChange(num ?? 0)}
                        maxDecimals={0}
                        placeholder="0"
                        className="bg-bg-inset border-border-subtle font-mono flex-1"
                      />
                    </FormControl>

                    <select
                      value={lockupPeriodUnit}
                      onChange={(e) => onLockupPeriodUnitChange(e.target.value as LockupPeriodUnit)}
                      className="rounded-lg border border-border-subtle bg-bg-inset px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-primary-coral cursor-pointer"
                    >
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-text-tertiary">Maximum 45 days lockup duration</p>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="space-y-4 pt-2">
          <h3 className="text-xs font-semibold text-text-secondary uppercase tracking-wider border-b border-border-subtle/50 pb-1.5 flex items-center gap-1.5">
            <Percent className="size-3.5 text-primary-coral" />
            Fee Structure
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={control}
              name="managementFeePercent"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between">
                    <FormLabel className="text-xs text-text-secondary">Management Fee (% / Year)</FormLabel>
                    <span className="text-[10px] text-text-tertiary font-mono">Max: 15%</span>
                  </div>
                  <div className="relative">
                    <FormControl>
                      <DecimalInput
                        {...field}
                        value={field.value ?? ''}
                        onValueChange={(_, num) => field.onChange(num ?? 0)}
                        maxDecimals={2}
                        placeholder="0.0"
                        className="bg-bg-inset border-border-subtle font-mono pr-16"
                      />
                    </FormControl>
                    <span className="absolute right-3 top-2.5 text-xs font-sans text-text-tertiary">/ Year</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={control}
              name="performanceFeePercent"
              render={({ field }) => (
                <FormItem>
                  <div className="flex justify-between">
                    <FormLabel className="text-xs text-text-secondary">Performance Fee (% on Profit)</FormLabel>
                    <span className="text-[10px] text-text-tertiary font-mono">Max: 20%</span>
                  </div>
                  <div className="relative">
                    <FormControl>
                      <DecimalInput
                        {...field}
                        value={field.value ?? ''}
                        onValueChange={(_, num) => field.onChange(num ?? 0)}
                        maxDecimals={2}
                        placeholder="0.0"
                        className="bg-bg-inset border-border-subtle font-mono pr-20"
                      />
                    </FormControl>
                    <span className="absolute right-3 top-2.5 text-xs font-sans text-text-tertiary">On Profit</span>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-1.5">
            <FormLabel className="text-xs text-text-secondary">Fee Withdrawal Period</FormLabel>
            <div className="flex rounded-xl bg-bg-inset p-1 border border-border-subtle">
              {FEE_WITHDRAWAL_PERIODS.map((period) => (
                <button
                  key={period}
                  type="button"
                  onClick={() => onSetFeeWithdrawalPeriod(period)}
                  className={cn(
                    'flex-1 py-2 text-xs font-medium capitalize rounded-lg transition-all cursor-pointer',
                    feeWithdrawalPeriod === period
                      ? 'bg-primary-coral text-white font-semibold shadow-sm'
                      : 'text-text-tertiary hover:text-text-primary'
                  )}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
