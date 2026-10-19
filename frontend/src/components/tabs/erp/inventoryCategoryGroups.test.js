import { describe, expect, test } from 'vitest'
import { buildVaultStockGroups, groupInventoryTableRows } from './inventoryCategoryGroups'

describe('groupInventoryTableRows', () => {
  test('groups by the stored category and title-cases the heading', () => {
    const rows = [
      { item: { _id: '1', category: 'gold', name: 'Gold Bar' }, categoryMeta: { mainStock: 'gold' } },
      { item: { _id: '2', category: 'alloy', name: '14K alloy' }, categoryMeta: { mainStock: 'alloy' } },
      { item: { _id: '3', category: 'gold', name: '14 k chain' }, categoryMeta: { mainStock: 'gold' } },
      { item: { _id: '4', category: '', name: 'Unsorted' }, categoryMeta: {} },
    ]
    expect(groupInventoryTableRows(rows).map((group) => ({
      category: group.category,
      names: group.rows.map((row) => row.item.name),
    }))).toEqual([
      { category: 'Gold', names: ['Gold Bar', '14 k chain'] },
      { category: 'Alloy', names: ['14K alloy'] },
      { category: 'Other', names: ['Unsorted'] },
    ])
  })
})

describe('buildVaultStockGroups', () => {
  test('uses gross quantity and the same pure-qty rule, and skips stock-type masters', () => {
    const groups = buildVaultStockGroups([
      { _id: 'm', name: 'Gold Main Stock', category: 'mainStock=gold;metalType=gold', quantity: 50, unit: 'grams' },
      { _id: 'a', name: 'Gold Bar', category: 'mainStock=gold;recordType=product;productPurity=1', quantity: 200, unit: 'grams' },
      { _id: 'b', name: '14K alloy', category: 'alloy', quantity: 1000, unit: 'grams' },
    ])
    expect(groups).toEqual([
      {
        category: 'Gold',
        items: [{ id: 'a', name: 'Gold Bar', category: 'Gold', grossQty: 200, pureQty: 200, unit: 'grams' }],
      },
      {
        category: 'Alloy',
        items: [{ id: 'b', name: '14K alloy', category: 'Alloy', grossQty: 1000, pureQty: 0, unit: 'grams' }],
      },
    ])
  })
})