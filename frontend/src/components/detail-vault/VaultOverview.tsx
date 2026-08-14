import { Link } from '@tanstack/react-router'
import { AddressPill } from '@/components/ui/AddressPill'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { SectionCard } from '@/components/ui/SectionCard'
import { Card } from '@/components/ui/card'
import { Edit3, Layers, Target, Shield, Clock, Calendar, DollarSign, Percent, Lock } from 'lucide-react'
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

export function VaultOverview({ vault, isManager }: VaultOverviewProps) {
  const focusAssets = vault.metadata?.focusAssets || []
  const description = vault.metadata?.description || 'No description provided for this vault strategy.'

  return (
    <div className="space-y-6">
      {/* Top Grid: Strategy & Security SectionCards with equal height */}
      <div className="grid gap-6 lg:grid-cols-3 items-stretch">
        {/* Strategy SectionCard */}
        <div className="lg:col-span-2 flex flex-col">
          <SectionCard
            icon={<Layers className="size-4 text-primary-coral" />}
            title="Investment Strategy"
            description="Active vault portfolio objectives and asset whitelist."
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
              <p className="text-sm leading-relaxed text-text-secondary">
                {description}
              </p>

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
                  <span className="text-text-tertiary">Lockup Period</span>
                  <span className="font-mono text-text-primary font-medium">{formatLockupPeriod(vault.lockupPeriod)}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-tertiary">Min Investment</span>
                  <span className="font-mono text-text-primary font-medium">${(vault.minRaiseAmount ?? 10).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Protocol Parameters SectionCard */}
      <SectionCard
        icon={<Lock className="size-4 text-primary-gold" />}
        title="Protocol Parameters"
        description="On-chain smart contract parameters and fee constraints."
      >
        <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
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
              <DollarSign className="size-3.5 text-status-success" />
              <span>Minimum Deposit</span>
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
              <Calendar className="size-3.5 text-text-tertiary" />
              <span>Created Timestamp</span>
            </div>
            <p className="font-mono text-xs font-semibold text-text-primary pt-1">
              {formatDate(vault.createdAt)}
            </p>
          </Card>
        </div>
      </SectionCard>
    </div>
  )
}
