import { describe, expect, test } from 'vitest'
import {
  combineVoucherStatementRows,
  isStrictCashStatementType,
  resolveBreakEvenPricePerGram,
} from './useAccountEnquiryStatement'

describe('isStrictCashStatementType', () => {
  test('includes posted journal vouchers (referenceType journal), not only legacy jv', () => {
    expect(isStrictCashStatementType('journal')).toBe(true)
    expect(isStrictCashStatementType('jv')).toBe(true)
    expect(isStrictCashStatementType('bank_jv')).toBe(true)
    expect(isStrictCashStatementType('payment')).toBe(true)
    expect(isStrictCashStatementType('receipt')).toBe(true)
  })

  test('rejects non-cash statement types', () => {
    expect(isStrictCashStatementType('direct_deal')).toBe(false)
    expect(isStrictCashStatementType('metal_transfer')).toBe(false)
    expect(isStrictCashStatementType('')).toBe(false)
  })
})

describe('combineVoucherStatementRows', () => {
  test('keeps each fixing-deal line as its own buy or sell row', () => {
    const dealLine = (n, overrides) => ({
      referenceType: 'direct_deal',
      sourceTransactionId: 'deal-1',
      sourceTransactionNumber: 'ORD/2026/000001',
      metalFixStatus: 'fixed',
      metalCode: 'XAU',
      isMetalTrade: true,
      notes: `Direct deal line ${n}`,
      ...overrides,
    })
    const rows = combineVoucherStatementRows([
      dealLine(1, { _id: 'l1', sourceTransactionType: 'sale', metalDealType: 'sale', debitAmount: 13181.81, signedAmount: 13181.81, metalSignedWeight: 100 }),
      dealLine(2, { _id: 'l2', sourceTransactionType: 'purchase', metalDealType: 'purchase', creditAmount: 6590.9, signedAmount: -6590.9, metalSignedWeight: -50 }),
    ])

    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ metalDealType: 'sale', debitAmount: 13181.81, creditAmount: 0, metalSignedWeight: 100 })
    expect(rows[1]).toMatchObject({ metalDealType: 'purchase', debitAmount: 0, creditAmount: 6590.9, metalSignedWeight: -50 })
  })

  test('still merges the ledger lines of one voucher into a single row', () => {
    const rows = combineVoucherStatementRows([
      { _id: 'a', referenceType: 'purchase', sourceTransactionId: 'tx-1', sourceTransactionType: 'purchase', creditAmount: 26000, signedAmount: -26000 },
      { _id: 'b', referenceType: 'purchase', sourceTransactionId: 'tx-1', sourceTransactionType: 'purchase', creditAmount: 313.23, signedAmount: -313.23 },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].creditAmount).toBe(26313.23)
  })

  test('keeps mixed metal_payment lines as separate gold and silver rows', () => {
    const rows = combineVoucherStatementRows([
      {
        _id: 'transfer:tx-aml:0',
        referenceType: 'metal_payment',
        sourceTransactionId: 'tx-aml',
        sourceTransactionType: 'metal_payment',
        metalDealType: 'metal_payment',
        metalCode: 'XAU',
        isMetalTrade: true,
        isMetalTransfer: true,
        lineNarration: 'Alloy metal loss 15.336 g Gold 24K Bar',
        metalSignedWeight: 15.336,
        debitAmount: 0,
        creditAmount: 0,
        signedAmount: 0,
      },
      {
        _id: 'transfer:tx-aml:1',
        referenceType: 'metal_payment',
        sourceTransactionId: 'tx-aml',
        sourceTransactionType: 'metal_payment',
        metalDealType: 'metal_payment',
        metalCode: 'XAG',
        isMetalTrade: true,
        isMetalTransfer: true,
        lineNarration: 'Alloy metal loss 3.834 g Fine Silver',
        metalSignedWeight: 3.834,
        debitAmount: 0,
        creditAmount: 0,
        signedAmount: 0,
      },
    ])
    expect(rows).toHaveLength(2)
    const gold = rows.find((row) => row.metalCode === 'XAU')
    const silver = rows.find((row) => row.metalCode === 'XAG')
    expect(Number(gold?.metalSignedWeight)).toBeCloseTo(15.336, 3)
    expect(Number(silver?.metalSignedWeight)).toBeCloseTo(3.834, 3)
    expect(String(gold?.lineNarration || '')).toMatch(/15\.336 g Gold/)
    expect(String(silver?.lineNarration || '')).toMatch(/3\.834 g Fine Silver/)
  })
})

describe('resolveBreakEvenPricePerGram', () => {
  test('has no break-even when cash and metal are both in the customer favour', () => {
    expect(resolveBreakEvenPricePerGram(-19722.32, 50)).toBeNull()
  })

  test('is the price where the metal value cancels a debit balance', () => {
    expect(resolveBreakEvenPricePerGram(26292205.87, 200200)).toBeCloseTo(131.3297, 4)
  })

  test('is the price where a credit balance covers metal owed by the customer', () => {
    expect(resolveBreakEvenPricePerGram(-13000, -100)).toBeCloseTo(130, 6)
  })

  test('has no break-even without metal', () => {
    expect(resolveBreakEvenPricePerGram(5000, 0)).toBeNull()
  })
})
