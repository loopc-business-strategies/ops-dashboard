const {
  accumulateUnfixedMetalFromTransactions,
  accumulateDirectDealMetalForCustomer,
  accumulateDirectDealMetalIntoMap,
  mergeMetalPositions,
  resolveDirectDealLineSignedWeight,
  isUnfixedFixingType,
} = require('../services/erpAccounting/metalPositionPolicy')

describe('metalPositionPolicy', () => {
  test('isUnfixedFixingType recognizes unfixed variants', () => {
    expect(isUnfixedFixingType('non-fixing')).toBe(true)
    expect(isUnfixedFixingType('fixing')).toBe(false)
  })

  test('direct deal buy direction credits metal (negative grams)', () => {
    const signed = resolveDirectDealLineSignedWeight({
      direction: 'buy',
      qty: 10000,
      stockCode: 'GRAM',
    })
    expect(signed).toBeCloseTo(-10000, 6)
  })

  test('net position combines unfixed purchase and direct deal sale', () => {
    const customerId = 'cust-1303'
    const metalTxs = [{
      customerId,
      type: 'purchase',
      voucherMeta: {
        fixingType: 'non-fixing',
        lineItems: [{ stockCode: 'XAU', pureWeight: 995 }],
      },
    }]
    const directDeals = [{
      lineItems: [{
        customerId,
        direction: 'buy',
        metal: 'XAU',
        qty: 10000,
        stockCode: 'GRAM',
      }],
    }]

    const unfixed = accumulateUnfixedMetalFromTransactions(metalTxs)
    const direct = accumulateDirectDealMetalForCustomer(directDeals, customerId)
    const merged = mergeMetalPositions(unfixed, direct)

    expect(merged.gold).toBeCloseTo(-9005, 6)
    expect(merged.silver).toBe(0)
  })

  test('accumulateDirectDealMetalIntoMap merges into customer margin map', () => {
    const customerId = 'cust-map'
    const map = new Map()
    accumulateDirectDealMetalIntoMap([{
      lineItems: [{
        customerId,
        direction: 'buy',
        metal: 'XAU',
        qty: 500,
        stockCode: 'GRAM',
      }],
    }], map)

    expect(map.get(customerId).goldPosition).toBeCloseTo(-500, 6)
  })
})
