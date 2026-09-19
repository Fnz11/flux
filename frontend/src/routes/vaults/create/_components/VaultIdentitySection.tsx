import React, { useState, useRef, useEffect } from 'react'
import type { Control } from 'react-hook-form'
import {
  Layers,
  CheckCircle2,
  X,
  Upload,
  Sparkles,
  AlignLeft,
  ImageIcon,
  Tag,
  Search,
  ChevronDown,
  Check,
} from 'lucide-react'
import { SectionCard } from '@/components/ui/SectionCard'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from '@/components/ui/form'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { cn } from '@/lib/utils'
import { DEFAULT_FOCUS_ASSETS_WHITELIST, isWhitelistedToken } from '@/constants/tokens'
import type { CreateVaultFormValues } from '@/validations/vault'

export interface VaultIdentitySectionProps {
  control: Control<CreateVaultFormValues>
  description: string
  imagePreview: string | null
  imageName: string | null
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveImage: () => void
  focusAssetsWhitelist: string[]
  focusAssets: string[]
  onToggleFocusAsset: (asset: string) => void
  tags: string[]
  onAddTag: (tag: string) => void
  onRemoveTag: (tag: string) => void
}

export function VaultIdentitySection({
  control,
  description,
  imagePreview,
  imageName,
  onImageUpload,
  onRemoveImage,
  focusAssetsWhitelist,
  focusAssets,
  onToggleFocusAsset,
  tags,
  onAddTag,
  onRemoveTag,
}: VaultIdentitySectionProps) {
  // Tag input state
  const [tagInput, setTagInput] = useState('')

  // Focus assets combobox dropdown state
  const [comboboxOpen, setComboboxOpen] = useState(false)
  const [comboboxSearch, setComboboxSearch] = useState('')
  const comboboxRef = useRef<HTMLDivElement>(null)

  // Close combobox when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target as Node)) {
        setComboboxOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (tagInput.trim()) {
        onAddTag(tagInput)
        setTagInput('')
      }
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      e.preventDefault()
      onRemoveTag(tags[tags.length - 1])
    }
  }

  const filteredAssets = (focusAssetsWhitelist.length > 0 ? focusAssetsWhitelist : DEFAULT_FOCUS_ASSETS_WHITELIST)
    .filter((asset) => isWhitelistedToken(asset))
    .filter((asset) => asset.toLowerCase().includes(comboboxSearch.toLowerCase().trim()))

  return (
    <SectionCard
      icon={<Layers className="size-4 text-primary-coral" />}
      title="02. Vault Identity & Metadata"
      description="Define your vault's public title, strategy narrative, focus assets, tags, and branding banner."
      className={cn(comboboxOpen ? 'relative z-30' : 'relative z-10')}
    >
      <div className="space-y-5">
        {/* Display Name */}
        <FormField
          control={control}
          name="displayName"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                <Sparkles className="size-3.5 text-primary-coral" />
                Display Name
              </FormLabel>
              <FormControl>
                <Input
                  {...field}
                  placeholder="e.g. Solana High Yield Alpha"
                  className="bg-bg-inset border-border-subtle focus:border-primary-coral font-medium"
                />
              </FormControl>
              <FormDescription className="text-[11px] text-text-tertiary">
                The public name shown across the discovery leaderboard.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Strategy Description */}
        <FormField
          control={control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <div className="flex justify-between items-center">
                <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
                  <AlignLeft className="size-3.5 text-primary-gold" />
                  Strategy Description (Optional)
                </FormLabel>
                <span className="text-[11px] font-mono text-text-tertiary">
                  {description.length} / 500
                </span>
              </div>
              <FormControl>
                <Textarea
                  {...field}
                  rows={3}
                  maxLength={500}
                  placeholder="Describe your vault trading strategy, risk management framework, and target assets..."
                  className="bg-bg-inset border-border-subtle focus:border-primary-coral text-xs resize-none"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Cover Image Upload */}
        <div>
          <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary mb-1.5">
            <ImageIcon className="size-3.5 text-status-info" />
            Cover Image
          </FormLabel>
          {imagePreview ? (
            <div className="relative rounded-xl border border-border-subtle overflow-hidden bg-bg-inset p-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={imagePreview}
                  alt="Cover preview"
                  className="size-14 rounded-lg object-cover border border-border-subtle"
                />
                <div>
                  <p className="text-xs font-medium text-text-primary truncate max-w-xs">
                    {imageName || 'Cover image uploaded'}
                  </p>
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
              <div className="flex size-10 items-center justify-center rounded-full bg-bg-elevated text-text-tertiary group-hover:text-primary-coral mb-2 transition-colors">
                <Upload className="size-5" />
              </div>
              <p className="text-xs font-medium text-text-primary">Click to upload cover image</p>
              <p className="text-[10px] text-text-tertiary mt-1">PNG, JPG or WebP (max 5MB)</p>
              <input type="file" accept="image/*" className="hidden" onChange={onImageUpload} />
            </label>
          )}
        </div>

        {/* Focus Assets Multi-Select Combobox */}
        <div ref={comboboxRef} className="space-y-1.5 relative z-40">
          <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
            <Layers className="size-3.5 text-status-success" />
            Focus Assets (Multi-Select)
          </FormLabel>
          <p className="text-[11px] text-text-tertiary">
            Select target assets from the whitelist that this vault actively trades.
          </p>

          {/* Combobox Trigger */}
          <div
            onClick={() => setComboboxOpen((prev) => !prev)}
            className={cn(
              'min-h-10 w-full rounded-xl border bg-bg-inset px-3 py-2 text-xs flex flex-wrap items-center justify-between gap-2 cursor-pointer transition-colors',
              comboboxOpen
                ? 'border-primary-coral ring-2 ring-primary-coral/20'
                : 'border-border-subtle hover:border-border-medium'
            )}
            role="combobox"
            aria-expanded={comboboxOpen}
            aria-haspopup="listbox"
          >
            <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
              {focusAssets.length === 0 ? (
                <span className="text-text-muted">Select focus assets...</span>
              ) : (
                focusAssets.map((asset) => (
                  <span
                    key={asset}
                    className="inline-flex items-center gap-1.5 rounded-full bg-primary-coral/15 border border-primary-coral/30 px-2.5 py-0.5 text-xs font-mono font-medium text-text-primary"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TokenIcon symbol={asset} alt="" className="size-3.5" />
                    <span>{asset}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onToggleFocusAsset(asset)
                      }}
                      className="text-text-tertiary hover:text-status-error transition-colors ml-0.5"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ))
              )}
            </div>
            <ChevronDown
              className={cn(
                'size-4 text-text-tertiary shrink-0 transition-transform duration-200',
                comboboxOpen && 'rotate-180'
              )}
            />
          </div>

          {/* Combobox Dropdown Menu */}
          {comboboxOpen && (
            <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-xl border border-border-medium bg-bg-elevated shadow-2xl overflow-hidden animate-in fade-in-0 zoom-in-95">
              {/* Search Bar inside Combobox */}
              <div className="flex items-center border-b border-white/10 px-3 py-2 bg-bg-inset">
                <Search className="size-3.5 text-text-tertiary mr-2 shrink-0" />
                <input
                  type="text"
                  value={comboboxSearch}
                  onChange={(e) => setComboboxSearch(e.target.value)}
                  placeholder="Filter whitelisted tokens..."
                  className="w-full bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
                {comboboxSearch && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setComboboxSearch('')
                    }}
                    className="text-text-muted hover:text-text-primary"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Token Options List */}
              <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5" role="listbox">
                {filteredAssets.length === 0 ? (
                  <p className="p-3 text-center text-xs text-text-muted">No matching assets found</p>
                ) : (
                  filteredAssets.map((asset) => {
                    const isSelected = focusAssets.includes(asset)
                    return (
                      <div
                        key={asset}
                        onClick={(e) => {
                          e.stopPropagation()
                          onToggleFocusAsset(asset)
                        }}
                        className={cn(
                          'flex items-center justify-between rounded-lg px-3 py-2 text-xs font-mono cursor-pointer transition-colors select-none',
                          isSelected
                            ? 'bg-primary-coral/20 text-text-primary font-semibold'
                            : 'text-text-secondary hover:bg-bg-inset hover:text-text-primary'
                        )}
                        role="option"
                        aria-selected={isSelected}
                      >
                        <div className="flex items-center gap-2">
                          <TokenIcon symbol={asset} alt="" className="size-4" />
                          <span>{asset}</span>
                        </div>
                        {isSelected && <Check className="size-3.5 text-primary-coral" />}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Tags with Enter Key Badge Generation & Deduplication */}
        <div className="space-y-1.5">
          <FormLabel className="flex items-center gap-1.5 text-xs font-medium text-text-primary">
            <Tag className="size-3.5 text-status-info" />
            Tags
          </FormLabel>
          <p className="text-[11px] text-text-tertiary">
            Type keyword and press <span className="font-mono text-text-primary bg-bg-inset px-1 py-0.5 rounded border border-border-subtle">Enter</span> to add tag badges (deduplicated).
          </p>

          <div className="rounded-xl border border-border-subtle bg-bg-inset p-2.5 focus-within:border-primary-coral focus-within:ring-2 focus-within:ring-primary-coral/20 transition-all">
            <div className="flex flex-wrap items-center gap-1.5">
              {tags.map((tag) => (
                <Badge
                  key={tag}
                  variant="outline"
                  className="gap-1 px-2.5 py-1 text-xs font-mono bg-bg-surface/80 border-border-subtle text-text-primary"
                >
                  <span>#{tag}</span>
                  <button
                    type="button"
                    onClick={() => onRemoveTag(tag)}
                    className="text-text-tertiary hover:text-status-error transition-colors"
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? 'Type tag and press Enter...' : 'Add another tag...'}
                className="flex-1 min-w-[140px] bg-transparent text-xs text-text-primary placeholder:text-text-muted focus:outline-none py-1 px-1 font-mono"
              />
            </div>
          </div>
        </div>
      </div>
    </SectionCard>
  )
}
