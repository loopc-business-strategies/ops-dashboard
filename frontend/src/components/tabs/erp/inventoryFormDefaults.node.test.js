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

  test('computeInventoryProductPurityWeight applies purity factor', () => {
    expect(computeInventoryProductPurityWeight({ weight: '10', purity: '0.999' })).toBeCloseTo(9.99)
    expect(computeInventoryProductPurityWeight({ weight: '10', purity: '999' })).toBeCloseTo(9.99)
  })
})
