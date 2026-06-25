const {
  resolveBridgeFanoutTenants,
  upsertBridgeRatesForTenant,
  normalizeBridgeMetalRates,
} = require('../services/erpAccounting/metalRateBridgeService')

describe('metal rate bridge fan-out', () => {
  const env = (value) => ({ METAL_RATES_BRIDGE_FANOUT_TENANTS: value })

  test('defaults to all catalog tenants when env unset', () => {
    expect(resolveBridgeFanoutTenants('mg', {})).toEqual(['cg', 'loopc', 'mg'])
  })

  test('all expands to every catalog tenant', () => {
    expect(resolveBridgeFanoutTenants('mg', env('all'))).toEqual(['cg', 'loopc', 'mg'])
  })

  test('comma list uses explicit tenants and includes source when missing', () => {
    expect(resolveBridgeFanoutTenants('mg', env('cg,loopc'))).toEqual(['cg', 'loopc', 'mg'])
    expect(resolveBridgeFanoutTenants('cg', env('mg,loopc'))).toEqual(['cg', 'loopc', 'mg'])
  })

  test('single tenant value limits fan-out', () => {
    expect(resolveBridgeFanoutTenants('mg', env('mg'))).toEqual(['mg'])
    expect(resolveBridgeFanoutTenants('cg', env('mg'))).toEqual(['mg'])
  })

  test('ignores invalid tenant keys in comma list', () => {
    expect(resolveBridgeFanoutTenants('mg', env('cg,invalid,loopc'))).toEqual(['cg', 'loopc', 'mg'])
  })

  test('returns empty array for invalid source tenant', () => {
    expect(resolveBridgeFanoutTenants('unknown', env('all'))).toEqual([])
  })

  test('upsertBridgeRatesForTenant upserts normalized bridge payload', async () => {
    const normalized = normalizeBridgeMetalRates({
      source: 'mt4-bridge',
      currency: 'USD',
      unit: 'toz',
      metals: {
        gold: { bid: 3310, ask: 3312 },
        silver: { bid: 36, ask: 36.2 },
        platinum: { bid: 1290, ask: 1292 },
      },
    })

    const store = { goldPrice: 100 }
    const MetalRateModel = {
      findOne: jest.fn(() => ({
        sort: jest.fn(async () => ({ goldPrice: store.goldPrice })),
      })),
      findOneAndUpdate: jest.fn(async () => ({
        goldPrice: normalized.goldPrice,
        silverPrice: normalized.silverPrice,
        platinumPrice: normalized.platinumPrice,
        priceCurrency: normalized.priceCurrency,
        priceUnit: normalized.priceUnit,
        source: normalized.source,
        sourcePayload: {
          sourceUnit: normalized.sourceUnit,
          sourcePrices: normalized.sourcePrices,
        },
        updatedAt: new Date('2026-06-24T12:00:00.000Z'),
      })),
    }

    const result = await upsertBridgeRatesForTenant({
      MetalRateModel,
      normalized,
      symbols: { gold: 'XAUUSD.pr' },
    })

    expect(MetalRateModel.findOneAndUpdate).toHaveBeenCalledWith(
      { source: 'mt4-bridge' },
      expect.objectContaining({
        $set: expect.objectContaining({
          goldPrice: normalized.goldPrice,
          source: 'mt4-bridge',
        }),
      }),
      expect.objectContaining({ upsert: true }),
    )
    expect(result.oldGold).toBe(100)
    expect(result.rates.source).toBe('mt4-bridge')
    expect(result.rates.sourceGoldPrice).toBeCloseTo(3311, 4)
  })
})
