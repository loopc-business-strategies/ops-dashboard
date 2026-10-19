import { describe, expect, test } from 'vitest'
import { buildVaultStockGroups } from './vaultInventory'

describe('buildVaultStockGroups', () => {
  test('groups report products by category and skips stock-type masters', () => {
    const groups = buildVaultStockGroups([
      { _id: 'master', name: 'Gold Main Stock', category: 'mainStock=gold', quantity: 9999, unit: 'grams' },
      { _id: 'bar', name: 'Gold Bar', category: 'mainStock=gold;recordType=product;productPurity=1', quantity: 200, unit: 'grams' },
      { _id: 'alloy', name: '14K alloy', category: 'alloy', quantity: 1000, unit: 'grams' },
    ])

    expect(groups.map((group) => group.category)).toEqual(['Gold', 'Alloy'])
    expect(groups[0].items[0]).toMatchObject({ name: 'Gold Bar', grossQty: 200, pureQty: 200, unit: 'grams' })
    expect(groups[1].items[0]).toMatchObject({ name: '14K alloy', grossQty: 1000, pureQty: 0, unit: 'grams' })
    expect(JSON.stringify(groups)).not.toContain('Gold Main Stock')
  })
})
