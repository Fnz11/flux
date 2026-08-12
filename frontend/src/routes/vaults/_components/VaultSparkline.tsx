

interface VaultSparklineProps {
  data?: number[]
  isPositive?: boolean
  width?: number
  height?: number
}

export function VaultSparkline({
  data,
  isPositive = true,
  width = 90,
  height = 28,
}: VaultSparklineProps) {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="overflow-visible">
        <line
          x1={0}
          y1={height / 2}
          x2={width}
          y2={height / 2}
          stroke="#374151"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeDasharray="1 3"
        />
      </svg>
    )
  }

  const points = data

  const min = Math.min(...points)
  const max = Math.max(...points)
  const range = max - min || 1

  const svgPoints = points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * width
      const y = height - ((val - min) / range) * (height - 6) - 3
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const strokeColor = isPositive ? '#10B981' : '#EF4444'

  const firstX = 0
  const lastX = width
  const areaPoints = `${firstX},${height} ${svgPoints} ${lastX},${height}`

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={`grad-${isPositive ? 'pos' : 'neg'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={strokeColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${isPositive ? 'pos' : 'neg'})`} />
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={svgPoints}
      />
    </svg>
  )
}
