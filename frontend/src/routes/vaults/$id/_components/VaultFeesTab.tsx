import { Link } from '@tanstack/react-router'
import { useFees } from '@/hooks/useFees'
import { SweepButton } from '@/components/ui/SweepButton'
import { SectionCard } from '@/components/ui/SectionCard'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Coins, Zap, ShieldCheck, ArrowRight, DollarSign } from 'lucide-react'
import type { Vault } from '@/types'

interface VaultFeesTabProps {
  vault: Vault
}

export function VaultFeesTab({ vault }: VaultFeesTabProps) {
  const { fees = [], isLoading } = useFees([vault.id || vault.address])
  const vaultFee = fees.find((f) => f.vault_id === vault.id || f.vault_id === vault.address)

  const perfBps = vault.performanceFeeBps || 0
  const mgmtBps = vault.managementFeeBps || 0

  const accruedPerf = vaultFee?.accrued_performance_fee ?? (vault.tvl * (perfBps / 10000))
  const accruedMgmt = vaultFee?.accrued_management_fee ?? (vault.tvl * (mgmtBps / 10000))
  const totalAccrued = vaultFee?.total_accrued ?? (accruedPerf + accruedMgmt)

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
              ${accruedPerf.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              ${accruedMgmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="mt-1 text-[11px] text-text-muted">
            Accrued on AUM ({mgmtBps} BPS)
          </p>
        </Card>

        <Card className="p-4 border-white/10 bg-bg-inset/40 backdrop-blur-md">
          <div className="flex items-center justify-between text-text-tertiary">
            <span className="text-xs font-medium">Total Claimable Fees</span>
            <Zap className="size-4 text-status-success" />
          </div>
          {isLoading ? (
            <Skeleton className="mt-2.5 h-7 w-28 rounded-md" />
          ) : (
            <p className="mt-2 font-mono text-2xl font-bold text-status-success">
              ${totalAccrued.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          )}
          <p className="mt-1 text-[11px] text-text-muted">
            Ready for keeper settlement
          </p>
        </Card>
      </div>

      {/* Claim & Payout Console SectionCard */}
      <SectionCard
        icon={<DollarSign className="size-4 text-primary-coral" />}
        title="Manager Fee Distribution"
        description="Protocol fee settlement schedule and payout triggers."
        rightContent={
          <Link to="/payout">
            <SweepButton className="h-8 text-xs">
              <span className="flex items-center gap-1.5">
                Go to Payout Console <ArrowRight className="size-3" />
              </span>
            </SweepButton>
          </Link>
        }
      >
        <p className="text-xs text-text-secondary leading-relaxed max-w-2xl">
          Protocol fees accumulate continuously on-chain per vault based on performance and total AUM. Keeper bots execute distributions automatically, or you can trigger manual claims in the Fee Payouts console.
        </p>
      </SectionCard>
    </div>
  )
}
