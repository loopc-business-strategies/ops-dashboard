import { describe, expect, test } from 'vitest'
import { EMPTY_VENDOR_FORM, vendorToFormState } from './vendorFormDefaults'

describe('vendorFormDefaults', () => {
  test('vendorToFormState maps vendor record to form fields', () => {
    const form = vendorToFormState({
      _id: 'v1',
      vendorCode: 'V-001',
      name: 'Acme Supplies',
      paymentTermsDays: 45,
      rating: 4,
      tags: ['preferred', 'metal'],
      preferredCurrency: 'EUR',
      currency: 'USD',
    })
    expect(form.name).toBe('Acme Supplies')
    expect(form.paymentTermsDays).toBe('45')
    expect(form.rating).toBe('4')
    expect(form.tags).toBe('preferred, metal')
    expect(form.preferredCurrency).toBe('EUR')
  })

  test('EMPTY_VENDOR_FORM has expected defaults', () => {
    expect(EMPTY_VENDOR_FORM.paymentTermsDays).toBe('30')
    expect(EMPTY_VENDOR_FORM.preferredCurrency).toBe('USD')
    expect(EMPTY_VENDOR_FORM.status).toBe('active')
  })
})
