const {
  accumulateUnfixedMetalFromTransactions,
  accumulateDirectDealMetalForCustomer,
  accumulateDirectDealMetalIntoMap,
  mergeMetalPositions,
  resolveDirectDealLineSignedWeight,
  resolveUnfixedVoucherWeightSign,
  resolveDirectDealCompanyDirection,
  isUnfixedFixingType,
} = require('../services/erpAccounting/metalPositionPolicy')

describe('metalPositionPolicy', () => {
  test('isUnfixedFixingType recognizes unfixed variants', () => {
    expect(isUnfixedFixingType('non-fixing')).toBe(true)
    expect(isUnfixedFixingType('fixing')).toBe(false)
  })

  test('direct deal buy adds metal held for the customer (positive grams)', () => {
    const signed = resolveDirectDealLineSignedWeight({
      direction: 'buy',
      qty: 10000,
      stockCode: 'GRAM',
    })
    expect(signed).toBeCloseTo(10000, 6)
  })

  test('direct deal sell removes metal from the customer (negative grams)', () => {
    const signed = resolveDirectDealLineSignedWeight({
      direction: 'sell',
      qty: 200,
      stockCode: 'GRAM',
    })
    expect(signed).toBeCloseTo(-200, 6)
  })

  test('unfixed voucher grams follow the trade side: sale Dr (+), purchase Cr (-)', () => {
    expect(resolveUnfixedVoucherWeightSign('sale')).toBe(1)
    expect(resolveUnfixedVoucherWeightSign('purchase')).toBe(-1)
    expect(resolveUnfixedVoucherWeightSign('receipt')).toBe(0)

    const position = accumulateUnfixedMetalFromTransactions([
      { type: 'sale', voucherMeta: { fixingType: 'non-fixing', lineItems: [{ stockCode: 'XAU', pureWeight: 50 }] } },
      { type: 'purchase', voucherMeta: { fixingType: 'non-fixing', lineItems: [{ stockCode: 'XAG', pureWeight: 30 }] } },
      { type: 'purchase', voucherMeta: { fixingType: 'fixing', lineItems: [{ stockCode: 'XAU', pureWeight: 999 }] } },
    ])
    expect(position.gold).toBeCloseTo(50, 6)
    expect(position.silver).toBeCloseTo(-30, 6)
  })

  test('direct deal direction converts to the company side for MG reports', () => {
    expect(resolveDirectDealCompanyDirection('buy')).toBe('sell')
    expect(resolveDirectDealCompanyDirection(' Sell ')).toBe('buy')
    expect(resolveDirectDealCompanyDirection('')).toBe('')
  })

  test('direct deal buy then unfixed purchase back nets to the remaining grams', () => {
    const customerId = 'cust-1303'
    const metalTxs = [{
      customerId,
      type: 'purchase',
      voucherMeta: {
        fixingType: 'non-fixing',
        lineItems: [{ stockCode: 'XAU', pureWeight: 199.98 }],
      },
    }]
    const directDeals = [{
      lineItems: [{
        customerId,
        direction: 'buy',
        metal: 'XAU',
        qty: 200,
        stockCode: 'GRAM',
      }],
    }]

    const unfixed = accumulateUnfixedMetalFromTransactions(metalTxs)
    const direct = accumulateDirectDealMetalForCustomer(directDeals, customerId)
    const merged = mergeMetalPositions(unfixed, direct)

    expect(merged.gold).toBeCloseTo(0.02, 6)
    expect(merged.silver).toBe(0)
  })

  test('fixings close the unfixed grams of their voucher; removed fixings do not', () => {
    const position = accumulateUnfixedMetalFromTransactions([
      {
        type: 'purchase',
        voucherMeta: {
          fixingType: 'non-fixing',
          lineItems: [{ stockCode: 'XAU', pureWeight: 199.98 }],
          fixings: [
            { pureWeight: 150, metalCode: 'XAU' },
            { pureWeight: 49.98, metalCode: 'XAU', isDeleted: true },
          ],
        },
      },
      {
        type: 'sale',
        voucherMeta: {
          fixingType: 'non-fixing',
          lineItems: [{ stockCode: 'XAG', pureWeight: 1000 }],
          fixings: [{ pureWeight: 1000, metalCode: 'XAG' }],
        },
      },
    ])
    expect(position.gold).toBeCloseTo(-49.98, 6)
    expect(position.silver).toBeCloseTo(0, 6)
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

    expect(map.get(customerId).goldPosition).toBeCloseTo(500, 6)
  })
})
