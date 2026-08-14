/**
 * Centralized formatting utilities for dates, currency, numbers, and percentages.
 */

const defaultDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const defaultDateTimeFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

/**
 * Formats an ISO string, timestamp, or Date into standard readable date (e.g. "Aug 14, 2026").
 */
export function formatDate(
  dateInput?: string | number | Date | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!dateInput) return '—'
  try {
    const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput)
    if (Number.isNaN(d.getTime())) return String(dateInput)
    if (options) {
      return new Intl.DateTimeFormat('en-US', options).format(d)
    }
    return defaultDateFormatter.format(d)
  } catch {
    return String(dateInput)
  }
}

/**
 * Formats an ISO string, timestamp, or Date into readable date + time (e.g. "Aug 14, 02:28 PM").
 */
export function formatDateTime(
  dateInput?: string | number | Date | null,
  options?: { utc?: boolean } & Intl.DateTimeFormatOptions,
): string {
  if (!dateInput) return '—'
  try {
    const d = typeof dateInput === 'object' && dateInput instanceof Date ? dateInput : new Date(dateInput)
    if (Number.isNaN(d.getTime())) return String(dateInput)
    if (options) {
      const { utc, ...fmtOptions } = options
      return new Intl.DateTimeFormat('en-US', {
        ...(utc ? { timeZone: 'UTC' } : {}),
        ...fmtOptions,
      }).format(d)
    }
    return defaultDateTimeFormatter.format(d)
  } catch {
    return String(dateInput)
  }
}

export interface FormatCurrencyOptions {
  decimals?: number
  showSign?: boolean
  prefix?: string
}

/**
 * Formats a numeric value into USD currency string (e.g. "$1,234.56" or "+$1,234.56").
 */
export function formatCurrency(
  amount?: number | null,
  options: FormatCurrencyOptions = {},
): string {
  if (amount === undefined || amount === null || Number.isNaN(amount)) return '$0.00'
  const { decimals = 2, showSign = false, prefix = '$' } = options
  const absFormatted = Math.abs(amount).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })

  if (showSign) {
    const sign = amount > 0 ? '+' : amount < 0 ? '-' : ''
    return `${sign}${prefix}${absFormatted}`
  }

  return `${amount < 0 ? '-' : ''}${prefix}${absFormatted}`
}

export interface FormatNumberOptions {
  minDecimals?: number
  maxDecimals?: number
}

/**
 * Formats a number with comma separators and decimal precision.
 */
export function formatNumber(
  value?: number | null,
  options: FormatNumberOptions = {},
): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '0'
  const { minDecimals = 0, maxDecimals = 6 } = options
  return value.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  })
}

/**
 * Formats a percentage value (e.g. "+12.34%" or "-5.20%").
 */
export function formatPercent(
  value?: number | null,
  options: { decimals?: number; showSign?: boolean } = {},
): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '0.00%'
  const { decimals = 2, showSign = true } = options
  const sign = showSign && value > 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

/**
 * Formats minimum raise amount for vaults (e.g. "$100 USD" or "$1 USD").
 */
export function formatMinRaise(min?: number | null): string {
  if (!min || min <= 0) return '$1 USD'
  return `$${min.toLocaleString('en-US')} USD`
}
