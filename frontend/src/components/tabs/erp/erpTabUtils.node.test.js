import { describe, expect, test } from 'vitest'
import {
  DEFAULT_INVENTORY_STOCK_CODE_SETTINGS,
  accountLookupText,
  buildAutoStockCode,
  buildUniqueStockCode,
  createInventoryMappingForm,
  decodeInventoryCategoryMeta,
  decodeInventoryCategoryPairs,
  encodeInventoryCategoryMeta,
  formatVatPercent,
  resolveAccountIdFromInput,
  titleCaseWords,
} from './erpTabUtils'

describe('erpTabUtils (node)', () => {
  test('accountLookupText joins code and name', () => {
    expect(accountLookupText({ accountCode: '1000', accountName: 'Cash' })).toBe('1000 - Cash')
    expect(accountLookupText({ accountCode: '', accountName: 'Only' })).toBe('Only')
    expect(accountLookupText({})).toBe('')
  })

  test('resolveAccountIdFromInput resolves by id, code, or label', () => {
    const options = [
      { _id: '507f1f77bcf86cd799439011', accountCode: '1000', accountName: 'Cash' },
      { _id: '507f1f77bcf86cd799439012', accountCode: '2000', accountName: 'AP' },
    ]
    expect(resolveAccountIdFromInput('507f1f77bcf86cd799439011', options)).toBe('507f1f77bcf86cd799439011')
    expect(resolveAccountIdFromInput('1000', options)).toBe('507f1f77bcf86cd799439011')
    expect(resolveAccountIdFromInput('1000 - Cash', options)).toBe('507f1f77bcf86cd799439011')
    expect(resolveAccountIdFromInput('', options)).toBe('')
  })

  test('buildAutoStockCode respects metal-purity vs prefix-metal-purity', () => {
    const form = createInventoryMappingForm()
    expect(buildAutoStockCode(form, { format: 'metal-purity', prefix: 'RM' })).toBe('GOLD')
    expect(buildAutoStockCode(form, { format: 'prefix-metal-purity', prefix: 'RM' })).toBe('RM-GOLD')
  })

  test('buildUniqueStockCode appends suffix when sku collides', () => {
    const products = [{ _id: 'a', sku: 'GOLD' }, { _id: 'b', sku: 'GOLD-2' }]
    expect(buildUniqueStockCode('GOLD', products, 'c')).toBe('GOLD-3')
    expect(buildUniqueStockCode('NEW', products, '')).toBe('NEW')
  })

  test('encode and decode inventory category meta round-trip keys', () => {
    const encoded = encodeInventoryCategoryMeta({
      mainStock: 'Gold',
      metalType: 'gold',
      priceUnit: 'OZ',
      priceCurrency: 'USD',
    })
    expect(encoded).toContain('mainStock=gold')
    const decoded = decodeInventoryCategoryMeta(encoded)
    expect(decoded.mainStock).toBe('gold')
    expect(decoded.metalType).toBe('gold')
  })

  test('decodeInventoryCategoryPairs returns raw map', () => {
    expect(decodeInventoryCategoryPairs('a=1;b=2')).toEqual({ a: '1', b: '2' })
  })

  test('formatVatPercent handles empty and numbers', () => {
    expect(formatVatPercent('')).toBe('-')
    expect(formatVatPercent(5.5)).toBe('5.5%')
  })

  test('titleCaseWords normalizes separators', () => {
    expect(titleCaseWords('hello_world')).toBe('Hello World')
  })

  test('DEFAULT_INVENTORY_STOCK_CODE_SETTINGS shape', () => {
    expect(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS.format).toBe('metal-purity')
    expect(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS.prefix).toBe('RM')
  })
})
