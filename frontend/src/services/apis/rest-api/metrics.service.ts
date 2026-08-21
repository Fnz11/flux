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
    const res = await api.get<MetricsResponse | { data?: MetricsResponse }>('/metrics/series', { metric, period })
    const payload = (res && typeof res === 'object' && 'data' in res && res.data) ? res.data : res
    const series = (payload as MetricsResponse)?.series
    if (!series || !Array.isArray(series)) return []
    return series.map(point => ({
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      value: parseFloat(point.value) || 0
    }))
  } catch (error) {
    console.error(`Failed to fetch metrics for ${metric}:`, error)
    return []
  }
}
