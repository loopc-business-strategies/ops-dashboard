import { describe, expect, test } from 'vitest'
import { buildVaultStockGroups } from './vaultInventory'

describe('buildVaultStockGroups', () => {
  test('groups report products by category and skips stock-type masters', () => {
    const groups = buildVaultStockGroups([
      { _id: 'master', name: 'Gold Main Stock', category: 'mainStock=gold', quantity: 9999, unit: 'grams' },
      { _id: 'bar', name: 'Gold Bar', category: 'mainStock=gold;recordType=product;productPurity=1', quantity: 200, unit: 'grams' },
      { _id: 'alloy', name: '14K alloy', category: 'alloy', quantity: 1000, unit: 'grams' },
      { _id: 'empty', name: 'Empty Copper', category: 'copper', quantity: 0, unit: 'grams' },
    ])

    expect(groups.map((group) => group.category)).toEqual(['Gold', 'Alloy'])
    expect(JSON.stringify(groups)).not.toContain('Empty Copper')
    expect(groups[0].items[0]).toMatchObject({ name: 'Gold Bar', grossQty: 200, pureQty: 200, unit: 'grams' })
    expect(groups[1].items[0]).toMatchObject({ name: '14K alloy', grossQty: 1000, pureQty: 0, unit: 'grams' })
    expect(JSON.stringify(groups)).not.toContain('Gold Main Stock')
  })

  test('orders categories Gold, Silver, Copper, Alloy', () => {
    const groups = buildVaultStockGroups([
      { _id: 'a', name: '14K alloy', category: 'mainStock=alloy;recordType=product', quantity: 10, unit: 'grams' },
      { _id: 'c', name: 'pure copper', category: 'mainStock=copper;recordType=product', quantity: 20, unit: 'grams' },
      { _id: 's', name: 'silver pure', category: 'mainStock=silver;recordType=product', quantity: 30, unit: 'grams' },
      { _id: 'g', name: 'Gold Bar', category: 'mainStock=gold;recordType=product;productPurity=1', quantity: 40, unit: 'grams' },
      { _id: 'o', name: 'Other item', category: 'mainStock=cadmium;recordType=product', quantity: 5, unit: 'grams' },
    ])

    expect(groups.map((group) => group.category)).toEqual(['Gold', 'Silver', 'Copper', 'Alloy', 'Cadmium'])
  })
})
