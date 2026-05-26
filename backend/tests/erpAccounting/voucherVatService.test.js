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
