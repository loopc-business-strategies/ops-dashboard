const MetalRate = require('../../models/MetalRate')
const { DEFAULT_METAL_RATES } = require('../erpAccounting/reportBrandingService')

async function buildMetalRatesSnapshot() {
  const NON_FEED_SOURCES = ['manual', 'default', 'inventory']
  const latestFeed = await MetalRate.findOne({
    source: { $nin: NON_FEED_SOURCES },
    goldPrice: { $gt: 0 },
    silverPrice: { $gt: 0 },
  }).sort({ updatedAt: -1 }).lean()

  const latest = latestFeed || await MetalRate.findOne({}).sort({ updatedAt: -1 }).lean()

  if (!latest) {
    return {
      goldPrice: DEFAULT_METAL_RATES.goldPrice,
      silverPrice: DEFAULT_METAL_RATES.silverPrice,
      platinumPrice: 0,
      priceCurrency: DEFAULT_METAL_RATES.priceCurrency,
      priceUnit: 'G',
      source: 'default',
      updatedAt: null,
    }
  }

  return {
    goldPrice: Number(latest.goldPrice) || 0,
    silverPrice: Number(latest.silverPrice) || 0,
    platinumPrice: Number(latest.platinumPrice) || 0,
    priceCurrency: latest.priceCurrency || 'USD',
    priceUnit: latest.priceUnit || 'G',
    source: latest.source || 'unknown',
    updatedAt: latest.updatedAt || null,
  }
}

module.exports = {
  buildMetalRatesSnapshot,
}
