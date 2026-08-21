import { describe, it, expect } from 'vitest'
import { formatCurrency, formatCurrencyParts, formatPercent, formatNumber } from '@/lib/format'

describe('formatCurrencyParts & formatCurrency', () => {
  it('splits positive numbers into integer and fraction parts', () => {
    const parts = formatCurrencyParts(810.37)
    expect(parts.integer).toBe('810')
    expect(parts.fraction).toBe('37')
    expect(parts.sign).toBe('')
    expect(parts.symbol).toBe('$')
    expect(parts.full).toBe('$810.37')
  })

  it('splits decimal strings from backend into integer and fraction parts', () => {
    const parts = formatCurrencyParts('12500.5')
    expect(parts.integer).toBe('12,500')
    expect(parts.fraction).toBe('50')
    expect(parts.full).toBe('$12,500.50')
  })

  it('formats positive signed numbers with sign before dollar sign (+)', () => {
    const parts = formatCurrencyParts(783.84, { showSign: true })
    expect(parts.sign).toBe('+')
    expect(parts.full).toBe('+$783.84')
    expect(formatCurrency(783.84, { showSign: true })).toBe('+$783.84')
  })

  it('formats negative signed numbers with sign before dollar sign (-)', () => {
    const parts = formatCurrencyParts(-307.21, { showSign: true })
    expect(parts.sign).toBe('-')
    expect(parts.full).toBe('-$307.21')
    expect(formatCurrency(-307.21)).toBe('-$307.21')
  })

  it('handles negative string decimals from backend', () => {
    const parts = formatCurrencyParts('-307.206598761038829332')
    expect(parts.integer).toBe('307')
    expect(parts.fraction).toBe('21')
    expect(parts.full).toBe('-$307.21')
  })

  it('handles zero cleanly', () => {
    const parts = formatCurrencyParts(0)
    expect(parts.integer).toBe('0')
    expect(parts.fraction).toBe('00')
    expect(parts.full).toBe('$0.00')
  })

  it('handles null and undefined fallbacks', () => {
    expect(formatCurrencyParts(null).full).toBe('$0.00')
    expect(formatCurrencyParts(undefined).full).toBe('$0.00')
    expect(formatCurrency(null)).toBe('$0.00')
  })
})

describe('formatPercent', () => {
  it('formats positive percentage with sign', () => {
    expect(formatPercent(2954.47)).toBe('+2954.47%')
  })

  it('formats negative percentage with sign', () => {
    expect(formatPercent(-27.49)).toBe('-27.49%')
  })
})
