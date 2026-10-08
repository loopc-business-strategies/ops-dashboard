const { describe, expect, test } = require('@jest/globals')
const { createValuationMetalRateResolver } = require('../services/erpAccounting/metalValuationRates')

const NOW = new Date('2026-10-08T04:00:00.000Z').getTime()
const mt4Rate = (ageMs) => ({
  source: 'mt4-bridge',
  goldPrice: 4134.36 / 31.1034768,
  silverPrice: 2,
  priceCurrency: 'USD',
  updatedAt: new Date(NOW - ageMs),
})
const marketSpot = { source: 'metals.dev', unit: 'toz', currency: 'USD', metals: { gold: 4105.05, silver: 60, platinum: 1633 } }

const buildResolver = (latest, resolveServerMarketSpot = jest.fn(async () => marketSpot)) => ({
  resolveServerMarketSpot,
  getValuationMetalRate: createValuationMetalRateResolver({
    getLatestMetalRate: async () => latest,
    resolveServerMarketSpot,
    now: () => NOW,
  }),
})

describe('valuation metal rate', () => {
  test('uses the MT4 rate while the feed is fresh', async () => {
    const { getValuationMetalRate, resolveServerMarketSpot } = buildResolver(mt4Rate(5000))

    const rate = await getValuationMetalRate()

    expect(rate.priceSource).toBe('mt4')
    expect(rate.goldPrice * 31.1034768).toBeCloseTo(4134.36, 2)
    expect(resolveServerMarketSpot).not.toHaveBeenCalled()
  })

  test('switches to the market price once MT4 is stale, like the ticker', async () => {
    const { getValuationMetalRate, resolveServerMarketSpot } = buildResolver(mt4Rate(13 * 60 * 60 * 1000))

    const rate = await getValuationMetalRate()
    await getValuationMetalRate()

    expect(rate.priceSource).toBe('market')
    expect(rate.goldPrice * 31.1034768).toBeCloseTo(4105.05, 2)
    expect(rate.feedUpdatedAt).toEqual(new Date(NOW - 13 * 60 * 60 * 1000))
    expect(resolveServerMarketSpot).toHaveBeenCalledTimes(1)
  })

  test('keeps the stale MT4 rate, flagged, when no market price is available', async () => {
    const { getValuationMetalRate } = buildResolver(
      mt4Rate(60 * 60 * 1000),
      jest.fn(async () => ({ source: 'local-metal-rate', unit: 'toz', metals: { gold: 1, silver: 1, platinum: 1 } })),
    )

    const rate = await getValuationMetalRate()

    expect(rate.priceSource).toBe('mt4-stale')
    expect(rate.goldPrice * 31.1034768).toBeCloseTo(4134.36, 2)
  })

  test('leaves saved rates alone when there is no MT4 feed', async () => {
    const { getValuationMetalRate, resolveServerMarketSpot } = buildResolver({ source: 'manual', goldPrice: 130, silverPrice: 2 })

    const rate = await getValuationMetalRate()

    expect(rate).toMatchObject({ priceSource: 'saved', goldPrice: 130 })
    expect(resolveServerMarketSpot).not.toHaveBeenCalled()
  })
})
