const {
  normalizeBridgeMetalRates,
  TROY_OUNCE_GRAMS,
} = require('../services/erpAccounting/metalRateBridgeService')

describe('metal rate bridge service', () => {
  test('normalizes MT5 troy-ounce bid/ask quotes into ERP gram prices', () => {
    const rates = normalizeBridgeMetalRates({
      source: 'mt5-bridge',
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
    expect(rates.goldPrice).toBeCloseTo(3311 / TROY_OUNCE_GRAMS, 6)
    expect(rates.silverPrice).toBeCloseTo(36.1 / TROY_OUNCE_GRAMS, 6)
    expect(rates.platinumPrice).toBeCloseTo(1291 / TROY_OUNCE_GRAMS, 6)
  })

  test('requires gold and silver but allows platinum to fallback to zero', () => {
    expect(() => normalizeBridgeMetalRates({
      currency: 'USD',
      unit: 'toz',
      metals: {
        gold: { bid: 3310, ask: 3312 },
      },
    })).toThrow('Gold and silver prices are required')
  })
})
