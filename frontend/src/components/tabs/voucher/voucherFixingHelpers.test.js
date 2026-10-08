import { describe, expect, test } from 'vitest'
import {
  canFixVoucher,
  computeVoucherFixingAmount,
  fromPerOunceRate,
  resolveVoucherFixingBadge,
  resolveVoucherIndicativeTotalNote,
  summarizeVoucherFixing,
  toPerOunceRate,
} from './voucherFixingHelpers'

const unfixedPurchase = (fixings = [], overrides = {}) => ({
  type: 'purchase',
  status: 'posted',
  voucherMeta: {
    fixingType: 'non-fixing',
    lineItems: [{ stockCode: 'GOLD', pureWeight: 199.98, rateType: 'OZ' }],
    fixings,
  },
  ...overrides,
})

describe('voucherFixingHelpers', () => {
  test('open grams ignore removed fixings', () => {
    const state = summarizeVoucherFixing(unfixedPurchase([
      { pureWeight: 100 },
      { pureWeight: 50, isDeleted: true },
    ]))
    expect(state.fixedWeight).toBe(100)
    expect(state.openWeight).toBeCloseTo(99.98, 6)
    expect(state.metalCode).toBe('XAU')
  })

  test('badge shows unfixed, part fixed and fixed later', () => {
    expect(resolveVoucherFixingBadge(unfixedPurchase()).label).toBe('Unfixed')
    expect(resolveVoucherFixingBadge(unfixedPurchase([{ pureWeight: 100 }])).label).toBe('Part fixed (99.98 g open)')
    expect(resolveVoucherFixingBadge(unfixedPurchase([{ pureWeight: 199.98 }])).label).toBe('Fixed later')
    expect(resolveVoucherFixingBadge({ voucherMeta: { fixingType: 'fixing' } }).label).toBe('Fixed')
  })

  test('only posted unfixed sale/purchase vouchers with open grams can be fixed', () => {
    expect(canFixVoucher(unfixedPurchase())).toBe(true)
    expect(canFixVoucher(unfixedPurchase([], { status: 'draft' }))).toBe(false)
    expect(canFixVoucher(unfixedPurchase([{ pureWeight: 199.98 }]))).toBe(false)
    expect(canFixVoucher(unfixedPurchase([], { type: 'metal_receipt' }))).toBe(false)
  })

  test('list total is indicative only for unfixed sale and purchase vouchers', () => {
    expect(resolveVoucherIndicativeTotalNote(unfixedPurchase())).toMatchObject({ label: 'indicative' })
    expect(resolveVoucherIndicativeTotalNote(unfixedPurchase()).title).toContain('only the premium is posted')
    expect(resolveVoucherIndicativeTotalNote(unfixedPurchase([{ pureWeight: 100 }])).title).toContain('100.00 g of 199.98 g fixed')
    expect(resolveVoucherIndicativeTotalNote(unfixedPurchase([], { type: 'sale' }))).not.toBeNull()
    expect(resolveVoucherIndicativeTotalNote({ type: 'purchase', voucherMeta: { fixingType: 'fixing' } })).toBeNull()
    expect(resolveVoucherIndicativeTotalNote(unfixedPurchase([], { type: 'metal_receipt' }))).toBeNull()
  })

  test('amount and rate conversions follow the rate unit', () => {
    expect(computeVoucherFixingAmount({ pureWeight: 31.1034768, rate: 4000, rateType: 'OZ' })).toBe(4000)
    expect(computeVoucherFixingAmount({ pureWeight: 10, rate: 130, rateType: 'GRAM' })).toBe(1300)
    expect(toPerOunceRate(130, 'GRAM')).toBeCloseTo(130 * 31.1034768, 6)
    expect(fromPerOunceRate(toPerOunceRate(128000, 'KG'), 'KG')).toBeCloseTo(128000, 6)
  })
})
