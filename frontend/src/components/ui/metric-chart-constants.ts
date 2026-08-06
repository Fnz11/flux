export type MetricAccent = 'emerald' | 'rose' | 'neutral' | 'amber' | 'gold'

export interface ACCENT_COLOR {
  stroke: string
  text: string
  fill: string
}

export const ACCENTS: Record<MetricAccent, ACCENT_COLOR> = {
  emerald: { stroke: '#28C840', text: '#28C840', fill: 'rgba(40, 200, 64, 0.15)' },
  rose: { stroke: '#FF5F57', text: '#FF5F57', fill: 'rgba(255, 95, 87, 0.15)' },
  neutral: { stroke: '#A3A3A3', text: '#A3A3A3', fill: 'rgba(163, 163, 163, 0.15)' },
  amber: { stroke: '#F6B253', text: '#F6B253', fill: 'rgba(246, 178, 83, 0.15)' },
  gold: { stroke: '#CDA63C', text: '#CDA63C', fill: 'rgba(205, 166, 60, 0.15)' },
}

export const SERIES_COLORS = ['#FA9A63', '#F6B253', '#CDA63C', '#28C840', '#3086ff']

export function formatCompact(num: number): string {
  if (Math.abs(num) >= 1_000_000_000) return (num / 1_000_000_000).toFixed(1) + 'B'
  if (Math.abs(num) >= 1_000_000) return (num / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(num) >= 1_000) return (num / 1_000).toFixed(1) + 'K'
  return num.toLocaleString('en-US', { maximumFractionDigits: 2 })
}
