import { describe, expect, test } from 'vitest'
import { buildReferenceEditFormState } from './referenceEditFormDefaults'

describe('referenceEditFormDefaults', () => {
  test('buildReferenceEditFormState maps currency with units-per-base quote', () => {
    const form = buildReferenceEditFormState('currency', {
      code: 'UZS',
      name: 'Som',
      symbol: 'soʻm',
      exchangeRate: 0.00008,
      baseCurrency: false,
    })
    expect(form.code).toBe('UZS')
    expect(Number(form.oneUsdEquals)).toBeCloseTo(12500)
  })

  test('buildReferenceEditFormState maps customer record', () => {
    const form = buildReferenceEditFormState('customer', {
      name: 'Acme',
      creditLimit: 5000,
      paymentTermsDays: 30,
      currency: 'USD',
    })
    expect(form.name).toBe('Acme')
    expect(form.creditLimit).toBe(5000)
  })
})
