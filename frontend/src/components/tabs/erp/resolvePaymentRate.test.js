import { describe, expect, it } from 'vitest'
import { resolvePaymentRateFromMaster } from './resolvePaymentRate'

describe('resolvePaymentRateFromMaster', () => {
  it('uses Currency Master AED (1 USD = 3.674) instead of a rounded settle like 0.28', () => {
    const currencies = [
      { code: 'USD', exchangeRate: 1, baseCurrency: true },
      { code: 'AED', exchangeRate: 1 / 3.674, baseCurrency: false },
    ]
    const resolved = resolvePaymentRateFromMaster('AED', {
      currencyOptions: currencies,
      getBackendRate: (code) => currencies.find((row) => row.code === code)?.exchangeRate,
    })
    expect(resolved.source).toBe('currency_table')
    expect(resolved.rate).toBeCloseTo(3.674, 6)
    // Backend settle = 1/display ≈ 0.272183 — not 0.28
    expect(1 / resolved.rate).toBeCloseTo(1 / 3.674, 6)
    expect(1 / resolved.rate).not.toBeCloseTo(0.28, 2)
  })

  it('uses prior master 0.2723 as display 3.6724 when that is what is stored', () => {
    const currencies = [
      { code: 'USD', exchangeRate: 1 },
      { code: 'AED', exchangeRate: 0.2723 },
    ]
    const resolved = resolvePaymentRateFromMaster('AED', { currencyOptions: currencies })
    expect(resolved.rate).toBeCloseTo(1 / 0.2723, 4)
  })
})
