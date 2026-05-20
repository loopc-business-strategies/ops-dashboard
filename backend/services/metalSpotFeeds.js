'use strict'

/**
 * Optional live precious-metal feeds when metals.dev is unavailable or over quota.
 * All successful payloads use USD per troy ounce internally; callers scale to request currency/unit.
 */

const FRED_OBSERVATIONS_URL = 'https://api.stlouisfed.org/fred/series/observations'
const ALPHA_VANTAGE_URL = 'https://www.alphavantage.co/query'

function trimEnv(...keys) {
  for (const k of keys) {
    const v = String(process.env[k] || '').trim()
    if (v) return v
  }
  return ''
}

function parseFredLatestNumeric(observations) {
  if (!Array.isArray(observations)) return null
  for (const row of observations) {
    const raw = row && row.value
    if (raw == null || raw === '.') continue
    const n = Number(String(raw).replace(/,/g, ''))
    if (Number.isFinite(n) && n > 0) return n
  }
  return null
}

async function fetchFredSeriesLatest(seriesId, apiKey) {
  const sid = String(seriesId || '').trim()
  if (!sid) return null
  const u = new URL(FRED_OBSERVATIONS_URL)
  u.searchParams.set('series_id', sid)
  u.searchParams.set('api_key', apiKey)
  u.searchParams.set('file_type', 'json')
  u.searchParams.set('limit', '20')
  u.searchParams.set('sort_order', 'desc')

  const res = await fetch(u.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(12000),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('FRED returned non-JSON')
  }
  if (json && json.error_code != null) {
    throw new Error(String(json.error_message || json.error_code || 'FRED API error'))
  }
  if (!res.ok) {
    throw new Error(`FRED HTTP ${res.status}`)
  }
  return parseFredLatestNumeric(json.observations)
}

/**
 * FRED observations: configure series IDs per metal. Default gold uses London PM fix (USD/toz).
 * @see https://fred.stlouisfed.org/
 */
async function fetchFredPreciousMetalSpotBundle() {
  const apiKey = trimEnv('FRED_API_KEY')
  if (!apiKey) throw new Error('FRED_API_KEY is not set')

  const series = {
    gold: trimEnv('FRED_METALS_SERIES_GOLD') || 'GOLDPMGBD228NLBM',
    silver: trimEnv('FRED_METALS_SERIES_SILVER'),
    platinum: trimEnv('FRED_METALS_SERIES_PLATINUM'),
    palladium: trimEnv('FRED_METALS_SERIES_PALLADIUM'),
  }

  const metalKeys = ['gold', 'silver', 'platinum', 'palladium']
  const entries = await Promise.all(
    metalKeys.map(async (metal) => {
      const sid = series[metal]
      if (!sid) return [metal, 0]
      try {
        const n = await fetchFredSeriesLatest(sid, apiKey)
        return [metal, n && Number.isFinite(n) && n > 0 ? n : 0]
      } catch {
        return [metal, 0]
      }
    })
  )

  const metals = Object.fromEntries(entries)
  if (!Object.values(metals).some((n) => n > 0)) {
    throw new Error(
      'FRED returned no usable prices (check FRED_METALS_SERIES_* series IDs and API key).'
    )
  }

  return {
    source: 'fred.stlouisfed.org',
    currency: 'USD',
    unit: 'toz',
    updatedAt: new Date(),
    metals,
  }
}

async function fetchAlphaJson(searchParams) {
  const u = new URL(ALPHA_VANTAGE_URL)
  Object.entries(searchParams).forEach(([k, v]) => {
    if (v != null && v !== '') u.searchParams.set(k, String(v))
  })
  const res = await fetch(u.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    throw new Error('Alpha Vantage returned non-JSON')
  }
  return json
}

function extractAlphaNumericPrice(obj, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 8) return null
  if (obj.Information || obj.Note || obj['Error Message']) return null

  const keyTests = [
    (k) => /exchange rate/i.test(k),
    (k) => /^(\d+\.\s*)?price$/i.test(k) || k === 'price' || k === 'Price',
    (k) => /spot/i.test(k) && !/symbol/i.test(k),
  ]

  for (const test of keyTests) {
    for (const [k, v] of Object.entries(obj)) {
      if (!test(k)) continue
      const n = Number(String(v).replace(/,/g, ''))
      if (Number.isFinite(n) && n > 0) return n
    }
  }

  for (const v of Object.values(obj)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const found = extractAlphaNumericPrice(v, depth + 1)
      if (found != null) return found
    }
  }
  return null
}

function assertAlphaNoGlobalError(json) {
  const soft = json && (json.Information || json.Note || json['Error Message'])
  if (soft) {
    throw new Error(String(soft).replace(/\s+/g, ' ').trim().slice(0, 220))
  }
}

async function fetchAlphaGoldSilverSpot(apiKey, symbolCandidates) {
  for (const symbol of symbolCandidates) {
    const json = await fetchAlphaJson({
      function: 'GOLD_SILVER_SPOT',
      symbol,
      apikey: apiKey,
    })
    assertAlphaNoGlobalError(json)
    const p = extractAlphaNumericPrice(json)
    if (p != null && p > 0) return p
  }
  return 0
}

async function fetchAlphaCurrencyRate(apiKey, fromCurrency, toCurrency = 'USD') {
  const json = await fetchAlphaJson({
    function: 'CURRENCY_EXCHANGE_RATE',
    from_currency: String(fromCurrency || '').toUpperCase(),
    to_currency: String(toCurrency || 'USD').toUpperCase(),
    apikey: apiKey,
  })
  assertAlphaNoGlobalError(json)
  const p = extractAlphaNumericPrice(json)
  return p != null && p > 0 ? p : 0
}

/**
 * Uses commodity GOLD_SILVER_SPOT (gold/silver) and physical FX pairs XPT/USD, XPD/USD when available.
 * Free tier is heavily rate-limited — keep METALS_SPOT_CACHE_MS high when this is the active feed.
 */
async function fetchAlphaVantagePreciousMetalSpotBundle({ apiKey: explicitKey } = {}) {
  const apiKey = String(explicitKey || '').trim() || trimEnv('METALS_ALPHA_VANTAGE_API_KEY', 'ALPHA_VANTAGE_API_KEY')
  if (!apiKey) throw new Error('Alpha Vantage API key not set (METALS_ALPHA_VANTAGE_API_KEY or ALPHA_VANTAGE_API_KEY)')

  const [gold, silver, platinum, palladium] = await Promise.all([
    fetchAlphaGoldSilverSpot(apiKey, ['GOLD', 'XAU']),
    fetchAlphaGoldSilverSpot(apiKey, ['SILVER', 'XAG']),
    fetchAlphaCurrencyRate(apiKey, 'XPT'),
    fetchAlphaCurrencyRate(apiKey, 'XPD'),
  ])

  const metals = { gold, silver, platinum, palladium }
  if (!Object.values(metals).some((n) => n > 0)) {
    throw new Error('Alpha Vantage returned no usable precious-metal prices')
  }

  return {
    source: 'alphavantage.co',
    currency: 'USD',
    unit: 'toz',
    updatedAt: new Date(),
    metals,
  }
}

module.exports = {
  fetchFredPreciousMetalSpotBundle,
  fetchAlphaVantagePreciousMetalSpotBundle,
}
