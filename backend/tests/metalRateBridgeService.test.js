const {
  normalizeBridgeMetalRates,
  buildMetalRatesResponse,
  TROY_OUNCE_GRAMS,
} = require('../services/erpAccounting/metalRateBridgeService')

describe('metal rate bridge service', () => {
  test('normalizes MT4 troy-ounce bid/ask quotes into ERP gram prices', () => {
    const rates = normalizeBridgeMetalRates({
      source: 'mt4-bridge',
      currency: 'USD',
      unit: 'toz',
      metals: {
        gold: { bid: 3310, ask: 3312 },
        silver: { bid: 36, ask: 36.2 },
        platinum: { bid: 1290, ask: 1292 },
      },
    })

    expect(rates.priceCurrency).toBe('USD')
    expect(rates.priceUnit).toBe('G')
    expect(rates.sourceUnit).toBe('TOZ')
    expect(rates.sourcePrices.gold).toBeCloseTo(3311, 6)
    expect(rates.goldPrice).toBeCloseTo(3311 / TROY_OUNCE_GRAMS, 6)
    expect(rates.silverPrice).toBeCloseTo(36.1 / TROY_OUNCE_GRAMS, 6)
    expect(rates.platinumPrice).toBeCloseTo(1291 / TROY_OUNCE_GRAMS, 6)
  })

  test('includes original bridge prices for topbar troy-ounce display', () => {
    const response = buildMetalRatesResponse({
      goldPrice: 3311 / TROY_OUNCE_GRAMS,
      silverPrice: 36.1 / TROY_OUNCE_GRAMS,
      platinumPrice: 1291 / TROY_OUNCE_GRAMS,
      priceCurrency: 'USD',
      priceUnit: 'G',
      source: 'mt4-bridge',
      sourcePayload: {
        sourceUnit: 'TOZ',
        sourcePrices: { gold: 3311, silver: 36.1, platinum: 1291 },
      },
    })

    expect(response.priceUnit).toBe('G')
    expect(response.sourceUnit).toBe('TOZ')
    expect(response.sourceGoldPrice).toBeCloseTo(3311, 6)
    expect(response.sourceSilverPrice).toBeCloseTo(36.1, 6)
    expect(response.sourcePlatinumPrice).toBeCloseTo(1291, 6)
  })

  test('requires gold, silver, and platinum', () => {
    expect(() => normalizeBridgeMetalRates({
      currency: 'USD',
      unit: 'toz',
      metals: {
        gold: { bid: 3310, ask: 3312 },
        silver: { bid: 36, ask: 36.2 },
      },
    }, {
      platinumPrice: 42,
    })).toThrow('Gold, silver, and platinum prices are required')
  })
})
