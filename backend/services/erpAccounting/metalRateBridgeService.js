const TROY_OUNCE_GRAMS = 31.1034768

const { getTenantKeys, normalizeTenantKey } = require('../../config/tenantRegistry')

const METAL_KEYS = ['gold', 'silver', 'platinum']

function toPositiveNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function normalizeUnit(value) {
  const unit = String(value || 'G').trim().toUpperCase()
  if (['G', 'GRAM', 'GRAMS'].includes(unit)) return 'G'
  if (['TOZ', 'OZ', 'TROY_OUNCE', 'TROY_OUNCES'].includes(unit)) return 'TOZ'
  return 'G'
}

function normalizeCurrency(value, fallback = 'USD') {
  return String(value || fallback || 'USD').trim().toUpperCase() || 'USD'
}

function midFromQuote(value) {
  if (typeof value === 'number' || typeof value === 'string') return toPositiveNumber(value)
  if (!value || typeof value !== 'object') return 0

  const direct = toPositiveNumber(value.mid || value.price || value.last)
  if (direct > 0) return direct

  const bid = toPositiveNumber(value.bid)
  const ask = toPositiveNumber(value.ask)
  if (bid > 0 && ask > 0) return (bid + ask) / 2
  return bid || ask || 0
}

function normalizeBridgeMetalRates(body = {}, defaults = {}) {
  const unit = normalizeUnit(body.unit || body.priceUnit || body.sourceUnit)
  const currency = normalizeCurrency(body.currency || body.priceCurrency, defaults.priceCurrency)
  const divisor = unit === 'TOZ' ? TROY_OUNCE_GRAMS : 1
  const rawMetals = body.metals && typeof body.metals === 'object' ? body.metals : body

  const normalized = {}
  const received = {}
  METAL_KEYS.forEach((metal) => {
    const directKey = `${metal}Price`
    const rawPrice = midFromQuote(rawMetals[metal] ?? rawMetals[metal.toUpperCase()] ?? body[directKey])
    received[metal] = rawPrice
    normalized[`${metal}Price`] = rawPrice > 0 ? rawPrice / divisor : toPositiveNumber(defaults[`${metal}Price`])
  })

  if (received.gold <= 0 || received.silver <= 0 || received.platinum <= 0) {
    throw new Error('Gold, silver, and platinum prices are required')
  }

  return {
    ...normalized,
    priceCurrency: currency,
    priceUnit: 'G',
    sourceUnit: unit,
    sourcePrices: received,
    source: String(body.source || 'mt4-bridge').trim() || 'mt4-bridge',
  }
}

function buildMetalRatesResponse(rate) {
  const sourcePrices = rate?.sourcePayload?.sourcePrices && typeof rate.sourcePayload.sourcePrices === 'object'
    ? rate.sourcePayload.sourcePrices
    : null
  const sourceUnit = normalizeUnit(rate?.sourcePayload?.sourceUnit || rate?.sourceUnit || rate?.priceUnit)
  return {
    goldPrice: toPositiveNumber(rate?.goldPrice),
    silverPrice: toPositiveNumber(rate?.silverPrice),
    platinumPrice: toPositiveNumber(rate?.platinumPrice),
    priceCurrency: normalizeCurrency(rate?.priceCurrency),
    priceUnit: normalizeUnit(rate?.priceUnit),
    sourceGoldPrice: toPositiveNumber(sourcePrices?.gold),
    sourceSilverPrice: toPositiveNumber(sourcePrices?.silver),
    sourcePlatinumPrice: toPositiveNumber(sourcePrices?.platinum),
    sourceUnit,
    source: String(rate?.source || 'manual'),
    updatedAt: rate?.updatedAt || null,
  }
}

function getBridgeTokenFromRequest(req) {
  const explicit = String(req.headers['x-metal-rates-bridge-token'] || '').trim()
  if (explicit) return explicit

  const auth = String(req.headers.authorization || '').trim()
  return auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
}

/**
 * Resolve which tenant DBs receive a single MT4 bridge POST.
 * METAL_RATES_BRIDGE_FANOUT_TENANTS: unset|all → all catalog tenants;
 * comma list → those keys (source tenant always included); single key → one tenant only.
 */
function resolveBridgeFanoutTenants(sourceTenant, env = process.env) {
  const source = normalizeTenantKey(sourceTenant)
  if (!source) return []

  const catalogKeys = getTenantKeys()
  const raw = String(env.METAL_RATES_BRIDGE_FANOUT_TENANTS ?? 'all').trim().toLowerCase()

  let targets
  if (!raw || raw === 'all') {
    targets = [...catalogKeys]
  } else if (!raw.includes(',')) {
    const single = normalizeTenantKey(raw)
    targets = single ? [single] : [source]
  } else {
    targets = [...new Set(
      raw.split(',')
        .map((part) => normalizeTenantKey(part))
        .filter(Boolean),
    )]
    if (!targets.includes(source)) targets.push(source)
  }

  return targets.sort()
}

async function upsertBridgeRatesForTenant({ MetalRateModel, normalized, symbols }) {
  const latest = await MetalRateModel.findOne({}).sort({ updatedAt: -1 })
  const oldGold = Number(latest?.goldPrice || 0)
  const rate = await MetalRateModel.findOneAndUpdate(
    { source: normalized.source },
    {
      $set: {
        goldPrice: normalized.goldPrice,
        silverPrice: normalized.silverPrice,
        platinumPrice: normalized.platinumPrice,
        priceCurrency: normalized.priceCurrency,
        priceUnit: normalized.priceUnit,
        source: normalized.source,
        sourcePayload: {
          sourceUnit: normalized.sourceUnit,
          sourcePrices: normalized.sourcePrices,
          symbols: symbols || undefined,
          receivedAt: new Date(),
        },
      },
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
  )

  return {
    rate,
    rates: buildMetalRatesResponse(rate),
    oldGold,
  }
}

module.exports = {
  TROY_OUNCE_GRAMS,
  normalizeBridgeMetalRates,
  buildMetalRatesResponse,
  getBridgeTokenFromRequest,
  resolveBridgeFanoutTenants,
  upsertBridgeRatesForTenant,
}
