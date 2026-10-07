const { describe, expect, test } = require('@jest/globals')
const {
  accumulateMetalOwedToParties,
  computeMetalBookRevaluation,
  resolveInventoryItemPureStock,
} = require('../services/erpAccounting/metalBookRevaluation')

const GOLD_PER_GRAM = 4093 / 31.1034768
const goldBar = (quantity) => ({
  category: 'mainStock=gold;metalType=gold;recordType=product;productPurity=1',
  quantity,
})
const unfixedPurchase = (grams) => ({
  type: 'purchase',
  voucherMeta: { fixingType: 'unfixed', lineItems: [{ pureWeight: grams, stockCode: 'GOLD' }] },
})
const customerBuysKg = (kg) => ({
  lineItems: [{ customerId: 'uzex', direction: 'buy', qty: kg, stockCode: 'KG', metal: 'XAU' }],
})

describe('metal book revaluation', () => {
  test('values a short fixing deal at market, net of inventory book value', () => {
    const result = computeMetalBookRevaluation({
      inventoryItems: [goldBar(400)],
      inventoryBookValue: 26357.15,
      unfixedVouchers: [unfixedPurchase(200)],
      directDeals: [customerBuysKg(200)],
      rates: { goldPrice: GOLD_PER_GRAM, silverPrice: 0 },
    })

    const gold = result.metals.find((row) => row.metal === 'gold')
    expect(gold).toMatchObject({ stockGrams: 400, owedGrams: 200200, netGrams: -199800 })
    expect(result.adjustment).toBeCloseTo(-199800 * GOLD_PER_GRAM - 26357.15, 2)
  })

  test('once the metal is bought and delivered, only the purchase cost and the long remainder are left', () => {
    const supplierCost = 26300000
    const result = computeMetalBookRevaluation({
      inventoryItems: [goldBar(400)],
      inventoryBookValue: 26357.15 + supplierCost,
      unfixedVouchers: [unfixedPurchase(200)],
      transfers: [{ type: 'metal_payment', voucherMeta: { lineItems: [{ pureWeight: 200000, stockCode: 'GOLD' }] } }],
      directDeals: [customerBuysKg(200)],
      rates: { goldPrice: GOLD_PER_GRAM, silverPrice: 0 },
    })

    expect(result.metals.find((row) => row.metal === 'gold').netGrams).toBe(200)
    expect(result.adjustment).toBeCloseTo(200 * GOLD_PER_GRAM - 26357.15 - supplierCost, 2)
  })

  test('metal receipts are owed to the party and payments settle them', () => {
    const owed = accumulateMetalOwedToParties({
      transfers: [
        { type: 'metal_receipt', voucherMeta: { lineItems: [{ pureWeight: 50, stockCode: 'GOLD' }] } },
        { type: 'metal_payment', voucherMeta: { lineItems: [{ pureWeight: 30, stockCode: 'GOLD' }] } },
        { type: 'metal_receipt', voucherMeta: { lineItems: [{ pureWeight: 1000, stockCode: 'SILV' }] } },
      ],
    })

    expect(owed).toEqual({ gold: 20, silver: 1000 })
  })

  test('applies item purity and skips metals without a live price', () => {
    expect(resolveInventoryItemPureStock({
      category: 'mainStock=gold;metalType=gold;productPurity=0.995',
      quantity: 1000,
    })).toEqual({ metal: 'gold', grams: 995 })
    expect(resolveInventoryItemPureStock({
      category: 'mainStock=platinum;metalType=platinum',
      quantity: 10,
    })).toBeNull()
  })
})
