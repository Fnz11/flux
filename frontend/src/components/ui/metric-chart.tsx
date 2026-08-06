import type { MetricAccent } from './metric-chart-constants'

export type { ACCENT_COLOR, MetricAccent } from './metric-chart-constants'

export type ChartView = 'curve' | 'bars'

export interface SeriesPoint {
  date: string
  value: number
}

export interface MetricSeries {
  name: string
  data: SeriesPoint[]
  accent?: MetricAccent
}

export interface ChartSeries {
  name: string
  data: SeriesPoint[]
  color: string
}

export function MetricChart({
  series,
  view,
  defaultIndex,
}: {
  series: ChartSeries[]
  view: ChartView
  defaultIndex: number
  valueFormatter?: (v: number) => string
  dateFormatter?: (d: string) => string
}) {
  const primary = series[0]
  if (!primary || primary.data.length === 0) return null

  const pts = primary.data
  const values = pts.map((p) => p.value)
  const maxVal = Math.max(...values, 1)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal || 1

  const width = 100
  const height = 100

  const points = pts.map((p, i) => {
    const x = (i / Math.max(pts.length - 1, 1)) * width
    const y = height - ((p.value - minVal) / range) * (height - 20) - 10
    return { x, y, point: p }
  })

  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x},${p.y}` : `${acc} L ${p.x},${p.y}`
  }, '')

  const fillD = `${pathD} L ${width},${height} L 0,${height} Z`

  return (
    <div className="relative h-full w-full">
      <svg className="h-full w-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {view === 'curve' ? (
          <>
            <defs>
              <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primary.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={primary.color} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={fillD} fill="url(#chartGrad)" />
            <path d={pathD} fill="none" stroke={primary.color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
          </>
        ) : (
          <g>
            {points.map((p, i) => {
              const barHeight = Math.max(((p.point.value - minVal) / range) * 80, 4)
              const barW = Math.max(80 / points.length, 3)
              return (
                <rect
                  key={i}
                  x={p.x - barW / 2}
                  y={height - barHeight}
                  width={barW}
                  height={barHeight}
                  fill={primary.color}
                  opacity={i === defaultIndex ? 1 : 0.4}
                  rx="1.5"
                />
              )
            })}
          </g>
        )}
      </svg>
    </div>
  )
}
