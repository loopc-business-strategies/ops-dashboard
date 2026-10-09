const { createVoucherVatService } = require('../../services/erpAccounting/voucherVatService')

const noop = () => {}

describe('voucherVatService', () => {
  const svc = createVoucherVatService({
    ensureAccountByCode: noop,
    AccountMapping: {},
    Ledger: {},
    BASE_CURRENCY_CODE: 'USD',
    toMoney: (n) => Math.round(n * 100) / 100,
  })

  test('resolveVoucherLineVatAmount prefers vatAmountLC', () => {
    expect(svc.resolveVoucherLineVatAmount({ vatAmountLC: 12.5 })).toBe(12.5)
  })

  test('resolveVoucherLineVatAmount derives from amountWithVAT minus total', () => {
    expect(svc.resolveVoucherLineVatAmount({ amountWithVAT: 110, totalAmount: 100 })).toBe(10)
  })

  test('resolveVatLedgerMoney keeps a dollar VAT row in dollars', () => {
    expect(svc.resolveVatLedgerMoney({ vatAmount: 12, currency: 'USD', exchangeRate: 1 })).toEqual({
      amount: 12,
      currency: 'USD',
      exchangeRate: 1,
    })
  })

  test('resolveVatLedgerMoney stores som VAT so amount times rate equals the dollar VAT', () => {
    const rate = 1 / 12100
    const row = svc.resolveVatLedgerMoney({ vatAmount: 12, currency: 'UZS', exchangeRate: rate })
    expect(row.currency).toBe('UZS')
    expect(row.amount).toBe(145200)
    expect(row.amount * row.exchangeRate).toBeCloseTo(12, 2)
  })

  test('resolveVoucherVatAmount sums lines', () => {
    const tx = {
      voucherMeta: {
        lineItems: [
          { vatAmountLC: 1 },
          { amountWithVAT: 50, totalAmount: 45 },
        ],
      },
    }
    expect(svc.resolveVoucherVatAmount(tx)).toBe(6)
  })
})
