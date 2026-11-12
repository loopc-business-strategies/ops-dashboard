const {
  catalogQuantityFromMovements,
  catalogPcsFromSignedSum,
  isCatalogInventoryProduct,
  resolveVoucherLinePcsDelta,
  roundMovementQty,
} = require('../utils/catalogOnHandQuantity')

describe('catalogOnHandQuantity', () => {
  test('treats only catalog products as movement-based stock', () => {
    expect(isCatalogInventoryProduct('mainStock=gold;recordType=product;productPurity=1')).toBe(true)
    expect(isCatalogInventoryProduct('mainStock=gold;metalType=gold')).toBe(false)
  })

  test('uses the movement total and ignores a stored piece weight', () => {
    expect(catalogQuantityFromMovements(0)).toBe(0)
    expect(catalogQuantityFromMovements(18.906)).toBe(18.906)
    expect(catalogQuantityFromMovements(-2)).toBe(0)
  })

  test('roundMovementQty keeps four decimal places', () => {
    expect(roundMovementQty(23.84123)).toBe(23.8412)
  })

  test('voucher line pcs signs match stock in and out', () => {
    expect(resolveVoucherLinePcsDelta('purchase', { pcs: 2 })).toBe(2)
    expect(resolveVoucherLinePcsDelta('sale', { pcs: 1 })).toBe(-1)
    expect(resolveVoucherLinePcsDelta('metal_transfer', { pcs: 3, transferSide: 'from' })).toBe(-3)
    expect(resolveVoucherLinePcsDelta('metal_transfer', { pcs: 3, transferSide: 'to' })).toBe(3)
    expect(catalogPcsFromSignedSum(2.4)).toBe(2)
    expect(catalogPcsFromSignedSum(-1)).toBe(0)
  })
})