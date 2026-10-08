/**
 * Server market spot (the ticker's fallback when MT4 is stale) and the rate used
 * for backend valuations (margins, account summary, P&L metal revaluation).
 */

const {
  fetchFredPreciousMetalSpotBundle,
  fetchAlphaVantagePreciousMetalSpotBundle,
  fetchSilvDataPreciousMetalSpotBundle,
} = require('../metalSpotFeeds')
const { createMetalPricingHelpers } = require('../../routes/erp-accounting/reportRoutesMetalPricing')
const { computeMarginMetricsRaw } = require('./metalMarginPolicy')
const { toMoney } = require('../../shared/money')

const TROY_OUNCE_GRAMS = 31.1034768
const MT4_BRIDGE_SOURCE = 'mt4-bridge'
const TENANT_SAVED_MARKET_SOURCES = ['inventory', 'local-metal-rate']

function resolveMt4StaleMs() {
  return Math.max(5000, Number(process.env.MT4_LIVE_STALE_MS || 30000))
}

function marketSpotToLiveRates(market = {}) {
  const unit = String(market.unit || 'toz').toLowerCase()
  const perToz = unit === 'toz' || unit === 'oz'
  const metals = market.metals || {}
  const gold = Number(metals.gold) || 0
  const silver = Number(metals.silver) || 0
  const platinum = Number(metals.platinum) || 0
  if (gold <= 0 || silver <= 0 || platinum <= 0) return null

  const toGram = (price) => (perToz ? price / TROY_OUNCE_GRAMS : price)
  return {
    goldPrice: toGram(gold),
    silverPrice: toGram(silver),
    platinumPrice: toGram(platinum),
    priceCurrency: String(market.currency || 'USD').trim().toUpperCase() || 'USD',
    priceUnit: 'G',
    sourceGoldPrice: gold,
    sourceSilverPrice: silver,
    sourcePlatinumPrice: platinum,
    sourceUnit: perToz ? 'TOZ' : 'G',
    source: String(market.source || 'market').trim() || 'market',
    updatedAt: market.updatedAt || new Date(),
  }
}

function createMarketSpotResolver({ Currency, InventoryItem, MetalRate }) {
  const {
    fetchExternalMetalPrices,
    buildFallbackMetalPrices,
    getCurrencyMultiplier,
  } = createMetalPricingHelpers(
    { Currency, InventoryItem, MetalRate, toMoney },
    computeMarginMetricsRaw,
  )

  const scaleUsdPerOzMetalsToRequest = async (metalsObj, currency, unit) => {
    const mult = await getCurrencyMultiplier('USD', currency)
    const unitFactor = String(unit || 'toz').toLowerCase() === 'g'
      ? 1 / TROY_OUNCE_GRAMS
      : String(unit || 'toz').toLowerCase() === 'kg'
        ? 32.1507465686
        : 1
    const out = {}
    for (const k of ['gold', 'silver', 'platinum', 'palladium']) {
      const raw = Number(metalsObj[k] || 0)
      out[k] = Number.isFinite(raw) && raw > 0 ? toMoney(raw * mult * unitFactor) : 0
    }
    return out
  }

  const fromUsdBundle = async (raw, currency, unit) => ({
    ...raw,
    metals: await scaleUsdPerOzMetalsToRequest(raw.metals, currency, unit),
    currency: String(currency || 'USD').toUpperCase(),
    unit: String(unit || 'toz').toLowerCase(),
  })

  const resolveServerMarketSpot = async ({ currency = 'USD', unit = 'toz' } = {}) => {
    const fredKey = String(process.env.FRED_API_KEY || '').trim()
    const alphaKey = String(process.env.METALS_ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE_API_KEY || '').trim()
    const attempts = [
      () => fetchExternalMetalPrices({ currency, unit }),
      async () => fromUsdBundle(await fetchSilvDataPreciousMetalSpotBundle(), currency, unit),
      fredKey ? async () => fromUsdBundle(await fetchFredPreciousMetalSpotBundle(), currency, unit) : null,
      alphaKey ? async () => fromUsdBundle(await fetchAlphaVantagePreciousMetalSpotBundle({ apiKey: alphaKey }), currency, unit) : null,
    ].filter(Boolean)

    for (const attempt of attempts) {
      try {
        const market = await attempt()
        if (market) return market
      } catch {
        // try the next provider
      }
    }
    return buildFallbackMetalPrices({ currency, unit })
  }

  return { resolveServerMarketSpot }
}

function toPlainRate(rate = {}, priceSource) {
  return {
    goldPrice: Number(rate.goldPrice || 0),
    silverPrice: Number(rate.silverPrice || 0),
    platinumPrice: Number(rate.platinumPrice || 0),
    priceCurrency: rate.priceCurrency || 'USD',
    updatedAt: rate.updatedAt || null,
    source: rate.source || '',
    priceSource,
  }
}

/**
 * Valuation rate that matches the ticker: the MT4 rate while it is fresh, the
 * server market price once MT4 has gone stale. `priceSource` is 'mt4', 'market',
 * 'mt4-stale' (market unavailable) or 'saved' (no MT4 feed at all).
 */
function createValuationMetalRateResolver({
  getLatestMetalRate,
  resolveServerMarketSpot,
  cacheMs = 60000,
  now = () => Date.now(),
}) {
  // External spot is tenant-independent USD, so one short cache serves every tenant.
  let marketCache = null

  const loadMarketRates = async () => {
    if (marketCache && marketCache.expiresAt > now()) return marketCache.rates
    let rates = null
    try {
      rates = marketSpotToLiveRates(await resolveServerMarketSpot({ currency: 'USD', unit: 'toz' }))
    } catch {
      rates = null
    }
    if (!rates || TENANT_SAVED_MARKET_SOURCES.includes(rates.source)) return null
    marketCache = { rates, expiresAt: now() + cacheMs }
    return rates
  }

  return async function getValuationMetalRate() {
    const latest = await getLatestMetalRate()
    if (!latest) return null
    if (String(latest.source || '').toLowerCase() !== MT4_BRIDGE_SOURCE) return toPlainRate(latest, 'saved')

    const feedAgeMs = now() - new Date(latest.updatedAt || 0).getTime()
    if (feedAgeMs <= resolveMt4StaleMs()) return toPlainRate(latest, 'mt4')

    const market = await loadMarketRates()
    if (!market) return { ...toPlainRate(latest, 'mt4-stale'), feedUpdatedAt: latest.updatedAt || null }
    return { ...toPlainRate(market, 'market'), feedUpdatedAt: latest.updatedAt || null }
  }
}

module.exports = {
  marketSpotToLiveRates,
  createMarketSpotResolver,
  createValuationMetalRateResolver,
  resolveMt4StaleMs,
}
