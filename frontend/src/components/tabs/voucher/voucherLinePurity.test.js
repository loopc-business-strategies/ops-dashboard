import { describe, expect, test } from 'vitest'
import {
  parseKaratFromProductName,
  resolveCatalogProductForVoucherLine,
  resolveVoucherLinePurityFromProduct,
} from './voucherLinePurity'

describe('voucherLinePurity', () => {
  test('parseKaratFromProductName reads karat tokens', () => {
    expect(parseKaratFromProductName('22k alloy')).toBe(22)
    expect(parseKaratFromProductName('18K')).toBe(18)
    expect(parseKaratFromProductName('Pure Gold')).toBeNull()
    expect(parseKaratFromProductName('25k')).toBeNull()
  })

  test('stored 1 with 22k name uses karat-derived purity', () => {
    expect(resolveVoucherLinePurityFromProduct({
      productName: '22k alloy',
      productPurity: '1',
    })).toBe('0.916667')
  })

  test('blank stored purity with 18k name uses karat ratio', () => {
    expect(resolveVoucherLinePurityFromProduct({
      productName: '18k',
      productPurity: '',
    })).toBe('0.75')
  })

  test('Pure Gold / 24k keeps purity 1', () => {
    expect(resolveVoucherLinePurityFromProduct({
      productName: 'Pure Gold',
      productPurity: '1',
    })).toBe('1')
    expect(resolveVoucherLinePurityFromProduct({
      productName: '24k gold',
      productPurity: '1',
    })).toBe('1')
  })

  test('millesimal catalog purity is kept when not a leak', () => {
    expect(resolveVoucherLinePurityFromProduct({
      productName: '22k alloy',
      productPurity: '916',
    })).toBe('916')
  })

  test('resolveCatalogProductForVoucherLine prefers id then name', () => {
    const catalog = [
      { _id: 'a1', name: '22k alloy' },
      { _id: 'a2', name: '22k alloy' },
    ]
    expect(resolveCatalogProductForVoucherLine({
      catalogProducts: catalog,
      productName: '22k alloy',
      inventoryItemId: 'a2',
    })?._id).toBe('a2')
    expect(resolveCatalogProductForVoucherLine({
      catalogProducts: catalog,
      productName: '22k alloy',
      inventoryItemId: '',
    })?._id).toBe('a1')
  })
})
