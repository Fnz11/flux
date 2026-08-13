import React from 'react'
import type { Control } from 'react-hook-form'
import { Layers, CheckCircle2, X, Upload } from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form'
import type { CreateVaultFormValues } from '@/validations/vault'

export interface VaultIdentitySectionProps {
  control: Control<CreateVaultFormValues>
  description: string
  imagePreview: string | null
  imageName: string | null
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: () => void
}

export function VaultIdentitySection({
  control,
  description,
  imagePreview,
  imageName,
  onImageUpload,
  onRemoveImage,
}: VaultIdentitySectionProps) {
  return (
    <SectionCard
      icon={<Layers className="size-4 text-primary-coral" />}
      title="02. Vault Identity"
      description="Define your vault's public title, strategy narrative, and branding banner."
    >
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
                onClick={onRemoveImage}
                className="text-xs text-status-error hover:bg-status-error/10 hover:text-status-error gap-1 font-semibold cursor-pointer"
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
              <input type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
            </label>
          )}
        </div>
      </div>
    </SectionCard>
  )
}
