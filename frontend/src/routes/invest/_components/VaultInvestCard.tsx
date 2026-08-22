import { Link } from '@tanstack/react-router'
import type { Vault } from '@/types'
import { Card } from '@/components/ui/card'
import { StatusBadge } from '@/components/ui/StatusBadge'
import { AddressPill } from '@/components/ui/AddressPill'
import { TokenAmount } from '@/components/ui/TokenAmount'
import { TokenIcon } from '@/components/ui/TokenIcon'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { VaultSparkline } from '@/routes/vaults/_components/VaultSparkline'
import { formatPercent } from '@/lib/format'
import { Users, Lock, Unlock, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DEFAULT_FOCUS_ASSETS_WHITELIST } from '@/constants/tokens'

interface VaultInvestCardProps {
  vault: Vault
}

export function VaultInvestCard({ vault }: VaultInvestCardProps) {
  const displayName = vault.metadata?.displayName || (vault.id ? `Vault ${vault.id}` : `Vault ${vault.address?.slice(0, 8) ?? ''}`)
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const totalFeesBps = (vault.performanceFeeBps || 0) + (vault.managementFeeBps || 0)
  const pnl = vault.pnlPercent ?? 0
  const isPositivePnl = pnl >= 0
  const sparkline = vault.sparkline ?? []

  const focusAssets = vault.metadata?.focusAssets && vault.metadata.focusAssets.length > 0
    ? vault.metadata.focusAssets
    : [...DEFAULT_FOCUS_ASSETS_WHITELIST]

  return (
    <Card className="group relative flex flex-col justify-between p-5 hover:border-primary-coral/40 transition-all hover:shadow-[0_16px_48px_rgba(0,0,0,0.7)]">
      {/* Top Card Header */}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {vault.metadata?.coverImageUrl ? (
              <img
                src={vault.metadata.coverImageUrl}
                alt={displayName}
                className="size-11 rounded-xl object-cover border border-white/12 shadow-sm shrink-0 bg-white/5"
              />
            ) : (
              <Avatar className="size-11 rounded-xl shrink-0 border border-white/10">
                <AvatarFallback seed={vault.address || vault.id || displayName}>
                  {initials}
                </AvatarFallback>
              </Avatar>
            )}

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold tracking-tight text-text-primary truncate">
                  {displayName}
                </h3>
                <StatusBadge status={vault.status} />
              </div>
              <div className="mt-1">
                {vault.managerAddress ? (
                  <AddressPill prefix="by " address={vault.managerAddress} length={4} />
                ) : (
                  <AddressPill address={vault.address} length={4} />
                )}
              </div>
            </div>
          </div>

          <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-medium text-text-secondary shrink-0">
            {vault.vaultType === 'closed' ? (
              <>
                <Lock className="size-2.5 text-primary-amber" /> Closed
              </>
            ) : (
              <>
                <Unlock className="size-2.5 text-status-success" /> Open
              </>
            )}
          </span>
        </div>

        {/* Description if present */}
        {vault.metadata?.description && (
          <p className="mt-3 text-xs text-text-secondary line-clamp-2 leading-relaxed">
            {vault.metadata.description}
          </p>
        )}

        {/* 4-Item Metrics Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 rounded-xl bg-white/[0.02] p-3 border border-white/8">
          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary">AUM (TVL)</p>
            <div className="mt-0.5">
              <TokenAmount amount={vault.tvl} symbol="USD" compact />
            </div>
          </div>

          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary">Net PnL</p>
            <p className={cn('mt-0.5 font-mono text-sm font-bold', isPositivePnl ? 'text-status-success' : 'text-status-error')}>
              {formatPercent(pnl)}
            </p>
          </div>

          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary">Perf Fee</p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-text-primary">{vault.performanceFeeBps} BPS</p>
          </div>

          <div>
            <p className="text-[10px] uppercase font-semibold tracking-wider text-text-tertiary">Total Fees</p>
            <p className="mt-0.5 font-mono text-xs font-semibold text-text-primary">{totalFeesBps} BPS</p>
          </div>
        </div>

        {/* Focus Assets & Sparkline Row */}
        <div className="mt-3.5 flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1">
            {focusAssets.map((asset) => (
              <span
                key={asset}
                className="inline-flex items-center gap-1 rounded-md bg-white/[0.04] border border-white/8 px-1.5 py-0.5 text-[10px] font-mono text-text-secondary shrink-0"
              >
                <TokenIcon symbol={asset} className="size-3" />
                <span>{asset}</span>
              </span>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-xs text-text-tertiary font-mono">
            <Users className="size-3 text-text-muted" />
            <span>{vault.investorCount ?? 0}</span>
          </div>
        </div>

        {/* Mini Sparkline Preview */}
        {sparkline.length > 0 && (
          <div className="mt-3 h-6 w-full opacity-70">
            <VaultSparkline data={sparkline} isPositive={isPositivePnl} />
          </div>
        )}
      </div>

      {/* Card Action Button (Deposit) */}
      <div className="mt-4 pt-3 border-t border-white/8">
        <Link
          to="/invest/vaults/$id"
          params={{ id: vault.id }}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary-coral px-4 py-2.5 text-center text-xs font-bold text-black transition-all hover:bg-primary-coral/90 shadow-sm"
        >
          <span>Deposit</span>
          <ArrowUpRight className="size-3.5" />
        </Link>
      </div>
    </Card>
  )
}

export { VaultInvestCardSkeleton } from './VaultInvestCardSkeleton'
