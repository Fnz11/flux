import { useState, useCallback, useEffect } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useWallet } from '@solana/wallet-adapter-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Form } from '@/components/ui/form'
import { PageHeader } from '@/components/ui/PageHeader'
import { WalletPrompt } from '@/components/ui/WalletPrompt'
import { HeroAmbient } from '@/components/ui/HeroAmbient'
import { useCreateVault, type CreateVaultParams } from './_hooks/useCreateVault'
import { usePythPrice } from '@/hooks/usePythPrice'
import { useConfigStore } from '@/stores'
import { generateMetadata } from '@/lib/metadata'
import { createVaultSchema, type CreateVaultFormValues } from '@/validations/vault'
import { DEFAULT_FOCUS_ASSETS_WHITELIST } from '@/constants/tokens'
import { toastError } from '@/lib/toast'
import { VaultTypeSection } from './create/_components/VaultTypeSection'
import { VaultIdentitySection } from './create/_components/VaultIdentitySection'
import { BasicConfigSection } from './create/_components/BasicConfigSection'
import { AdvancedSettingsSection } from './create/_components/AdvancedSettingsSection'
import { AgreementSection } from './create/_components/AgreementSection'
import { CreateVaultSubmit } from './create/_components/CreateVaultSubmit'

export const Route = createFileRoute('/vaults/create')({
  head: () => ({
    meta: generateMetadata({
      title: 'Create Vault',
      description: 'Launch a new non-custodial Solana vault with customized fee structures, lockups, and accepted assets.',
      path: '/vaults/create',
      noIndex: true,
    }),
  }),
  component: CreateVaultPage,
})

export function CreateVaultPage() {
  const wallet = useWallet()
  const walletAddress = wallet.publicKey?.toBase58() ?? ''
  const { handleSubmit: submitVault, isPending } = useCreateVault()
  const solPriceState = usePythPrice('SOL/USD')
  const solPrice = solPriceState.status === 'live' || solPriceState.status === 'stale' ? solPriceState.price : 150

  const config = useConfigStore((s) => s.config)
  const fetchConfig = useConfigStore((s) => s.fetchConfig)

  useEffect(() => {
    fetchConfig()
  }, [fetchConfig])

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)

  const form = useForm<CreateVaultFormValues>({
    resolver: zodResolver(createVaultSchema),
    defaultValues: {
      vaultType: 'open',
      displayName: '',
      description: '',
      coverImageUrl: '',
      focusAssets: [...DEFAULT_FOCUS_ASSETS_WHITELIST],
      tags: [],
      minRaiseAmount: 1,
      minRaiseUnit: 'SOL',
      acceptedAssets: ['SOL', 'USDC', 'USDT'],
      minInvestment: 0.01,
      lockupPeriodValue: 7,
      lockupPeriodUnit: 'days',
      managementFeePercent: 2,
      feeWithdrawalPeriod: 'weekly',
      performanceFeePercent: 10,
      agreedToTerms: false,
    },
  })

  const { control, handleSubmit, watch, setValue } = form

  const vaultType = watch('vaultType')
  const description = watch('description') || ''
  const focusAssets = watch('focusAssets') || []
  const tags = watch('tags') || []
  const minRaiseAmount = watch('minRaiseAmount') || 0
  const minRaiseUnit = watch('minRaiseUnit')
  const acceptedAssets = watch('acceptedAssets') || []
  const lockupPeriodUnit = watch('lockupPeriodUnit')
  const feeWithdrawalPeriod = watch('feeWithdrawalPeriod')
  const agreedToTerms = watch('agreedToTerms')

  // Calculate approximate USD raise amount
  const getUnitUsdRate = useCallback(
    (unit: string) => {
      if (unit === 'SOL') return solPrice
      return 1 // USDC, USDT
    },
    [solPrice],
  )

  const minRaiseUsd = minRaiseAmount * getUnitUsdRate(minRaiseUnit)

  // Handle Cover Image Upload
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toastError('File size exceeds 5MB limit')
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

  const toggleAcceptedAsset = (asset: string) => {
    const current = [...acceptedAssets]
    if (current.includes(asset)) {
      if (current.length === 1) return // Prevent removing last asset
      setValue('acceptedAssets', current.filter((a) => a !== asset), { shouldValidate: true })
    } else {
      setValue('acceptedAssets', [...current, asset], { shouldValidate: true })
    }
  }

  const toggleFocusAsset = (asset: string) => {
    const current = [...focusAssets]
    if (current.includes(asset)) {
      setValue('focusAssets', current.filter((a) => a !== asset), { shouldValidate: true, shouldDirty: true })
    } else {
      if (current.length >= 100) {
        toastError('You can only select up to 100 focus assets per vault.')
        return
      }
      setValue('focusAssets', [...current, asset], { shouldValidate: true, shouldDirty: true })
    }
  }

  const handleAddTag = (newTag: string) => {
    const trimmed = newTag.trim().toLowerCase()
    if (!trimmed) return
    if (!tags.some((t) => t.toLowerCase() === trimmed)) {
      setValue('tags', [...tags, trimmed], { shouldValidate: true, shouldDirty: true })
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setValue(
      'tags',
      tags.filter((t) => t.toLowerCase() !== tagToRemove.toLowerCase()),
      { shouldValidate: true, shouldDirty: true }
    )
  }

  const onSubmit = async (data: CreateVaultFormValues) => {
    await submitVault(data as CreateVaultParams)
  }

  return (
    <div className="space-y-6 pb-12 w-full relative">
      <HeroAmbient />

      <PageHeader
        title="Create Vault"
        subtitle="Configure a new Solana investment vault with custom parameters."
        backTo="/vaults"
      />

      {!walletAddress ? (
        <WalletPrompt description="Please connect your wallet to create and manage investment vaults." />
      ) : (
        <div className="max-w-4xl mx-auto space-y-4">
          <Form {...form}>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* SECTION 1 — VAULT TYPE */}
              <VaultTypeSection value={vaultType} onSelect={(type) => setValue('vaultType', type)} />

              {/* SECTION 2 — VAULT IDENTITY & METADATA (with Focus Assets Combobox & Tags Badges) */}
              <VaultIdentitySection
                control={control}
                description={description}
                imagePreview={imagePreview}
                imageName={imageName}
                onImageUpload={handleImageUpload}
                onRemoveImage={handleRemoveImage}
                focusAssetsWhitelist={config?.focusAssetsWhitelist || DEFAULT_FOCUS_ASSETS_WHITELIST}
                focusAssets={focusAssets}
                onToggleFocusAsset={toggleFocusAsset}
                tags={tags}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
              />

              {/* SECTION 3 — BASIC CONFIGURATION */}
              <BasicConfigSection
                control={control}
                minRaiseUnit={minRaiseUnit}
                acceptedAssets={acceptedAssets}
                solPrice={solPrice}
                minRaiseUsd={minRaiseUsd}
                onSetMinRaiseUnit={(unit) => setValue('minRaiseUnit', unit)}
                onToggleAsset={toggleAcceptedAsset}
              />

              {/* SECTION 4 — ADVANCED SETTINGS */}
              <AdvancedSettingsSection
                control={control}
                lockupPeriodUnit={lockupPeriodUnit}
                feeWithdrawalPeriod={feeWithdrawalPeriod}
                onLockupPeriodUnitChange={(unit) => setValue('lockupPeriodUnit', unit)}
                onSetFeeWithdrawalPeriod={(period) => setValue('feeWithdrawalPeriod', period)}
              />

              {/* SECTION 5 — AGREEMENT */}
              <AgreementSection control={control} />

              {/* CREATE VAULT CTA */}
              <CreateVaultSubmit isPending={isPending} agreedToTerms={agreedToTerms} />
            </form>
          </Form>
        </div>
      )}
    </div>
  )
}
