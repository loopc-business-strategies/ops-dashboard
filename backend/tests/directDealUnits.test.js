const { directDealEqOzFromQtyAndStock } = require('../services/erpAccounting/directDealUnits')

describe('directDealUnits', () => {
  test('converts grams and kilos with the exact troy ounce', () => {
    expect(directDealEqOzFromQtyAndStock(200, 'KG')).toBeCloseTo(200000 / 31.1034768, 9)
    expect(directDealEqOzFromQtyAndStock(200, 'GRAM')).toBeCloseTo(200 / 31.1034768, 9)
    expect(directDealEqOzFromQtyAndStock(31.1034768, 'gram')).toBeCloseTo(1, 9)
    expect(directDealEqOzFromQtyAndStock(200, 'OZ')).toBe(200)
  })

  test('200 kg at 4,093/oz is priced on 6,430.149 oz, not 6,430.14', () => {
    expect(directDealEqOzFromQtyAndStock(200, 'KG') * 4093).toBeCloseTo(26318601.14, 1)
  })
})
