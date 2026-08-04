import { useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useVaultStore, useConfigStore } from '@/stores'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'

const editVaultSchema = z.object({
  displayName: z.string().min(1, 'Display name is required').max(64),
  description: z.string().max(500).optional(),
  focusAssets: z.array(z.string()).min(1, 'Select at least one asset'),
  tags: z.string().optional(),
})

type EditVaultForm = z.infer<typeof editVaultSchema>

export const Route = createFileRoute('/vaults/$id/edit')({ component: EditVaultPage })

function EditVaultPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const currentVault = useVaultStore((s) => s.currentVault)
  const fetchVaultById = useVaultStore((s) => s.fetchVaultById)
  const updateVaultMetadata = useVaultStore((s) => s.updateVaultMetadata)
  const config = useConfigStore((s) => s.config)
  const fetchConfig = useConfigStore((s) => s.fetchConfig)

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<EditVaultForm>({
    resolver: zodResolver(editVaultSchema),
    defaultValues: {
      displayName: '',
      description: '',
      focusAssets: [],
      tags: '',
    },
  })

  const selectedAssets = watch('focusAssets')
  const selectedAssetsSet = useMemo(() => new Set(selectedAssets ?? []), [selectedAssets])

  useEffect(() => {
    fetchVaultById(id)
    fetchConfig()
  }, [id, fetchVaultById, fetchConfig])

  useEffect(() => {
    if (currentVault?.id === id) {
      setValue('displayName', currentVault.metadata.displayName)
      setValue('description', currentVault.metadata.description)
      setValue('focusAssets', currentVault.metadata.focusAssets)
    }
  }, [currentVault, id, setValue])

  const toggleAsset = (asset: string) => {
    const current = selectedAssets || []
    const next = current.includes(asset)
      ? current.filter((a) => a !== asset)
      : [...current, asset]
    setValue('focusAssets', next, { shouldDirty: true })
  }

  const onSubmit = async (data: EditVaultForm) => {
    try {
      await updateVaultMetadata(id, {
        displayName: data.displayName,
        description: data.description ?? '',
        focusAssets: data.focusAssets,
      })
      navigate({ to: '/vaults/$id', params: { id } })
    } catch {
      // error handled by store
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Edit Vault {id.slice(0, 8)}</h1>
        <p className="mt-2 text-text-secondary">Modify vault configuration and parameters.</p>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-5 rounded-2xl border border-border-subtle bg-bg-elevated p-6"
      >
        <div>
          <Label htmlFor="display-name">Display Name</Label>
          <Input id="display-name" type="text" {...register('displayName')} />
          {errors.displayName && (
            <p className="mt-1 text-xs text-status-error">{errors.displayName.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" rows={3} {...register('description')} />
        </div>

        <div>
          <span id="focus-assets-label" className="block text-sm font-medium text-text-secondary">Focus Assets</span>
          <p className="mt-0.5 text-xs text-text-tertiary">Select from the configured whitelist.</p>
          <div role="group" aria-labelledby="focus-assets-label" className="mt-2 flex flex-wrap gap-2">
              {(config?.focusAssetsWhitelist ?? []).map((asset) => {
              const selected = selectedAssetsSet.has(asset)
              return (
                <Button
                  key={asset}
                  type="button"
                  variant={selected ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => toggleAsset(asset)}
                >
                  {asset}
                </Button>
              )
            })}
          </div>
          {errors.focusAssets && (
            <p className="mt-1 text-xs text-status-error">{errors.focusAssets.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="tags">Tags (comma-separated)</Label>
          <Input id="tags" type="text" {...register('tags')} placeholder="e.g. defi, stablecoin, yield" />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate({ to: '/vaults/$id', params: { id } })}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="default"
            disabled={isSubmitting || !isDirty}
          >
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </div>
  )
}
