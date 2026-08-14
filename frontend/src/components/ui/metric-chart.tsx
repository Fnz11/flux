import { useState, useRef } from 'react'

export type ChartView = 'curve' | 'bars'
export type MetricAccent = 'emerald' | 'rose' | 'neutral' | 'amber' | 'gold'

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

function getSmoothPath(pts: { x: number; y: number }[]) {
  if (pts.length < 2) return ''
  return pts.reduce((acc, point, i, a) => {
    if (i === 0) return `M ${point.x},${point.y}`
    const cp1x = a[i - 1].x + (point.x - a[i - 1].x) / 2
    const cp1y = a[i - 1].y
    const cp2x = a[i - 1].x + (point.x - a[i - 1].x) / 2
    const cp2y = point.y
    return `${acc} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${point.x},${point.y}`
  }, '')
}

export function MetricChart({
  series,
  view,
  valueFormatter,
  dateFormatter,
}: {
  series: ChartSeries[]
  view: ChartView
  defaultIndex?: number
  valueFormatter?: (v: number) => string
  dateFormatter?: (d: string) => string
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const primary = series[0]
  if (!primary || primary.data.length === 0) return null

  const pts = primary.data
  const values = pts.map((p) => p.value)
  const maxVal = Math.max(...values, 1)
  const minVal = Math.min(...values, 0)
  const range = maxVal - minVal || 1

  const width = 100
  const height = 100
  const paddingY = 14

  const points = pts.map((p, i) => {
    const x = (i / Math.max(pts.length - 1, 1)) * width
    const y = height - paddingY - ((p.value - minVal) / range) * (height - paddingY * 2)
    return { x, y, point: p }
  })

  const smoothLineD = getSmoothPath(points)
  const fillD = `${smoothLineD} L ${width},${height} L 0,${height} Z`

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || points.length < 2) return
    const rect = containerRef.current.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, mouseX / rect.width))
    const nearestIndex = Math.round(pct * (points.length - 1))
    setHoverIndex(nearestIndex)
  }

  const handleMouseLeave = () => {
    setHoverIndex(null)
  }

  const activePt = hoverIndex !== null ? points[hoverIndex] : null

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="relative h-full w-full cursor-crosshair group"
    >
      {/* Floating Hover Tooltip */}
      {activePt && (
        <div
          className="absolute top-0 z-20 -translate-x-1/2 -translate-y-1 rounded-md border border-border-subtle bg-bg-elevated/95 px-2 py-1 text-[10px] font-medium text-text-primary shadow-lg backdrop-blur-md pointer-events-none transition-[left,opacity]"
          style={{
            left: `${activePt.x}%`,
          }}
        >
          <div className="font-semibold text-text-primary">
            {valueFormatter ? valueFormatter(activePt.point.value) : activePt.point.value.toLocaleString()}
          </div>
          {activePt.point.date && (
            <div className="text-[9px] text-text-tertiary">
              {dateFormatter ? dateFormatter(activePt.point.date) : activePt.point.date}
            </div>
          )}
        </div>
      )}

      <svg className="h-full w-full overflow-hidden" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {view === 'curve' ? (
          <>
            <defs>
              <linearGradient id={`grad-${primary.name.replace(/\s+/g, '')}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={primary.color} stopOpacity="0.32" />
                <stop offset="100%" stopColor={primary.color} stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={fillD} fill={`url(#grad-${primary.name.replace(/\s+/g, '')})`} />
            <path
              d={smoothLineD}
              fill="none"
              stroke={primary.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </>
        ) : (
          <g>
            {points.map((p, i) => {
              const isHovered = hoverIndex === i
              const barHeight = Math.max(((p.point.value - minVal) / range) * (height - paddingY * 2), 6)
              const barW = Math.max(85 / points.length, 3.5)
              return (
                <rect
                  key={i}
                  x={p.x - barW / 2}
                  y={height - paddingY - barHeight}
                  width={barW}
                  height={barHeight}
                  fill={primary.color}
                  opacity={isHovered ? 1 : i === points.length - 1 ? 0.85 : 0.4}
                  rx="2"
                  className="transition-opacity"
                />
              )
            })}
          </g>
        )}

        {/* Hover Crosshair Line & Active Point Dot */}
        {activePt && (
          <g className="pointer-events-none">
            <line
              x1={activePt.x}
              y1="0"
              x2={activePt.x}
              y2={height}
              stroke={primary.color}
              strokeWidth="1"
              strokeDasharray="2 2"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
            <circle
              cx={activePt.x}
              cy={activePt.y}
              r="2.5"
              fill={primary.color}
              stroke="#000"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )}
      </svg>
    </div>
  )
}
