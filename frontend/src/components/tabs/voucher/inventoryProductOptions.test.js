import { describe, expect, test } from 'vitest'
import {
  getInventoryCatalogProductsForStock,
  getInventoryStockMappingOptions,
} from '../erp/voucherUtils'

const goldMapping = {
  _id: 'map-gold',
  sku: 'G999',
  name: 'Gold Stock',
  category: 'mainStock=gold;metalType=gold;purity=999.9',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const silverMapping = {
  _id: 'map-silver',
  sku: 'S999',
  name: 'Silver Stock',
  category: 'mainStock=silver;metalType=silver;purity=999',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const goldProductA = {
  _id: 'prod-gold-a',
  sku: 'P-22K-A',
  name: '22k alloy',
  category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=916',
  updatedAt: '2026-02-01T00:00:00.000Z',
}

const goldProductADup = {
  _id: 'prod-gold-a-dup',
  sku: 'P-22K-B',
  name: '22k alloy',
  category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=916',
  updatedAt: '2026-03-01T00:00:00.000Z',
}

const goldProductB = {
  _id: 'prod-gold-b',
  sku: 'P-PURE',
  name: 'Pure Gold',
  category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=999.9',
  updatedAt: '2026-02-15T00:00:00.000Z',
}

const silverProduct = {
  _id: 'prod-silver',
  sku: 'P-SILVER',
  name: 'pure sliver',
  category: 'mainStock=silver;metalType=silver;recordType=product;productPurity=999',
  updatedAt: '2026-02-01T00:00:00.000Z',
}

const copperProduct = {
  _id: 'prod-copper',
  sku: 'P-COPPER',
  name: 'pure copper',
  category: 'mainStock=copper;metalType=copper;recordType=product',
  updatedAt: '2026-02-01T00:00:00.000Z',
}

const inventory = [
  goldMapping,
  silverMapping,
  goldProductA,
  goldProductADup,
  goldProductB,
  silverProduct,
  copperProduct,
]

describe('getInventoryStockMappingOptions', () => {
  test('returns only stock mappings, not catalog products', () => {
    const options = getInventoryStockMappingOptions(inventory)
    expect(options.map((o) => o.code)).toEqual(['G999', 'S999'])
    expect(options.find((o) => o.code === 'G999')?.label).toBe('Gold')
  })
})

describe('getInventoryCatalogProductsForStock', () => {
  test('returns empty when no stock selected', () => {
    expect(getInventoryCatalogProductsForStock(inventory, '')).toEqual([])
  })

  test('filters catalog products to selected stock metal and dedupes by name', () => {
    const products = getInventoryCatalogProductsForStock(inventory, 'G999')
    expect(products.map((p) => p.name)).toEqual(['22k alloy', 'Pure Gold'])
    expect(products.find((p) => p.name === '22k alloy')?._id).toBe('prod-gold-a-dup')
    expect(products.some((p) => p.name === 'pure sliver')).toBe(false)
    expect(products.some((p) => p.name === 'pure copper')).toBe(false)
  })

  test('returns silver catalog only for silver stock', () => {
    const products = getInventoryCatalogProductsForStock(inventory, 'S999')
    expect(products.map((p) => p.name)).toEqual(['pure sliver'])
  })
})
