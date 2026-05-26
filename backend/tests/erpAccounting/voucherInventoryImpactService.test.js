const { createVoucherInventoryImpactService } = require('../../services/erpAccounting/voucherInventoryImpactService')

describe('voucherInventoryImpactService', () => {
  const toQty = (n) => Math.round(n * 1000) / 1000
  const svc = createVoucherInventoryImpactService({
    ensureAccountByCode: async () => ({ _id: '1' }),
    InventoryItem: {},
    StockMovement: {},
    Ledger: {},
    toQty,
    toMoney: (n) => n,
    BASE_CURRENCY_CODE: 'USD',
  })

  test('resolveVoucherInventoryLineQuantity uses grossWeight first', () => {
    expect(svc.resolveVoucherInventoryLineQuantity({ grossWeight: 10 })).toBe(10)
  })

  test('resolveVoucherInventoryLineQuantity converts troy oz to grams (matches toQty rounding)', () => {
    const q = svc.resolveVoucherInventoryLineQuantity({ weightInOz: 1 })
    expect(q).toBeCloseTo(31.103, 3)
  })
})
