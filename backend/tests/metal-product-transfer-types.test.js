const {
  isMetalProductTransferType,
  isMetalStockType,
  isMetalTransferType,
  buildStockMovementReason,
  stockMovementReasonPattern,
} = require('../utils/metalStockVoucherTypes')

describe('metalStockVoucherTypes product transfer', () => {
  test('metal_transfer is stock type but not party transfer', () => {
    expect(isMetalProductTransferType('metal_transfer')).toBe(true)
    expect(isMetalStockType('metal_transfer')).toBe(true)
    expect(isMetalTransferType('metal_transfer')).toBe(false)
  })

  test('reason and void pattern match', () => {
    const tx = { voucherMeta: { vocNo: 'MTr/2026/0001' } }
    const reason = buildStockMovementReason(tx, 'metal_transfer')
    expect(reason).toBe('Voucher metal transfer #MTr/2026/0001')
    expect(stockMovementReasonPattern('metal_transfer', 'MTr/2026/0001').test(reason)).toBe(true)
  })
})
