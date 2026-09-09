import { describe, expect, test } from 'vitest'
import { roundMoney } from '../../../utils/money'
import { resolveProductLineVatFields } from './resolveProductLineVat'
import { isMetalTransferVoucherType } from './voucherTabShared'

describe('resolveProductLineVatFields', () => {
  test('product vatPercent 0 clears a prior line vatPer of 10', () => {
    const resolved = resolveProductLineVatFields({
      voucherType: 'purchase',
      isMetalTransferVoucherType,
      productTaxType: 'VAT',
      productVatPercent: '0',
      lineVatType: 'VAT',
      lineVatPer: '10',
    })

    expect(resolved).toEqual({ vatType: 'VAT', vatPer: '0' })

    const baseTotal = 281336.69
    const vatPer = Number(resolved.vatPer) || 0
    const vatAmount = roundMoney((baseTotal * vatPer) / 100, 'USD')
    const amountWithVAT = roundMoney(baseTotal + vatAmount, 'USD')
    expect(vatAmount).toBe(0)
    expect(amountWithVAT).toBe(baseTotal)
  })

  test('Tax Type None forces vatPer 0 even when product percent is set', () => {
    expect(resolveProductLineVatFields({
      voucherType: 'purchase',
      isMetalTransferVoucherType,
      productTaxType: 'None',
      productVatPercent: '5',
      lineVatPer: '10',
    })).toEqual({ vatType: 'None', vatPer: '0' })
  })

  test('metal transfer forces None / 0', () => {
    expect(resolveProductLineVatFields({
      voucherType: 'metal_receipt',
      isMetalTransferVoucherType,
      productTaxType: 'VAT',
      productVatPercent: '5',
      lineVatPer: '10',
    })).toEqual({ vatType: 'None', vatPer: '0' })
  })

  test('missing product vatPercent keeps existing line rate', () => {
    expect(resolveProductLineVatFields({
      voucherType: 'purchase',
      isMetalTransferVoucherType,
      productTaxType: 'VAT',
      productVatPercent: '',
      lineVatPer: '10',
    })).toEqual({ vatType: 'VAT', vatPer: '10' })
  })

  test('positive product vatPercent overwrites line rate', () => {
    expect(resolveProductLineVatFields({
      voucherType: 'sale',
      isMetalTransferVoucherType,
      productTaxType: 'VAT',
      productVatPercent: 5,
      lineVatPer: '10',
    })).toEqual({ vatType: 'VAT', vatPer: '5' })
  })
})
