import { useState, useCallback } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { useCreateVault, type CreateVaultParams } from './_hooks/useCreateVault'
import { usePythPrice } from '@/hooks/usePythPrice'
import {
  Globe,
  Lock,
  Upload,
  X,
  CheckCircle2,
  Percent,
  Clock,
  ArrowLeft,
  Sparkles,
  Activity,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const createVaultSchema = z.object({
  vaultType: z.enum(['open', 'closed']),
  displayName: z.string().min(2, 'Display name must be at least 2 characters').max(50, 'Max 50 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters').max(500, 'Max 500 characters'),
  coverImageUrl: z.string().optional(),
  minRaiseAmount: z.number().min(0, 'Min raise must be ≥ 0'),
  minRaiseUnit: z.enum(['SOL', 'USDC', 'USDT']),
  acceptedAssets: z.array(z.string()).min(1, 'Select at least one accepted asset'),
  minInvestment: z.number().min(0.001, 'Min investment must be ≥ 0.001'),
  lockupPeriodValue: z.number().min(0, 'Lockup period must be ≥ 0'),
  lockupPeriodUnit: z.enum(['hours', 'days']),
  managementFeePercent: z.number().min(0, 'Min 0%').max(15, 'Management fee cannot exceed 15%'),
  feeWithdrawalPeriod: z.enum(['weekly', 'monthly', 'quarterly', 'yearly']),
  performanceFeePercent: z.number().min(0, 'Min 0%').max(20, 'Performance fee cannot exceed 20%'),
  agreedToTerms: z.boolean().refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),
})

type CreateVaultFormValues = z.infer<typeof createVaultSchema>

export const Route = createFileRoute('/vaults/create')({ component: CreateVaultPage })

export function CreateVaultPage() {
  const navigate = useNavigate()
  const { handleSubmit: submitVault, isPending } = useCreateVault()
  const solPriceState = usePythPrice('SOL/USD')
  const solPrice = solPriceState.status === 'live' || solPriceState.status === 'stale' ? solPriceState.price : 150

  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [imageName, setImageName] = useState<string | null>(null)

  const form = useForm<CreateVaultFormValues>({
    resolver: zodResolver(createVaultSchema),
    defaultValues: {
      vaultType: 'open',
      displayName: '',
      description: '',
      coverImageUrl: '',
      minRaiseAmount: 10,
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
  const minRaiseAmount = watch('minRaiseAmount') || 0
  const minRaiseUnit = watch('minRaiseUnit')
  const acceptedAssets = watch('acceptedAssets') || []
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
        alert('File size exceeds 5MB limit')
        return
      }
      setImageName(file.name)
      const reader = new FileReader()
      reader.onloadend = () => {
        const base64 = reader.result as string
        setImagePreview(base64)
        setValue('coverImageUrl', base64)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleRemoveImage = () => {
    setImagePreview(null)
    setImageName(null)
    setValue('coverImageUrl', '')
  }

  const toggleAsset = (asset: string) => {
    const current = [...acceptedAssets]
    if (current.includes(asset)) {
      if (current.length === 1) return // Prevent removing last asset
      setValue('acceptedAssets', current.filter((a) => a !== asset), { shouldValidate: true })
    } else {
      setValue('acceptedAssets', [...current, asset], { shouldValidate: true })
    }
  }

  const onSubmit = async (data: CreateVaultFormValues) => {
    await submitVault(data as CreateVaultParams)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate({ to: '/vaults' })}
          className="gap-1.5 text-text-tertiary hover:text-text-primary"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <PageHeader
        title="Create Vault"
        subtitle="Configure a new Solana investment vault matching OG FBYT parameters."
      />

      <Form {...form}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* SECTION 1 — VAULT TYPE */}
          <div className="rounded-xl border border-border-subtle bg-bg-elevated/50 p-6 backdrop-blur-2xl space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary-coral/10 text-xs font-bold text-primary-coral">1</span>
                <h2 className="text-base font-semibold text-text-primary uppercase tracking-wide">Vault Type</h2>
              </div>
              <p className="mt-1 text-xs text-text-tertiary pl-8">
                Choose how investors can enter and redeem capital from your vault.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
              <div
                onClick={() => setValue('vaultType', 'open')}
                className={cn(
                  'cursor-pointer rounded-xl border p-5 transition-all relative space-y-3',
                  vaultType === 'open'
                    ? 'border-primary-coral bg-primary-coral/5 shadow-md shadow-primary-coral/5 ring-1 ring-primary-coral/40'
                    : 'border-border-subtle bg-bg-inset/60 hover:border-border-subtle/80 hover:bg-bg-inset'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-primary-coral/10 text-primary-coral">
                    <Globe className="size-5" />
                  </div>
                  {vaultType === 'open' && (
                    <CheckCircle2 className="size-5 text-primary-coral" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">Open-ended</h3>
                    <span className="text-[10px] font-medium bg-primary-coral/10 text-primary-coral px-2 py-0.5 rounded-full border border-primary-coral/20">
                      Flexible
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary leading-relaxed">
                    Investors can deposit and redeem funds at any time based on real-time net asset value (NAV).
                  </p>
                </div>
              </div>

              <div
                onClick={() => setValue('vaultType', 'closed')}
                className={cn(
                  'cursor-pointer rounded-xl border p-5 transition-all relative space-y-3',
                  vaultType === 'closed'
                    ? 'border-primary-coral bg-primary-coral/5 shadow-md shadow-primary-coral/5 ring-1 ring-primary-coral/40'
                    : 'border-border-subtle bg-bg-inset/60 hover:border-border-subtle/80 hover:bg-bg-inset'
                )}
              >
                <div className="flex items-start justify-between">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-bg-elevated text-text-tertiary border border-border-subtle">
                    <Lock className="size-5" />
                  </div>
                  {vaultType === 'closed' && (
                    <CheckCircle2 className="size-5 text-primary-coral" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-text-primary">Closed-end</h3>
                    <span className="text-[10px] font-medium bg-bg-inset text-text-tertiary px-2 py-0.5 rounded-full border border-border-subtle">
                      Fixed Term
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-text-tertiary leading-relaxed">
                    Fixed investment term. Deposits are accepted only during the fundraising window.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 — VAULT IDENTITY */}
          <div className="rounded-xl border border-border-subtle bg-bg-elevated/50 p-6 backdrop-blur-2xl space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary-coral/10 text-xs font-bold text-primary-coral">2</span>
                <h2 className="text-base font-semibold text-text-primary uppercase tracking-wide">Vault Identity</h2>
              </div>
              <p className="mt-1 text-xs text-text-tertiary pl-8">
                Define your vault's public title, strategy narrative, and branding banner.
              </p>
            </div>

            <div className="space-y-4">
              <FormField
                control={control}
                name="displayName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs text-text-secondary">Display Name</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="e.g. Solana High Yield Alpha"
                        className="bg-bg-inset border-border-subtle focus:border-primary-coral font-medium"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex justify-between items-center">
                      <FormLabel className="text-xs text-text-secondary">Strategy Description</FormLabel>
                      <span className="text-[11px] font-mono text-text-tertiary">
                        {description.length} / 500
                      </span>
                    </div>
                    <FormControl>
                      <Textarea
                        {...field}
                        rows={4}
                        maxLength={500}
                        placeholder="Describe your vault trading strategy, risk management framework, and target assets..."
                        className="bg-bg-inset border-border-subtle focus:border-primary-coral text-xs resize-none"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div>
                <FormLabel className="text-xs text-text-secondary block mb-1.5">Cover Image</FormLabel>
                {imagePreview ? (
                  <div className="relative rounded-xl border border-border-subtle overflow-hidden bg-bg-inset p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img src={imagePreview} alt="Cover preview" className="size-14 rounded-lg object-cover border border-border-subtle" />
                      <div>
                        <p className="text-xs font-medium text-text-primary truncate max-w-xs">{imageName || 'Cover image uploaded'}</p>
                        <p className="text-[10px] text-status-success flex items-center gap-1 mt-0.5">
                          <CheckCircle2 className="size-3" /> Image ready
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleRemoveImage}
                      className="text-xs text-status-error hover:bg-status-error/10 hover:text-status-error gap-1 font-semibold"
                    >
                      <X className="size-3.5" />
                      REMOVE
                    </Button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center border-2 border-dashed border-border-subtle hover:border-primary-coral/50 bg-bg-inset/40 hover:bg-bg-inset/80 rounded-xl p-6 cursor-pointer transition-colors group">
                    <div className="flex size-10 items-center justify-center rounded-full bg-bg-elevated text-text-tertiary group-hover:text-primary-coral mb-2">
                      <Upload className="size-5" />
                    </div>
                    <p className="text-xs font-medium text-text-primary">Click to upload cover image</p>
                    <p className="text-[10px] text-text-tertiary mt-1">PNG, JPG or WebP (max 5MB)</p>
                    <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 3 — BASIC CONFIGURATION */}
          <div className="rounded-xl border border-border-subtle bg-bg-elevated/50 p-6 backdrop-blur-2xl space-y-5">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary-coral/10 text-xs font-bold text-primary-coral">3</span>
                <h2 className="text-base font-semibold text-text-primary uppercase tracking-wide">Basic Configuration</h2>
              </div>
              <p className="mt-1 text-xs text-text-tertiary pl-8">
                Set minimum fundraising targets, accepted deposit assets, and live price oracle rates.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormField
                control={control}
                name="minRaiseAmount"
                render={({ field }) => (
                  <FormItem className="space-y-1.5">
                    <FormLabel className="text-xs text-text-secondary">Min. Raise Amount</FormLabel>
                    <div className="flex items-center gap-2">
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                          className="bg-bg-inset border-border-subtle font-mono text-base"
                        />
                      </FormControl>

                      <div className="flex rounded-lg bg-bg-inset p-1 border border-border-subtle">
                        {(['SOL', 'USDC', 'USDT'] as const).map((unit) => (
                          <button
                            key={unit}
                            type="button"
                            onClick={() => setValue('minRaiseUnit', unit)}
                            className={cn(
                              'px-2.5 py-1 text-xs font-mono font-medium rounded-md transition-colors',
                              minRaiseUnit === unit
                                ? 'bg-primary-coral text-white'
                                : 'text-text-tertiary hover:text-text-primary'
                            )}
                          >
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
                  {(['SOL', 'USDC', 'USDT'] as const).map((asset) => {
                    const isSelected = acceptedAssets.includes(asset)
                    return (
                      <button
                        key={asset}
                        type="button"
                        onClick={() => toggleAsset(asset)}
                        className={cn(
                          'flex-1 py-2.5 px-3 rounded-xl border text-xs font-mono font-semibold transition-all flex items-center justify-center gap-1.5',
                          isSelected
                            ? 'border-primary-coral bg-primary-coral/10 text-primary-coral'
                            : 'border-border-subtle bg-bg-inset/50 text-text-tertiary hover:text-text-primary hover:border-border-subtle/80'
                        )}
                      >
                        {isSelected && <CheckCircle2 className="size-3.5" />}
                        {asset}
                      </button>
                    )
                  })}
                </div>
                <p className="text-[11px] text-text-tertiary">Whitelisted token mints for vault deposits.</p>
              </div>
            </div>

            {/* USD RATE Oracle Display Row */}
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

          {/* SECTION 4 — ADVANCED SETTINGS */}
          <div className="rounded-xl border border-border-subtle bg-bg-elevated/50 p-6 backdrop-blur-2xl space-y-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary-coral/10 text-xs font-bold text-primary-coral">4</span>
                <h2 className="text-base font-semibold text-text-primary uppercase tracking-wide">Advanced Settings</h2>
              </div>
              <p className="mt-1 text-xs text-text-tertiary pl-8">
                Customize lockup durations, performance benchmarks, and fee structures.
              </p>
            </div>

            {/* Subsection A: Investment Parameters */}
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
                          <Input
                            type="number"
                            step="any"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                          <Input
                            type="number"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                            className="bg-bg-inset border-border-subtle font-mono flex-1"
                          />
                        </FormControl>

                        <select
                          value={watch('lockupPeriodUnit')}
                          onChange={(e) => setValue('lockupPeriodUnit', e.target.value as 'hours' | 'days')}
                          className="rounded-lg border border-border-subtle bg-bg-inset px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-primary-coral"
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

            {/* Subsection B: Fee Structure */}
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
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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
                          <Input
                            type="number"
                            step="0.5"
                            {...field}
                            onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
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

              {/* Fee Withdrawal Period Segmented Control */}
              <div className="space-y-1.5">
                <FormLabel className="text-xs text-text-secondary">Fee Withdrawal Period</FormLabel>
                <div className="flex rounded-xl bg-bg-inset p-1 border border-border-subtle">
                  {(['weekly', 'monthly', 'quarterly', 'yearly'] as const).map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={() => setValue('feeWithdrawalPeriod', period)}
                      className={cn(
                        'flex-1 py-2 text-xs font-medium capitalize rounded-lg transition-all',
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

          {/* SECTION 5 — AGREEMENT */}
          <div className="rounded-xl border border-border-subtle bg-bg-elevated/50 p-6 backdrop-blur-2xl space-y-4">
            <div className="flex items-center gap-2">
              <span className="flex size-6 items-center justify-center rounded-full bg-primary-coral/10 text-xs font-bold text-primary-coral">5</span>
              <h2 className="text-base font-semibold text-text-primary uppercase tracking-wide">Agreement</h2>
            </div>

            <FormField
              control={control}
              name="agreedToTerms"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 pl-8">
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
                      for creating an FBYT Solana vault.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />
          </div>

          {/* CREATE VAULT CTA */}
          <div className="pt-2">
            <Button
              type="submit"
              variant="sweep"
              size="lg"
              className="w-full text-base font-bold py-6 shadow-lg shadow-primary-coral/20"
              disabled={isPending || !agreedToTerms}
            >
              {isPending ? (
                <span className="flex items-center gap-2">
                  <Activity className="size-4 animate-spin" />
                  Creating Vault on Solana...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Sparkles className="size-5" />
                  CREATE VAULT
                </span>
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
