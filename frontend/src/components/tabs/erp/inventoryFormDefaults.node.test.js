import { describe, expect, test } from 'vitest'
import {
  buildInventoryMappingPayload,
  computeInventoryProductPurityWeight,
  mappingProductToFormState,
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
})
