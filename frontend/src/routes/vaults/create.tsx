import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { useCreateVault } from './_hooks/useCreateVault'

const createVaultSchema = z.object({
  minRaiseAmount: z.number().min(0, 'Min raise must be ≥ 0'),
  performanceFee: z.number().min(0).max(10000, 'Max 10000 BPS (100%)'),
  managementFee: z.number().min(0).max(10000, 'Max 10000 BPS (100%)'),
  lockupPeriod: z.number().int().min(0, 'Lockup must be ≥ 0 days'),
})

type CreateVaultForm = z.infer<typeof createVaultSchema>

export const Route = createFileRoute('/vaults/create')({ component: CreateVaultPage })

function CreateVaultPage() {
  const navigate = useNavigate()
  const { handleSubmit: onSubmit, isPending } = useCreateVault()

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateVaultForm>({
    resolver: zodResolver(createVaultSchema),
    defaultValues: {
      minRaiseAmount: 0,
      performanceFee: 0,
      managementFee: 0,
      lockupPeriod: 0,
    },
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Create Vault</h1>
        <p className="mt-2 text-text-secondary">Configure a new Solana investment vault.</p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-2xl border border-border-subtle bg-bg-elevated p-6"
      >
        <div>
          <Label htmlFor="min-raise">Min Raise Amount (SOL)</Label>
          <Input
            id="min-raise"
            type="number"
            step="any"
            {...register('minRaiseAmount', { valueAsNumber: true })}
          />
          {errors.minRaiseAmount && (
            <p className="mt-1 text-xs text-status-error">{errors.minRaiseAmount.message}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="perf-fee">Performance Fee (BPS)</Label>
            <Input
              id="perf-fee"
              type="number"
              {...register('performanceFee', { valueAsNumber: true })}
            />
            {errors.performanceFee && (
              <p className="mt-1 text-xs text-status-error">{errors.performanceFee.message}</p>
            )}
          </div>
          <div>
            <Label htmlFor="mgmt-fee">Management Fee (BPS)</Label>
            <Input
              id="mgmt-fee"
              type="number"
              {...register('managementFee', { valueAsNumber: true })}
            />
            {errors.managementFee && (
              <p className="mt-1 text-xs text-status-error">{errors.managementFee.message}</p>
            )}
          </div>
        </div>

        <div>
          <Label htmlFor="lockup">Lockup Period (days)</Label>
          <Input
            id="lockup"
            type="number"
            {...register('lockupPeriod', { valueAsNumber: true })}
          />
          {errors.lockupPeriod && (
            <p className="mt-1 text-xs text-status-error">{errors.lockupPeriod.message}</p>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/vaults' })}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={isSubmitting || isPending}
          >
            {isSubmitting ? 'Creating...' : 'Create Vault'}
          </Button>
        </div>
      </form>
    </div>
  )
}
