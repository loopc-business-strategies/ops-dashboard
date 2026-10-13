const {
  catalogQuantityFromMovements,
  isCatalogInventoryProduct,
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
})