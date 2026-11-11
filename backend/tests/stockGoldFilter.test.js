const {
  isGoldInventoryItem,
  isGoldVaultProduct,
  inferMetalTypeFromItem,
  titleCaseMetal,
} = require('../services/productionControl/stockService')

describe('gold-only vault stock filter', () => {
  test('includes Inventory Gold main-stock products only', () => {
    expect(isGoldInventoryItem({ name: 'Gold 99.5', category: 'mainStock=gold' })).toBe(true)
    expect(isGoldInventoryItem({ name: '18K Alloyed Gold', category: 'mainStock=gold;recordType=product' })).toBe(true)
    expect(isGoldInventoryItem({ name: 'Gold Bar', category: 'mainStock=gold;recordType=product;productPurity=1' })).toBe(true)
    expect(isGoldInventoryItem({ name: '14 k chain', category: 'mainStock=gold;recordType=product' })).toBe(true)
  })

  test('excludes Alloy category and non-gold metals', () => {
    expect(isGoldInventoryItem({ name: '18K Alloyed Gold', category: 'mainStock=alloy' })).toBe(false)
    expect(isGoldInventoryItem({ name: '14K alloy', category: 'mainStock=alloy' })).toBe(false)
    expect(isGoldInventoryItem({ name: '14K alloy', metalType: 'Gold' })).toBe(false)
    expect(isGoldInventoryItem({ name: 'cadmium', category: 'mainStock=cadmium' })).toBe(false)
    expect(isGoldInventoryItem({ name: 'pure copper', category: 'mainStock=copper' })).toBe(false)
    expect(isGoldInventoryItem({ name: 'silver pure', category: 'mainStock=silver' })).toBe(false)
    expect(isGoldInventoryItem({ name: 'platinum scrap', category: 'mainStock=platinum' })).toBe(false)
  })

  test('does not default copper to Gold', () => {
    expect(inferMetalTypeFromItem({ name: 'pure copper', category: 'mainStock=copper' })).toBe('Copper')
    expect(titleCaseMetal('copper')).toBe('Copper')
    expect(inferMetalTypeFromItem({ name: 'mystery powder' })).toBe('Other')
  })

  test('vault product helper matches metalType/product', () => {
    expect(isGoldVaultProduct({ product: 'Gold bar', metalType: 'Gold' })).toBe(true)
    expect(isGoldVaultProduct({ product: 'pure copper', metalType: 'Gold' })).toBe(false)
    expect(isGoldVaultProduct({ product: '14K alloy', metalType: 'Alloy' })).toBe(false)
    expect(isGoldVaultProduct({ product: 'cadmium', metalType: 'Cadmium' })).toBe(false)
  })
})
