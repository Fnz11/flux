import * as React from 'react'
import { cn } from '@/lib/utils'

export interface DecimalInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value?: string | number | null
  onChange?: (value: any) => void
  onValueChange?: (stringValue: string, numericValue: number | null) => void
  onNumberChange?: (numericValue: number | null) => void
  valueAsNumber?: boolean
  maxDecimals?: number
  allowNegative?: boolean
}

export const DecimalInput = React.forwardRef<HTMLInputElement, DecimalInputProps>(
  (
    {
      className,
      value,
      onChange,
      onValueChange,
      onNumberChange,
      onBlur,
      valueAsNumber,
      maxDecimals = 6,
      allowNegative = true,
      placeholder = '0.00',
      ...props
    },
    ref,
  ) => {
    // Remember whether this input was initialized or set as number mode
    const initialIsNumber = React.useRef(valueAsNumber || typeof value === 'number')
    const isNumberMode = valueAsNumber || typeof value === 'number' || initialIsNumber.current

    const formatInitialValue = (val: string | number | null | undefined): string => {
      if (val === undefined || val === null || val === '') return ''
      return String(val)
    }

    const [displayValue, setDisplayValue] = React.useState<string>(() =>
      formatInitialValue(value),
    )

    // Sync display string when external value changes
    React.useEffect(() => {
      const stringVal = formatInitialValue(value)
      if (stringVal === '') {
        setDisplayValue('')
        return
      }

      // Check if numeric interpretation is different
      const numVal = Number(stringVal)
      const currentNum = Number(displayValue)

      if (isNaN(numVal)) {
        if (stringVal !== displayValue) {
          setDisplayValue(stringVal)
        }
      } else if (isNaN(currentNum) || numVal !== currentNum || (displayValue === '' && stringVal !== '')) {
        setDisplayValue(stringVal)
      }
    }, [value])

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      let raw = e.target.value

      // Replace comma with period for international keypads
      raw = raw.replace(/,/g, '.')

      // Allow empty
      if (raw === '') {
        setDisplayValue('')
        onValueChange?.('', null)
        onNumberChange?.(null)
        if (onChange) {
          if (isNumberMode) {
            onChange(null)
          } else {
            onChange('')
          }
        }
        return
      }

      // Build regex based on config
      // Allows optional leading negative sign, digits, optional decimal dot, max decimals
      const prefix = allowNegative ? '-?' : ''
      const regex = new RegExp(`^${prefix}\\d*(\\.\\d{0,${maxDecimals}})?$`)

      if (!regex.test(raw)) {
        return // Ignore invalid characters
      }

      // Handle standalone "-" or "." or "-."
      if (raw === '.' || raw === '-.' || raw === '-') {
        setDisplayValue(raw)
        onValueChange?.(raw, null)
        onNumberChange?.(null)
        if (onChange) {
          if (isNumberMode) {
            onChange(null)
          } else {
            onChange(raw)
          }
        }
        return
      }

      setDisplayValue(raw)
      const parsedNum = parseFloat(raw)
      const validNum = isNaN(parsedNum) ? null : parsedNum

      onValueChange?.(raw, validNum)
      onNumberChange?.(validNum)
      if (onChange) {
        if (isNumberMode) {
          onChange(validNum)
        } else {
          onChange(raw)
        }
      }
    }

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      let cleaned = displayValue

      // Clean trailing dot or trailing "-."
      if (cleaned.endsWith('.')) {
        cleaned = cleaned.slice(0, -1)
      }
      if (cleaned === '-' || cleaned === '') {
        cleaned = ''
      }

      if (cleaned !== displayValue) {
        setDisplayValue(cleaned)
        const parsedNum = cleaned === '' ? null : parseFloat(cleaned)
        onValueChange?.(cleaned, parsedNum)
        onNumberChange?.(parsedNum)
      }

      onBlur?.(e)
    }

    return (
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        className={cn(
          'flex h-10 w-full rounded-xl border border-white/12 bg-bg-inset/70 px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-coral/60 focus-visible:border-primary-coral disabled:cursor-not-allowed disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
          className,
        )}
        ref={ref}
        value={displayValue}
        placeholder={placeholder}
        {...props}
        onChange={handleChange}
        onBlur={handleBlur}
      />
    )
  },
)

DecimalInput.displayName = 'DecimalInput'
