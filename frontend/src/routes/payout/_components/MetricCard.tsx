import { Card } from '@/components/ui/card'

export function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className="p-4">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`mt-1 font-mono text-xl font-semibold tracking-tight ${accent ? 'text-primary-coral' : 'text-text-primary'}`}>
        {value}
      </p>
    </Card>
  )
}
