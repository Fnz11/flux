import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'

export interface AllocationSliderProps {
  value: number
  onChange: (value: number) => void
  label?: string
  presets?: readonly number[]
  debounceMs?: number
  className?: string
  disabled?: boolean
}

const DEFAULT_PRESETS = [25, 50, 75, 100] as const

export function AllocationSlider({
  value,
  onChange,
  label = 'Allocation',
  presets = DEFAULT_PRESETS,
  debounceMs = 60,
  className,
  disabled = false,
}: AllocationSliderProps) {
  const [localValue, setLocalValue] = useState(value)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Sync internal state when external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Cleanup pending debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
    }
  }, [])

  const handleSliderChange = useCallback(
    (newVal: number) => {
      setLocalValue(newVal)

      if (debounceMs <= 0) {
        onChangeRef.current(newVal)
        return
      }

      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }

      debounceTimerRef.current = setTimeout(() => {
        onChangeRef.current(newVal)
      }, debounceMs)
    },
    [debounceMs],
  )

  const handlePresetClick = useCallback(
    (pct: number) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      setLocalValue(pct)
      onChangeRef.current(pct)
    },
    [],
  )

  const clampedVal = Math.min(100, Math.max(0, localValue || 0))

  return (
    <div className={cn('space-y-2 pt-2 mt-3 border-t border-white/5', className)}>
      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <span>{label}</span>
        <span className="font-mono text-primary-coral font-semibold">{clampedVal}%</span>
      </div>

      <input
        type="range"
        role="slider"
        aria-label={label}
        aria-valuenow={clampedVal}
        min="0"
        max="100"
        step="1"
        value={clampedVal}
        disabled={disabled}
        onChange={(e) => handleSliderChange(Number(e.target.value))}
        style={{
          background: `linear-gradient(to right, #ff6b4a 0%, #ff6b4a ${clampedVal}%, rgba(255, 255, 255, 0.1) ${clampedVal}%, rgba(255, 255, 255, 0.1) 100%)`,
        }}
        className={cn(
          'w-full h-1.5 rounded-lg appearance-none cursor-pointer accent-primary-coral focus:outline-none transition-[background] duration-75',
          disabled && 'opacity-50 cursor-not-allowed',
        )}
      />

      <div className="grid grid-cols-4 gap-1.5 pt-1">
        {presets.map((pct) => {
          const isActive = clampedVal === pct
          return (
            <button
              key={pct}
              type="button"
              disabled={disabled}
              onClick={() => handlePresetClick(pct)}
              className={cn(
                'py-1 text-[11px] font-mono rounded-lg border transition-all cursor-pointer select-none',
                isActive
                  ? 'border-primary-coral/40 bg-primary-coral/15 text-primary-coral font-bold shadow-[0_0_12px_rgba(255,107,74,0.15)]'
                  : 'border-white/8 bg-white/[0.02] text-text-muted hover:text-text-primary hover:bg-white/[0.06] hover:border-white/15',
                disabled && 'opacity-50 cursor-not-allowed pointer-events-none',
              )}
            >
              {pct === 100 ? 'MAX' : `${pct}%`}
            </button>
          )
        })}
      </div>
    </div>
  )
}
