import { describe, expect, test } from 'vitest'
import {
  buildInventoryMappingPayload,
  computeInventoryProductPurityWeight,
  computeInventoryPureStockQty,
  computeInventoryStockValue,
  mappingProductToFormState,
  resolveInventoryPurityFactor,
  resolveProductLinePurity,
} from './inventoryFormDefaults'

describe('inventoryFormDefaults', () => {
  test('mappingProductToFormState decodes stock mapping row', () => {
    const form = mappingProductToFormState({
      _id: 'p1',
      sku: 'AU-999',
      name: 'Gold Main Stock',
      unitCost: 2500,
      currency: 'USD',
      category: 'mainStock=gold;metalType=gold;priceUnit=OZ;priceCurrency=USD',
    })
    expect(form.stockCode).toBe('AU-999')
    expect(form.mainStock).toBe('gold')
    expect(form.currentPrice).toBe('2500')
    expect(form.priceUnit).toBe('OZ')
  })

  test('buildInventoryMappingPayload resolves sku for non-admin', () => {
    const payload = buildInventoryMappingPayload({
      form: {
        mainStock: 'gold',
        customMainStock: '',
        metalType: 'gold',
        stockCode: '',
        priceUnit: 'OZ',
        priceCurrency: 'USD',
        currentPrice: '100',
        openingQty: '5',
      },
      includeOpeningQty: true,
      inventoryStockCodeSettings: { format: 'metal-purity', prefix: 'MG' },
      inventoryMappingProducts: [],
      editingProductId: '',
      isSuperAdmin: false,
    })
    expect(payload.sku).toBeTruthy()
    expect(payload.quantity).toBe(5)
    expect(payload.name).toContain('Gold')
  })

  test('mapping and payload fall through to tenant base when currency missing', () => {
    const form = mappingProductToFormState({ sku: 'X', name: 'Stock', unitCost: 0, category: 'mainStock=gold' }, 'AED')
    expect(form.currency).toBe('AED')
    expect(form.priceCurrency).toBe('AED')
    const payload = buildInventoryMappingPayload({
      form: {
        mainStock: 'gold',
        metalType: 'gold',
        stockCode: 'G1',
        currentPrice: '10',
        openingQty: '1',
      },
      includeOpeningQty: true,
      inventoryStockCodeSettings: { format: 'metal-purity', prefix: 'MG' },
      inventoryMappingProducts: [],
      editingProductId: '',
      isSuperAdmin: true,
      baseCurrencyCode: 'AED',
    })
    expect(payload.currency).toBe('AED')
  })

  test('computeInventoryProductPurityWeight applies purity factor', () => {
    expect(computeInventoryProductPurityWeight({ weight: '10', purity: '0.999' })).toBeCloseTo(9.99)
    expect(computeInventoryProductPurityWeight({ weight: '10', purity: '999' })).toBeCloseTo(9.99)
  })

  test('resolveInventoryPurityFactor handles ratio and millesimal', () => {
    expect(resolveInventoryPurityFactor('')).toBe(0)
    expect(resolveInventoryPurityFactor('0')).toBe(0)
    expect(resolveInventoryPurityFactor('1')).toBe(1)
    expect(resolveInventoryPurityFactor('0.916')).toBeCloseTo(0.916)
    expect(resolveInventoryPurityFactor('916')).toBeCloseTo(0.916)
  })

  test('computeInventoryPureStockQty does not treat missing purity as 1', () => {
    expect(computeInventoryPureStockQty(1000, '')).toBe(0)
    expect(computeInventoryPureStockQty(1000, '0')).toBe(0)
    expect(computeInventoryPureStockQty(1000, '1')).toBe(1000)
    expect(computeInventoryPureStockQty(1000, '0.916')).toBeCloseTo(916)
  })

  test('computeInventoryStockValue uses pure qty when purity is set', () => {
    expect(computeInventoryStockValue(1000, 10, '')).toBe(10000)
    expect(computeInventoryStockValue(1000, 10, '0')).toBe(10000)
    expect(computeInventoryStockValue(1000, 10, '1')).toBe(10000)
    expect(computeInventoryStockValue(1000, 10, '0.916')).toBeCloseTo(9160)
  })
})

describe('resolveProductLinePurity', () => {
  test('catalog purity wins over karat name when not a fine leak', () => {
    expect(resolveProductLinePurity({ productPurity: '916', productName: '22k alloy' })).toBe('916')
    expect(resolveProductLinePurity({ productPurity: '0.916', productName: '22k alloy' })).toBe('0.916')
  })

  test('infers karat from product name when catalog purity is 0/missing', () => {
    expect(resolveProductLinePurity({ productPurity: '0', productName: '22k alloy' })).toBe('0.916667')
    expect(resolveProductLinePurity({ productPurity: '', productName: '18k' })).toBe('0.75')
    expect(resolveProductLinePurity({ productPurity: null, productName: '14K ring' })).toBe('0.583333')
  })

  test('rejects productPurity=1 leak when name karat is under 24', () => {
    expect(resolveProductLinePurity({ productPurity: '1', productName: '14k alloyed Gold' })).toBe('0.583333')
    expect(resolveProductLinePurity({ productPurity: '1.0', productName: '22k Chain' })).toBe('0.916667')
  })

  test('keeps fine purity=1 when name is fine / 24k / no karat', () => {
    expect(resolveProductLinePurity({ productPurity: '1', productName: 'Pure Gold' })).toBe('1')
    expect(resolveProductLinePurity({ productPurity: '1', productName: '24k bar' })).toBe('1')
  })

  test('returns empty when no catalog purity and no karat in name', () => {
    expect(resolveProductLinePurity({ productPurity: '0', productName: 'Pure Gold' })).toBe('')
    expect(resolveProductLinePurity({ productPurity: '', productName: 'pure copper' })).toBe('')
  })
})

describe('buildCatalogProductPayload purity guard', () => {
  test('sanitizes purity=1 leak into category productPurity from karat name', async () => {
    const { buildCatalogProductPayload } = await import('./inventoryFormDefaults')
    const payload = buildCatalogProductPayload({
      inventoryProductForm: {
        stockTypeId: 's1',
        categoryName: 'Gold',
        name: '14k Alloy',
        description: '',
        weight: '10',
        grossWeight: '10',
        purity: '1',
        taxType: 'VAT',
        vatPercent: '0',
      },
      inventoryMappingProducts: [{ _id: 's1', category: 'mainStock=gold;metalType=gold', currency: 'USD' }],
      inventoryCatalogProducts: [],
      editingInventoryProductId: '',
      selectedInventoryStockType: { mainStock: 'gold' },
      productPurityWeight: 0,
      baseCurrencyCode: 'USD',
    })
    expect(payload.category).toMatch(/productPurity=0\.583333/)
  })
})
