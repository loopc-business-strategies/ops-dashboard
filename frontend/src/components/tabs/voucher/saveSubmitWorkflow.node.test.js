import { describe, expect, test } from 'vitest'
import {
  formatVoucherWorkflowStatusLabel,
  isSaveSubmitOnlyVoucherType,
  isMetalStockVoucherType,
} from '../erp/voucherUtils.js'

describe('Save→Submit metal voucher helpers', () => {
  test('metal stock types are Save→Submit only', () => {
    expect(isSaveSubmitOnlyVoucherType('purchase')).toBe(true)
    expect(isSaveSubmitOnlyVoucherType('metal_payment')).toBe(true)
    expect(isSaveSubmitOnlyVoucherType('sale')).toBe(true)
    expect(isSaveSubmitOnlyVoucherType('metal_receipt')).toBe(true)
    expect(isSaveSubmitOnlyVoucherType('journal')).toBe(false)
    expect(isSaveSubmitOnlyVoucherType('payment')).toBe(false)
  })

  test('formatVoucherWorkflowStatusLabel maps posted/approved metal to submitted', () => {
    expect(formatVoucherWorkflowStatusLabel('posted', 'purchase')).toBe('submitted')
    expect(formatVoucherWorkflowStatusLabel('approved', 'metal_payment')).toBe('submitted')
    expect(formatVoucherWorkflowStatusLabel('draft', 'purchase')).toBe('draft')
    expect(formatVoucherWorkflowStatusLabel('posted', 'journal')).toBe('posted')
  })

  test('isMetalStockVoucherType aligns with Save→Submit set', () => {
    for (const t of ['purchase', 'sale', 'metal_receipt', 'metal_payment']) {
      expect(isMetalStockVoucherType(t)).toBe(true)
      expect(isSaveSubmitOnlyVoucherType(t)).toBe(true)
    }
  })
})
