import { Link } from '@tanstack/react-router'
import { AddressPill } from '@/components/ui/AddressPill'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { SectionCard } from '@/components/ui/SectionCard'
import { Card } from '@/components/ui/card'
import {
  Edit3,
  Layers,
  Target,
  Shield,
  Clock,
  Calendar,
  DollarSign,
  Percent,
  Lock,
  Tag,
  ImageIcon,
  Unlock,
  TrendingUp,
  RefreshCw,
} from 'lucide-react'
import { formatDate } from '@/lib/format'
import type { Vault } from '@/types'

export interface VaultOverviewProps {
  vault: Vault
  isManager?: boolean
}

function bpsToPercent(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

function formatLockupPeriod(lockup?: number): string {
  if (!lockup) return 'None'
  if (lockup >= 86400) {
    const days = Math.round(lockup / 86400)
    return `${days} Day${days === 1 ? '' : 's'}`
  }
  if (lockup >= 3600) {
    const hours = Math.round(lockup / 3600)
    return `${hours} Hour${hours === 1 ? '' : 's'}`
  }
  return `${lockup} Day${lockup === 1 ? '' : 's'}`
}

const DEFAULT_VAULT_BANNER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240" viewBox="0 0 800 240"><defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="%2313141c"/><stop offset="50%" stop-color="%231f1826"/><stop offset="100%" stop-color="%230e0f14"/></linearGradient><linearGradient id="acc" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="%23FF5733"/><stop offset="100%" stop-color="%23FFC300"/></linearGradient></defs><rect width="800" height="240" fill="url(%23bg)"/><circle cx="120" cy="120" r="80" fill="none" stroke="url(%23acc)" stroke-width="2" opacity="0.25"/><circle cx="680" cy="120" r="100" fill="none" stroke="url(%23acc)" stroke-width="1.5" opacity="0.15"/><path d="M0,180 Q200,120 400,160 T800,140 L800,240 L0,240 Z" fill="url(%23acc)" opacity="0.08"/><text x="400" y="110" text-anchor="middle" fill="%23FFFFFF" font-family="system-ui,-apple-system,sans-serif" font-size="22" font-weight="700" letter-spacing="1">FLUX VAULT PROTOCOL</text><text x="400" y="145" text-anchor="middle" fill="%23FF5733" font-family="monospace" font-size="13" font-weight="600" letter-spacing="2">AUTOMATED SOLANA EXECUTION</text></svg>'

export function VaultOverview({ vault, isManager }: VaultOverviewProps) {
  const focusAssets = vault.metadata?.focusAssets || []
  const tags = vault.metadata?.tags && vault.metadata.tags.length > 0 ? vault.metadata.tags : ['Solana', 'Vault', 'Alpha']
  const coverImageUrl = vault.metadata?.coverImageUrl || DEFAULT_VAULT_BANNER
  const description = vault.metadata?.description || 'No description provided for this vault strategy.'

  return (
    <div className="space-y-6">
      {/* Top Grid: Strategy & Security SectionCards */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        {/* Strategy SectionCard */}
        <div className="lg:col-span-2 flex flex-col">
          <SectionCard
            icon={<Layers className="size-4 text-primary-coral" />}
            title="Investment Strategy & Identity"
            description="Active vault portfolio objectives, target assets, and taxonomy tags."
            className="h-full flex flex-col justify-between"
            contentClassName="flex-1 flex flex-col justify-between"
            rightContent={
              isManager ? (
                <Link
                  to="/vaults/$id/edit"
                  params={{ id: vault.id }}
                  className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-bg-inset/70 px-2.5 py-1 text-xs font-medium text-text-secondary hover:text-text-primary hover:border-primary-coral/40 transition-colors"
                >
                  <Edit3 className="size-3" />
                  <span>Edit</span>
                </Link>
              ) : null
            }
          >
            <div className="space-y-4">
              {/* Optional Cover Image Banner */}
              {coverImageUrl && (
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-bg-inset max-h-56 group">
                  <img
                    src={coverImageUrl}
                    alt={vault.metadata?.displayName || 'Vault Cover'}
                    className="w-full h-44 object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-bg-base/80 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute bottom-2 left-3 flex items-center gap-1.5 text-[11px] font-medium text-white/90 bg-bg-base/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
                    <ImageIcon className="size-3 text-primary-coral" />
                    <span>Vault Banner</span>
                  </div>
                </div>
              )}

              <p className="text-sm leading-relaxed text-text-secondary">
                {description}
              </p>

              {/* Tags Section */}
              {tags.length > 0 && (
                <div className="pt-3 border-t border-border-subtle/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="size-3.5 text-primary-coral" />
                    <span className="text-xs font-medium text-text-tertiary">Strategy Tags</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-2.5 py-1 text-xs font-mono font-medium text-text-primary border border-white/10"
                      >
                        #{tag.replace(/^#/, '')}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Focus Assets */}
              <div className="pt-3 border-t border-border-subtle/50">
                <div className="flex items-center gap-2 mb-2.5">
                  <Target className="size-3.5 text-primary-gold" />
                  <span className="text-xs font-medium text-text-tertiary">Focus Trading Assets</span>
                </div>
                {focusAssets.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {focusAssets.map((asset) => (
                      <span
                        key={asset}
                        className="inline-flex items-center gap-1.5 rounded-full bg-bg-inset/90 px-3 py-1 text-xs font-medium text-text-primary border border-white/10 shadow-sm"
                      >
                        <TokenIcon symbol={asset} className="size-3.5" />
                        <span>{asset}</span>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-text-tertiary">All whitelisted ecosystem tokens allowed.</p>
                )}
              </div>
            </div>
          </SectionCard>
        </div>

        {/* Security Highlights SectionCard */}
        <div className="flex flex-col">
          <SectionCard
            icon={<Shield className="size-4 text-status-success" />}
            title="Security & Custody"
            description="Non-custodial Solana mainnet execution."
            className="h-full flex flex-col justify-between"
            contentClassName="flex-1 flex flex-col justify-between"
          >
            <div className="flex flex-col justify-between space-y-4 h-full">
              <p className="text-xs text-text-secondary leading-relaxed">
                Smart contract instructions are restricted to DEX swaps via Pyth Oracle price bands with slippage limits.
              </p>

              <div className="rounded-xl bg-bg-inset/60 p-3.5 border border-border-subtle space-y-2.5 mt-auto">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">Status</span>
                  <StatusBadge status={vault.status} />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">Vault Type</span>
                  <span className="inline-flex items-center gap-1 font-mono text-text-primary font-medium text-xs">
                    {vault.vaultType === 'closed' ? (
                      <>
                        <Lock className="size-3 text-primary-amber" /> Closed
                      </>
                    ) : (
                      <>
                        <Unlock className="size-3 text-status-success" /> Open
                      </>
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">Min Raise Amount</span>
                  <span className="font-mono text-text-primary font-medium">
                    ${(vault.minRaiseAmount ?? 10).toLocaleString()} USD
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">Lockup Period</span>
                  <span className="font-mono text-text-primary font-medium">
                    {formatLockupPeriod(vault.lockupPeriod)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">Active Investors</span>
                  <span className="font-mono text-text-primary font-medium">
                    {vault.investorCount ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Protocol Parameters SectionCard */}
      <SectionCard
        icon={<Lock className="size-4 text-primary-gold" />}
        title="Protocol Parameters & Smart Contract State"
        description="On-chain smart contract parameters, lockups, fee constraints, and lifecycle timestamps."
      >
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Layers className="size-3.5 text-primary-coral" />
              <span>Vault Program Address</span>
            </div>
            <div className="pt-1">
              <AddressPill address={vault.address} />
            </div>
          </Card>

          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Shield className="size-3.5 text-primary-gold" />
              <span>Manager Wallet</span>
            </div>
            <div className="pt-1">
              <AddressPill address={vault.managerAddress || 'N/A'} />
            </div>
          </Card>

          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Percent className="size-3.5 text-status-info" />
              <span>Fee Structure</span>
            </div>
            <p className="font-mono text-xs font-semibold text-text-primary pt-1">
              {bpsToPercent(vault.performanceFeeBps)} Perf / {bpsToPercent(vault.managementFeeBps)} Mgmt
            </p>
          </Card>

          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <TrendingUp className="size-3.5 text-status-success" />
              <span>Min Raise Amount</span>
            </div>
            <p className="font-mono text-xs font-semibold text-text-primary pt-1">
              ${(vault.minRaiseAmount ?? 10).toLocaleString()} USD
            </p>
          </Card>

          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Clock className="size-3.5 text-primary-amber" />
              <span>Withdrawal Lockup</span>
            </div>
            <p className="font-mono text-xs font-semibold text-text-primary pt-1">
              {formatLockupPeriod(vault.lockupPeriod)}
            </p>
          </Card>

          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <DollarSign className="size-3.5 text-primary-coral" />
              <span>Vault Type</span>
            </div>
            <p className="font-mono text-xs font-semibold text-text-primary pt-1 capitalize">
              {vault.vaultType || 'Open'} Vault
            </p>
          </Card>

          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <Calendar className="size-3.5 text-text-tertiary" />
              <span>Created Timestamp</span>
            </div>
            <p className="font-mono text-xs font-semibold text-text-primary pt-1">
              {formatDate(vault.createdAt)}
            </p>
          </Card>

          <Card className="p-3.5 border-white/8 bg-bg-inset/40 backdrop-blur-md space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
              <RefreshCw className="size-3.5 text-text-tertiary" />
              <span>Last Updated</span>
            </div>
            <p className="font-mono text-xs font-semibold text-text-primary pt-1">
              {formatDate(vault.updatedAt || vault.createdAt)}
            </p>
          </Card>
        </div>
      </SectionCard>
    </div>
  )
}
