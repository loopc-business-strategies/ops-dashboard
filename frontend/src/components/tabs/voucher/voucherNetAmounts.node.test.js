import { describe, expect, test } from 'vitest'
import {
  buildNetAmountRows,
  resolveMasterUzsPerBase,
  resolveVoucherNetAmounts,
  resolveVoucherUzsPerBase,
} from './voucherNetAmounts'

const currencies = [
  { code: 'USD', exchangeRate: 1, baseCurrency: true },
  { code: 'UZS', exchangeRate: 1 / 12100 },
  { code: 'AED', exchangeRate: 0.2723 },
]

describe('voucher UZS rate', () => {
  test('master rate is shown as UZS per USD', () => {
    expect(resolveMasterUzsPerBase(currencies)).toBeCloseTo(12100, 6)
    expect(resolveMasterUzsPerBase([{ code: 'USD', exchangeRate: 1 }])).toBe(0)
  })

  test('UZS payment uses its own header rate', () => {
    const rate = resolveVoucherUzsPerBase({
      isReceiptPayment: true,
      header: { currCode: 'UZS', currRate: '11000.000000', uzsRate: '12000' },
      masterUzsPerBase: 12100,
    })
    expect(rate).toBe(11000)
  })

  test('a metal voucher in UZS uses the rate typed next to the currency', () => {
    expect(resolveVoucherUzsPerBase({
      header: { currCode: 'UZS', currRate: '11000', uzsRate: '12100' },
      masterUzsPerBase: 12100,
    })).toBe(11000)
    expect(resolveVoucherUzsPerBase({
      header: { currCode: 'UZS', currRate: '', uzsRate: '11500' },
      masterUzsPerBase: 12100,
    })).toBe(11500)
  })

  test('other vouchers use the saved rate, then today\'s master rate', () => {
    expect(resolveVoucherUzsPerBase({ header: { currCode: 'USD', uzsRate: '11500' }, masterUzsPerBase: 12100 })).toBe(11500)
    expect(resolveVoucherUzsPerBase({ header: { currCode: 'USD', uzsRate: '' }, masterUzsPerBase: 12100 })).toBe(12100)
  })
})

describe('resolveVoucherNetAmounts', () => {
  test('UZS payment: USD from line LC, UZS from line FC', () => {
    const result = resolveVoucherNetAmounts({
      isReceiptPayment: true,
      lineItems: [{ currCode: 'UZS', amountFC: '145990130', amountLC: '13271.83' }],
      baseCurrencyCode: 'USD',
      uzsPerBase: 11000,
    })
    expect(result.baseAmount).toBe(13271.83)
    expect(result.uzsAmount).toBe(145990130)
  })

  test('USD metal purchase converts the base total at the voucher UZS rate', () => {
    const result = resolveVoucherNetAmounts({
      isReceiptPayment: false,
      grandTotal: 13271.83,
      baseCurrencyCode: 'USD',
      uzsPerBase: 12100,
    })
    expect(result.baseAmount).toBe(13271.83)
    expect(result.uzsAmount).toBeCloseTo(160589143, 2)
  })

  test('mixed receipt lines: UZS line keeps FC, USD line converts', () => {
    const result = resolveVoucherNetAmounts({
      isReceiptPayment: true,
      lineItems: [
        { currCode: 'UZS', amountFC: '1100000', amountLC: '100' },
        { currCode: 'USD', amountFC: '50', amountLC: '50' },
      ],
      baseCurrencyCode: 'USD',
      uzsPerBase: 11000,
    })
    expect(result.baseAmount).toBe(150)
    expect(result.uzsAmount).toBe(1650000)
  })

  test('no UZS row when UZS is not configured', () => {
    const result = resolveVoucherNetAmounts({ grandTotal: 100, baseCurrencyCode: 'USD', uzsPerBase: 0 })
    expect(result.uzsAmount).toBeNull()
  })
})

describe('buildNetAmountRows', () => {
  test('UZS payment shows USD and UZS without a rate note', () => {
    const rows = buildNetAmountRows({
      voucherCurrency: 'UZS',
      voucherTotal: 145990130,
      voucherNetAmounts: { baseCurrency: 'USD', baseAmount: 13271.83, uzsAmount: 145990130, uzsPerBase: 11000 },
    })
    expect(rows).toEqual([
      { code: 'USD', amount: 13271.83 },
      { code: 'UZS', amount: 145990130 },
    ])
  })

  test('USD purchase shows USD and UZS with the rate used', () => {
    const rows = buildNetAmountRows({
      voucherCurrency: 'USD',
      voucherTotal: 13271.83,
      voucherNetAmounts: { baseCurrency: 'USD', baseAmount: 13271.83, uzsAmount: 160589143, uzsPerBase: 12100 },
    })
    expect(rows).toEqual([
      { code: 'USD', amount: 13271.83 },
      { code: 'UZS', amount: 160589143, rateNote: '@ 12,100.00 UZS/USD' },
    ])
  })

  test('AED voucher keeps its own row first', () => {
    const rows = buildNetAmountRows({
      voucherCurrency: 'AED',
      voucherTotal: 367.4,
      voucherNetAmounts: { baseCurrency: 'USD', baseAmount: 100, uzsAmount: 1210000, uzsPerBase: 12100 },
    })
    expect(rows.map((row) => row.code)).toEqual(['AED', 'USD', 'UZS'])
    expect(rows[0].amount).toBe(367.4)
  })

  test('falls back to the single voucher-currency row', () => {
    expect(buildNetAmountRows({ voucherCurrency: 'usd', voucherTotal: 5 })).toEqual([{ code: 'USD', amount: 5 }])
  })

  test('USD-header payment with only UZS lines shows no rate note', () => {
    const voucherNetAmounts = resolveVoucherNetAmounts({
      isReceiptPayment: true,
      lineItems: [{ currCode: 'UZS', amountFC: 145990130, amountLC: 13271.83 }],
      baseCurrencyCode: 'USD',
      uzsPerBase: 12100,
    })
    expect(voucherNetAmounts.usesRate).toBe(false)
    expect(buildNetAmountRows({ voucherCurrency: 'USD', voucherTotal: 145990130, voucherNetAmounts })).toEqual([
      { code: 'USD', amount: 13271.83 },
      { code: 'UZS', amount: 145990130 },
    ])
  })
})
