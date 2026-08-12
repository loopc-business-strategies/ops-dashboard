import { describe, expect, it } from 'vitest'
import {
  buildProfessionalCurrencyTitle,
  buildProfessionalMetalInvoiceTitle,
  isProfessionalMetalVoucherType,
} from './professionalVoucherPrint'

describe('professionalVoucherPrint helpers', () => {
  it('identifies all professional metal voucher types including sale', () => {
    expect(isProfessionalMetalVoucherType('purchase')).toBe(true)
    expect(isProfessionalMetalVoucherType('sale')).toBe(true)
    expect(isProfessionalMetalVoucherType('metal_receipt')).toBe(true)
    expect(isProfessionalMetalVoucherType('metal_payment')).toBe(true)
    expect(isProfessionalMetalVoucherType('payment')).toBe(false)
  })

  it('builds metal invoice titles per voucher type', () => {
    expect(buildProfessionalMetalInvoiceTitle('sale', 'FIXED')).toBe('TAX INVOICE (FIXED)')
    expect(buildProfessionalMetalInvoiceTitle('purchase', 'FIXED')).toBe('PURCHASE INVOICE (FIXED)')
  })

  it('builds currency voucher titles', () => {
    expect(buildProfessionalCurrencyTitle('payment')).toBe('PAYMENT VOUCHER')
    expect(buildProfessionalCurrencyTitle('receipt')).toBe('RECEIPT VOUCHER')
  })
})
