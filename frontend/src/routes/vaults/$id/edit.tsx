import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
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
import { generateMetadata } from '@/lib/metadata'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { PageHeader } from '@/components/ui/PageHeader'
import { SectionCard } from '@/components/ui/SectionCard'
import { HeroAmbient } from '@/components/ui/HeroAmbient'
import { SweepButton } from '@/components/ui/SweepButton'
import { AddressPill } from '@/components/ui/AddressPill'
import { editVaultSchema, type EditVaultForm } from '@/validations/vault'
import {
  Edit3,
  Check,
  Loader2,
  Sparkles,
  Tag,
  Layers,
  AlignLeft,
  Upload,
  CheckCircle2,
  X,
  ImageIcon,
  Shield,
  ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/vaults/$id/edit')({
  head: ({ params }) => ({
    meta: generateMetadata({
      title: `Edit Vault ${params.id}`,
      description: `Update display metadata, focus assets, and parameters for vault ${params.id}.`,
      path: `/vaults/${params.id}/edit`,
      noIndex: true,
    }),
  }),
  component: EditVaultPage,
})

export function EditVaultPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''

  const { data: currentVault, isLoading, isError } = useVaultDetailQuery(id)
  const updateMetadataMutation = useUpdateVaultMetadataMutation()
  const config = useConfigStore((s) => s.config)
  const fetchConfig = useConfigStore((s) => s.fetchConfig)

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)

  const form = useForm<EditVaultForm>({
    resolver: zodResolver(editVaultSchema),
    defaultValues: {
      displayName: '',
      description: '',
      coverImageUrl: '',
      focusAssets: [],
      tags: '',
    },
  })

  const { handleSubmit, setValue, watch, formState: { isSubmitting, isDirty } } = form

  const selectedAssets = watch('focusAssets')
  const selectedAssetsSet = useMemo(() => new Set(selectedAssets ?? []), [selectedAssets])
  const description = watch('description') || ''

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  useEffect(() => {
    if (currentVault?.id === id && currentVault.metadata) {
      setValue('displayName', currentVault.metadata.displayName || '')
      setValue('description', currentVault.metadata.description || '')
      setValue('focusAssets', currentVault.metadata.focusAssets || [])
      if (currentVault.metadata.coverImageUrl) {
        setImagePreview(currentVault.metadata.coverImageUrl)
        setValue('coverImageUrl', currentVault.metadata.coverImageUrl)
      }
      if (currentVault.metadata.tags && Array.isArray(currentVault.metadata.tags)) {
        setValue('tags', currentVault.metadata.tags.join(', '))
      }
    }
  }, [currentVault, id, setValue])

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('File size exceeds 5MB limit')
        return
      }
      setImageName(file.name)
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setImagePreview(base64)
        setValue('coverImageUrl', base64, { shouldDirty: true })
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    setImageName(null)
    setValue('coverImageUrl', '', { shouldDirty: true })
  }

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
          ...(data.coverImageUrl ? { coverImageUrl: data.coverImageUrl } : {}),
          focusAssets: data.focusAssets,
          ...(data.tags
            ? {
                tags: data.tags
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              }
            : {}),
        },
      })
      navigate({ to: '/vaults/$id', params: { id } })
    } catch {
      // error handled by mutation
    }
  }

  const isOwner = Boolean(
    walletAddress &&
    currentVault?.managerAddress &&
    walletAddress.toLowerCase() === currentVault.managerAddress.toLowerCase()
  )

  if (isLoading) {
    return (
      <div className="space-y-6 relative w-full">
        <HeroAmbient />
        <PageHeader
          title="Edit Vault"
          subtitle="Loading vault details..."
          backTo={`/vaults/${id}`}
        />
        <SectionCard
          icon={<Edit3 className="size-4 text-primary-coral" />}
          title="Vault Metadata & Configuration"
          description="Loading vault details..."
        >
          <div className="space-y-4 py-6">
            <div className="h-10 w-full animate-pulse rounded-xl bg-bg-inset" />
            <div className="h-24 w-full animate-pulse rounded-xl bg-bg-inset" />
            <div className="h-10 w-full animate-pulse rounded-xl bg-bg-inset" />
          </div>
        </SectionCard>
      </div>
    )
  }

  if (isError || !currentVault || !currentVault.id) {
    return (
      <div className="space-y-6 relative w-full">
        <HeroAmbient />
        <PageHeader
          title="Vault Not Found"
          subtitle={`Vault ${id} could not be loaded.`}
          backTo="/vaults"
        />
        <SectionCard
          icon={<Layers className="size-4 text-primary-coral" />}
          title="Vault Unavailable"
          description="The requested vault could not be found."
        >
          <div className="flex h-48 flex-col items-center justify-center text-center space-y-3">
            <p className="text-sm text-text-secondary">This vault does not exist or network connection is offline.</p>
            <Link to="/vaults">
              <Button variant="outline" size="sm" className="gap-1.5">
                <ArrowLeft className="size-3.5" /> Back to All Vaults
              </Button>
            </Link>
          </div>
        </SectionCard>
      </div>
    )
  }

  if (!isOwner) {
    return (
      <div className="space-y-6 relative w-full">
        <HeroAmbient />
        <PageHeader
          title="Access Denied"
          subtitle="Only the vault manager is authorized to edit vault settings."
          backTo={`/vaults/${id}`}
        />
        <SectionCard
          icon={<Shield className="size-4 text-status-error" />}
          title="Unauthorized Access"
          description="You do not have permission to configure this vault."
        >
          <div className="flex flex-col items-center justify-center text-center space-y-4 py-8">
            <div className="rounded-full bg-status-error/10 p-4 border border-status-error/20">
              <Shield className="size-8 text-status-error" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold text-text-primary">Manager Wallet Required</h3>
              <p className="text-xs text-text-secondary max-w-md">
                This vault is managed by{' '}
                <span className="font-mono text-text-primary font-semibold">
                  {currentVault.managerAddress ? (
                    <AddressPill address={currentVault.managerAddress} />
                  ) : (
                    'Unknown Manager'
                  )}
                </span>
                .
                {!walletAddress
                  ? ' Please connect your manager wallet to continue.'
                  : ' Your connected wallet is not the designated manager of this vault.'}
              </p>
            </div>
            <Link to="/vaults/$id" params={{ id }}>
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="size-4" /> Back to Vault Overview
              </Button>
            </Link>
          </div>
        </SectionCard>
      </div>
    )
  }

  const displayNameValue = watch('displayName') || currentVault?.metadata?.displayName || `Vault ${id.slice(0, 8)}`

  return (
    <div className="space-y-6 relative w-full">
      <HeroAmbient />

      <PageHeader
        title={`Edit ${displayNameValue}`}
        subtitle="Modify display metadata, investment strategy, branding, and whitelist focus assets."
        backTo={`/vaults/${id}`}
      />

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <SectionCard
            icon={<Edit3 className="size-4 text-primary-coral" />}
            title="Vault Metadata & Configuration"
            description="Custom branding, strategy narrative, tags, and tradable asset universe."
          >
            <div className="space-y-5">
              {/* Display Name Field */}
              <FormField
                control={form.control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                      <Sparkles className="size-3.5 text-primary-coral" />
                      Display Name
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g. Solana High Yield Alpha"
                        className="bg-bg-inset/60 border-border-subtle focus:border-primary-coral/60 transition-colors font-medium"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px] text-text-tertiary">
                      The public name shown across the vault leaderboard and discovery directory.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Description Field */}
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                        <AlignLeft className="size-3.5 text-primary-gold" />
                        Description
                      </FormLabel>
                      <span className="text-[11px] font-mono text-text-tertiary">
                        {description.length} / 500
                      </span>
                    </div>
                    <FormControl>
                      <Textarea
                        rows={3}
                        maxLength={500}
                        placeholder="Detail your trading thesis, rebalancing frequency, and risk management parameters..."
                        className="bg-bg-inset/60 border-border-subtle focus:border-primary-coral/60 transition-colors resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px] text-text-tertiary">
                      Explain your fund strategy to potential investors.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Cover Image Upload / Preview */}
              <div>
                <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary mb-2">
                  <ImageIcon className="size-3.5 text-status-info" />
                  Cover Image
                </FormLabel>
                {imagePreview ? (
                  <div className="relative rounded-xl border border-border-subtle overflow-hidden bg-bg-inset/50 p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={imagePreview}
                        alt="Cover preview"
                        className="size-14 rounded-lg object-cover border border-border-subtle shadow-sm"
                      />
                      <div>
                        <p className="text-xs font-medium text-text-primary truncate max-w-xs">
                          {imageName || 'Current cover image'}
                        </p>
                        <p className="text-[10px] text-status-success flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="size-3" /> Image active
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="text-xs text-status-error hover:bg-status-error/10 hover:text-status-error gap-1 font-semibold cursor-pointer"
                    >
                      <X className="size-3.5" />
                      Remove
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-border-subtle hover:border-primary-coral/50 bg-bg-inset/30 hover:bg-bg-inset/60 rounded-xl p-6 cursor-pointer transition-colors group">
                    <div className="flex size-10 items-center justify-center rounded-full bg-bg-elevated text-text-tertiary group-hover:text-primary-coral mb-2 transition-colors">
                      <Upload className="size-5" />
                    </div>
                    <p className="text-xs font-medium text-text-primary">Click to upload cover image</p>
                    <p className="text-[10px] text-text-tertiary mt-1">PNG, JPG or WebP (max 5MB)</p>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>

              {/* Focus Assets Selector */}
              <FormField
                control={form.control}
                name="focusAssets"
                render={() => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                      <Layers className="size-3.5 text-status-success" />
                      Focus Assets
                    </FormLabel>
                    <FormDescription className="text-[11px] text-text-tertiary">
                      Select target trading assets from the configured Solana whitelist.
                    </FormDescription>
                    <FormControl>
                      <div role="group" aria-label="Focus Assets" className="mt-2 flex flex-wrap gap-2.5">
                        {(config?.focusAssetsWhitelist ?? []).map((asset) => {
                          const selected = selectedAssetsSet.has(asset)
                          return (
                            <button
                              key={asset}
                              type="button"
                              onClick={() => toggleAsset(asset)}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs font-medium font-mono transition-all border select-none',
                                selected
                                  ? 'bg-primary-coral/20 text-text-primary border-primary-coral/50 shadow-[0_0_12px_rgba(255,107,53,0.25)]'
                                  : 'bg-bg-inset/60 text-text-secondary border-white/8 hover:border-white/20 hover:text-text-primary'
                              )}
                            >
                              <TokenIcon symbol={asset} alt="" className="size-4" />
                              <span className="font-semibold">{asset}</span>
                              {selected && <Check className="size-3.5 text-primary-coral" />}
                            </button>
                          )
                        })}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Tags Field */}
              <FormField
                control={form.control}
                name="tags"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                      <Tag className="size-3.5 text-status-info" />
                      Tags (comma-separated)
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g. defi, yield, momentum, algorithmic"
                        className="bg-bg-inset/60 border-border-subtle focus:border-primary-coral/60 transition-colors font-mono text-xs"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-[11px] text-text-tertiary">
                      Add relevant keywords for search filtering and categorization.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Action Buttons Footer */}
            <div className="flex items-center justify-end gap-3 pt-4 mt-6 border-t border-border-subtle/50">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate({ to: '/vaults/$id', params: { id } })}
                className="h-9 px-4 text-xs font-medium"
              >
                Cancel
              </Button>
              <SweepButton
                type="submit"
                disabled={isSubmitting || !isDirty}
                className="h-9 text-xs font-semibold"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-1.5">
                    <Loader2 className="size-3.5 animate-spin" /> Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </SweepButton>
            </div>
          </SectionCard>
        </form>
      </Form>
    </div>
  )
}
