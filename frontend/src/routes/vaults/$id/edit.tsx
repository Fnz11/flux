import { useEffect, useMemo } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useConfigStore } from '@/stores'
import { useVaultDetailQuery, useUpdateVaultMetadataMutation } from '@/services/hooks'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

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
  const { data: currentVault } = useVaultDetailQuery(id)
  const updateMetadataMutation = useUpdateVaultMetadataMutation()
  const config = useConfigStore((s) => s.config)
  const fetchConfig = useConfigStore((s) => s.fetchConfig)

  const form = useForm<EditVaultForm>({
    resolver: zodResolver(editVaultSchema),
    defaultValues: {
      displayName: '',
      description: '',
      focusAssets: [],
      tags: '',
    },
  })

  const { handleSubmit, setValue, watch, formState: { isSubmitting, isDirty } } = form

  const selectedAssets = watch('focusAssets')
  const selectedAssetsSet = useMemo(() => new Set(selectedAssets ?? []), [selectedAssets])

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

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
      await updateMetadataMutation.mutateAsync({
        id,
        metadata: {
          displayName: data.displayName,
          description: data.description ?? '',
          focusAssets: data.focusAssets,
        },
      })
      navigate({ to: '/vaults/$id', params: { id } })
    } catch {
      // error handled by mutation
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">Edit Vault {id.slice(0, 8)}</h1>
        <p className="mt-2 text-text-secondary">Modify vault configuration and parameters.</p>
      </div>

      <Form {...form}>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-5 rounded-xl border border-border-subtle bg-bg-elevated p-6"
        >
          <FormField
            control={form.control}
            name="displayName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Display Name</FormLabel>
                <FormControl>
                  <Input type="text" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea rows={3} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="focusAssets"
            render={() => (
              <FormItem>
                <FormLabel>Focus Assets</FormLabel>
                <FormDescription>Select from the configured whitelist.</FormDescription>
                <FormControl>
                  <div role="group" aria-label="Focus Assets" className="mt-2 flex flex-wrap gap-2">
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
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="tags"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tags (comma-separated)</FormLabel>
                <FormControl>
                  <Input type="text" placeholder="e.g. defi, stablecoin, yield" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
      </Form>
    </div>
  )
}
