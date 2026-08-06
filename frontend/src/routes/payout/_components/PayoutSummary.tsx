import { ProgressMetricCard } from '@/components/ui/progress-metric-card'

interface PayoutSummaryProps {
  totalPerf: number
  totalMgmt: number
  totalFees: number
}

export function PayoutSummary({ totalPerf, totalMgmt, totalFees }: PayoutSummaryProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <ProgressMetricCard
        title="Total Performance Fee"
        total={`$${totalPerf.toFixed(2)}`}
        accent="amber"
        data={totalPerf > 0 ? [{ date: '1', value: 0 }, { date: '2', value: totalPerf }] : []}
        size="sm"
      />
      <ProgressMetricCard
        title="Total Management Fee"
        total={`$${totalMgmt.toFixed(2)}`}
        accent="neutral"
        data={totalMgmt > 0 ? [{ date: '1', value: 0 }, { date: '2', value: totalMgmt }] : []}
        size="sm"
      />
      <ProgressMetricCard
        title="Total Accrued"
        total={`$${totalFees.toFixed(2)}`}
        accent="gold"
        data={totalFees > 0 ? [{ date: '1', value: 0 }, { date: '2', value: totalFees }] : []}
        size="sm"
      />
    </div>
  )
}
