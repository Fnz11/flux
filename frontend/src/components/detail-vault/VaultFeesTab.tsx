import { Link } from '@tanstack/react-router'
import { useFees } from '@/hooks/useFees'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Coins, Zap, ShieldCheck, ArrowRight, DollarSign } from 'lucide-react'
import type { Vault } from '@/types'

export interface VaultFeesTabProps {
  vault: Vault
  isManager?: boolean
}

export function VaultFeesTab({ vault, isManager }: VaultFeesTabProps) {
  const { fees = [], isLoading } = useFees([vault.id || vault.address])
  const vaultFee = fees.find((f) => f.vault_id === vault.id || f.vault_id === vault.address)

  const perfBps = vault.performanceFeeBps || 0
  const mgmtBps = vault.managementFeeBps || 0

  const accruedPerf = vaultFee?.accrued_performance_fee ?? (vault.tvl * (perfBps / 10000))
  const accruedMgmt = vaultFee?.accrued_management_fee ?? (vault.tvl * (mgmtBps / 10000))
  const totalAccrued = vaultFee?.total_accrued ?? (accruedPerf + accruedMgmt)

  const perfVal = Number(accruedPerf || 0)
  const mgmtVal = Number(accruedMgmt || 0)
  const totalVal = Number(totalAccrued || 0)

  return (
    <div className="space-y-6">
      {/* 3 Fee Cards Grid */}
      <div className="grid gap-3.5 sm:grid-cols-3">
        <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
          <div className="flex items-center justify-between text-text-tertiary">
            <span className="text-xs font-medium">Performance Fee ({((perfBps / 100)).toFixed(2)}%)</span>
            <Coins className="size-4 text-primary-coral" />
          </div>
          {isLoading ? (
            <Skeleton className="mt-2.5 h-7 w-28 rounded-md" />
          ) : (
            <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
              ${perfVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="mt-1 text-[11px] text-text-muted">
            Accrued on positive returns ({perfBps} BPS)
          </p>
        </Card>

        <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
          <div className="flex items-center justify-between text-text-tertiary">
            <span className="text-xs font-medium">Management Fee ({((mgmtBps / 100)).toFixed(2)}%)</span>
            <ShieldCheck className="size-4 text-primary-gold" />
          </div>
          {isLoading ? (
            <Skeleton className="mt-2.5 h-7 w-28 rounded-md" />
          ) : (
            <p className="mt-2 font-mono text-2xl font-bold text-text-primary">
              ${mgmtVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="mt-1 text-[11px] text-text-muted">
            Accrued on AUM ({mgmtBps} BPS)
          </p>
        </Card>

        <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
          <div className="flex items-center justify-between text-text-tertiary">
            <span className="text-xs font-medium">Total Claimable Fees</span>
            <DollarSign className="size-4 text-status-success" />
          </div>
          {isLoading ? (
            <Skeleton className="mt-2.5 h-7 w-28 rounded-md" />
          ) : (
            <p className="mt-2 font-mono text-2xl font-bold text-status-success">
              ${totalVal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="mt-1 text-[11px] text-text-muted">
            Combined accrued protocol revenue
          </p>
        </Card>
      </div>

      {/* Fee Breakdown & Payout Callout */}
      <SectionCard
        icon={<Zap className="size-4 text-primary-coral" />}
        title="Fee Distribution & Protocol Treasury"
        description="On-chain smart contract fee distribution model and manager earnings."
        rightContent={
          isManager ? (
            <Link to="/payout">
              <SweepButton className="h-8 text-xs font-semibold">
                <span>Fee Settlement Console</span>
                <ArrowRight className="ml-1.5 size-3.5" />
              </SweepButton>
            </Link>
          ) : null
        }
      >
        <div className="space-y-4">
          <p className="text-xs text-text-secondary leading-relaxed">
            Fees are accrued continuously upon DEX rebalancing and performance milestones. Managers can claim accrued fees via the payout settlement module.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-white/8 bg-bg-inset/40 p-3.5 space-y-1">
              <p className="text-xs font-semibold text-text-primary">Performance Fee Calculation</p>
              <p className="text-[11px] text-text-tertiary">
                High-water mark principle applied on net profits. Rates are locked at contract initialization.
              </p>
            </div>

            <div className="rounded-xl border border-white/8 bg-bg-inset/40 p-3.5 space-y-1">
              <p className="text-xs font-semibold text-text-primary">Management Fee Accrual</p>
              <p className="text-[11px] text-text-tertiary">
                Linear annualized calculation against aggregate vault Total Value Locked (TVL).
              </p>
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
