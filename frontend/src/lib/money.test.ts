import { describe, expect, it } from 'vitest'
import { formatCurrency } from './money'

// Intl.NumberFormat separates the currency symbol from the amount with a
// non-breaking space (U+00A0). Normalize it so assertions read naturally.
const NON_BREAKING_SPACE = String.fromCharCode(0xa0)

function normalized(value: string | number): string {
  return formatCurrency(value).split(NON_BREAKING_SPACE).join(' ')
}

describe('formatCurrency', () => {
  it('formats amounts as Colombian pesos, never USD', () => {
    const formatted = formatCurrency(1700000)
    expect(formatted).not.toContain('USD')
    expect(formatted).not.toContain('US$')
    expect(formatted).toContain('$')
  })

  it('uses the Colombian grouping and no decimals for whole pesos', () => {
    expect(normalized(1500)).toBe('$ 1.500')
    expect(normalized(100000)).toBe('$ 100.000')
    expect(normalized(1700000)).toBe('$ 1.700.000')
    expect(normalized(10000000)).toBe('$ 10.000.000')
  })

  it('accepts the numeric strings the backend returns and drops trailing cents', () => {
    expect(normalized('1500.00')).toBe('$ 1.500')
    expect(normalized('1700000.00')).toBe('$ 1.700.000')
  })

  it('never renders a fractional part for COP', () => {
    for (const value of [1500, 100000, 1700000, 10000000]) {
      expect(normalized(value)).not.toMatch(/[.,]\d{2}$/)
    }
  })
})
