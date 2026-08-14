import { api } from '@/lib/api'
import type { SeriesPoint } from '@/components/ui/metric-chart'

export interface MetricsResponse {
  metric: string
  period: string
  summary: {
    total: string
    net_change: string
    pct_change: string
    peak: string
    low: string
    avg: string
  }
  series: Array<{
    date: string
    value: string
  }>
}

export async function getMetrics(metric: string, period: string = '30d'): Promise<SeriesPoint[]> {
  try {
    const res = await api.get<MetricsResponse>('/metrics/series', { metric, period })
    if (!res || !res.series) return []
    return res.series.map(point => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: parseFloat(point.value) || 0
    }))
  } catch (error) {
    console.error(`Failed to fetch metrics for ${metric}:`, error)
    return []
  }
}
