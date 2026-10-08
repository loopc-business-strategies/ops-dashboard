import { describe, expect, test } from 'vitest'
import { combineVoucherStatementRows, resolveBreakEvenPricePerGram } from './useAccountEnquiryStatement'

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
