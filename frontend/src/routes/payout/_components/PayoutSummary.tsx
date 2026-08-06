import { Percent, Sliders, Coins, ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface PayoutSummaryProps {
  totalPerf: number
  totalMgmt: number
  totalFees: number
}

export function PayoutSummary({ totalPerf, totalMgmt, totalFees }: PayoutSummaryProps) {
  const [perfInt, perfDec] = totalPerf.toFixed(2).split('.')
  const [mgmtInt, mgmtDec] = totalMgmt.toFixed(2).split('.')
  const [feesInt, feesDec] = totalFees.toFixed(2).split('.')

  return (
    <div className="grid gap-4 sm:grid-cols-3 items-stretch">
      {/* 1. Total Performance Fee Card */}
      <Card className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border-subtle bg-bg-elevated/70 backdrop-blur-2xl p-5 shadow-lg">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            <div className="flex items-center gap-2">
              <Percent className="size-4 text-primary-coral" />
              <span>Total Performance Fee</span>
            </div>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              <ArrowUpRight className="size-3" />
              +14.2%
            </span>
          </div>

          <div className="mt-4 flex items-baseline">
            <span className="text-3xl font-bold tracking-tight text-text-primary">
              ${perfInt}
            </span>
            <span className="text-xl font-semibold text-text-tertiary">.{perfDec}</span>
          </div>
        </div>

        <div className="mt-4 border-t border-border-subtle/40 pt-2.5 text-[11px] text-text-tertiary">
          Accrued on net vault trading profits
        </div>
      </Card>

      {/* 2. Total Management Fee Card */}
      <Card className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border-subtle bg-bg-elevated/70 backdrop-blur-2xl p-5 shadow-lg">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            <div className="flex items-center gap-2">
              <Sliders className="size-4 text-primary-amber" />
              <span>Total Management Fee</span>
            </div>
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-400">
              <ArrowUpRight className="size-3" />
              +3.8%
            </span>
          </div>

          <div className="mt-4 flex items-baseline">
            <span className="text-3xl font-bold tracking-tight text-text-primary">
              ${mgmtInt}
            </span>
            <span className="text-xl font-semibold text-text-tertiary">.{mgmtDec}</span>
          </div>
        </div>

        <div className="mt-4 border-t border-border-subtle/40 pt-2.5 text-[11px] text-text-tertiary">
          Accrued on total AUM continuously
        </div>
      </Card>

      {/* 3. Total Accrued Rewards Card */}
      <Card className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-primary-coral/30 bg-gradient-to-br from-bg-elevated via-bg-elevated to-primary-coral/10 backdrop-blur-2xl p-5 shadow-lg">
        <div>
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            <div className="flex items-center gap-2">
              <Coins className="size-4 text-emerald-400" />
              <span>Total Accrued Payouts</span>
            </div>
            <button
              type="button"
              className="rounded-full bg-gradient-to-r from-primary-coral to-primary-amber px-3 py-1 text-[11px] font-bold text-black shadow-md hover:brightness-110 transition-all cursor-pointer"
            >
              Claim All
            </button>
          </div>

          <div className="mt-4 flex items-baseline">
            <span className="text-3xl font-bold tracking-tight text-text-primary">
              ${feesInt}
            </span>
            <span className="text-xl font-semibold text-text-tertiary">.{feesDec}</span>
          </div>
        </div>

        <div className="mt-4 border-t border-border-subtle/40 pt-2.5 text-[11px] text-text-tertiary">
          Ready for automated keeper distribution
        </div>
      </Card>
    </div>
  )
}
