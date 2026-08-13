import type { Control } from 'react-hook-form'
import { Shield } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { Checkbox } from '@/components/ui/checkbox'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import type { CreateVaultFormValues } from '@/validations/vault'

export interface AgreementSectionProps {
  control: Control<CreateVaultFormValues>
}

export function AgreementSection({ control }: AgreementSectionProps) {
  return (
    <SectionCard
      icon={<Shield className="size-4 text-primary-coral" />}
      title="05. Agreement"
      description="Review protocol rules and accept terms before creating on-chain vault."
    >
      <div className="space-y-4">
        <FormField
          control={control}
          name="agreedToTerms"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  className="mt-0.5 data-[state=checked]:bg-primary-coral data-[state=checked]:border-primary-coral"
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel className="text-xs text-text-secondary cursor-pointer">
                  I agree and accept the{' '}
                  <a href="#terms" className="text-primary-coral hover:underline font-semibold">
                    Terms and Conditions
                  </a>{' '}
                  for creating a Flux Solana vault.
                </FormLabel>
                <FormMessage />
              </div>
            </FormItem>
          )}
        />
        <div id="terms" className="rounded-xl border border-border-subtle/80 bg-bg-inset/40 p-3 text-[11px] text-text-tertiary leading-relaxed">
          <p className="font-semibold text-text-secondary mb-1">Terms & Conditions</p>
          By creating a vault on Flux Protocol, you confirm that you are responsible for managing the vault's trading strategy, complying with applicable regulations, and providing accurate disclosure to potential investors. Flux Protocol is non-custodial and disclaims liability for market losses.
        </div>
      </div>
    </SectionCard>
  )
}
