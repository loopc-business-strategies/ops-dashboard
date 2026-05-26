export const LIVE_METAL_POLL_MS = 60_000
export const TOPBAR_MARKET_PARAMS = { currency: 'USD', unit: 'toz' }

export function fmtSpot(n) {
  const x = Number(n || 0)
  if (!Number.isFinite(x) || x <= 0) return '—'
  return x.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

export function fmtMoveRow(delta, prevPrice) {
  const dv = Number(delta)
  const prev = Number(prevPrice)
  if (!Number.isFinite(dv) || !Number.isFinite(prev) || prev <= 0) return null
  const pct = (dv / prev) * 100
  const up = dv >= 0
  const pctSign = pct >= 0 ? '+' : ''
  const dvStr = dv.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
  return {
    up,
    arrow: up ? '▲' : '▼',
    rest: `${dvStr} (${pctSign}${pct.toFixed(2)}%)`,
  }
}

export function normalizeMarketUnit(value) {
  const unit = String(value || 'G').trim().toUpperCase()
  if (unit === 'G' || unit === 'GRAM' || unit === 'GRAMS') return 'G'
  if (unit === 'TOZ' || unit === 'OZ') return 'TOZ'
  if (unit === 'KG') return 'KG'
  return unit || 'G'
}

export function formatLiveMetalUnit(unit) {
  const normalized = normalizeMarketUnit(unit)
  if (normalized === 'TOZ') return 'OZ'
  return normalized
}

export function marketPricesToRates(payload) {
  const metals = payload?.metals
  if (!payload?.success || !metals || typeof metals !== 'object') return null
  if (String(payload.feedStatus || '').toLowerCase() === 'fallback') return null
  return {
    goldPrice: Number(metals.gold) || 0,
    silverPrice: Number(metals.silver) || 0,
    platinumPrice: Number(metals.platinum) || 0,
    priceCurrency: String(payload.currency || 'USD').trim().toUpperCase() || 'USD',
    priceUnit: normalizeMarketUnit(payload.unit),
    source: String(payload.source || payload.feedStatus || 'market-prices').trim(),
    updatedAt: payload.updatedAt || payload.generatedAt || payload.streamAt || null,
  }
}

export function metalErrorLabel(error) {
  const status = Number(error?.status || 0)
  if (status === 401) return 'login required'
  if (status === 403) return 'permission denied'
  if (status === 503) return 'bridge unavailable'
  if (error?.network) return 'backend offline'
  return error?.message || ''
}

export function metalErrorFromException(error) {
  const status = Number(error?.response?.status || 0)
  const serverMessage = String(error?.response?.data?.message || '').trim()
  return {
    status,
    network: !error?.response,
    message: serverMessage || (status ? 'backend error' : 'backend offline'),
  }
}

/** Map stock type / metal labels to live rate keys used by the top bar. */
export function resolveLiveMetalKey(name = '') {
  const text = String(name || '').trim().toLowerCase()
  if (/\b(platinum|xpt|plat)\b/.test(text)) return 'platinum'
  if (/\b(silver|xag|silv)\b/.test(text)) return 'silver'
  if (/\b(gold|xau|au)\b/.test(text)) return 'gold'
  return null
}

export function metalStatusSubline(snapshot, price, error, metalKey = 'gold') {
  const errorLabel = metalErrorLabel(error)
  if (errorLabel) return errorLabel

  const cur = `${snapshot.currency}/${formatLiveMetalUnit(snapshot.unit || 'G')}`
  const src = String(snapshot.source || '').toLowerCase()
  const fromSaved = ['manual', 'inventory', 'default'].includes(src)
  const fromLiveFeed = Boolean(src && !fromSaved && src !== 'waiting-mt4')
  const hasRate = Number(snapshot?.[metalKey] || 0) > 0

  if (price > 0) {
    return fromSaved ? `${cur} · saved` : cur
  }
  if (fromSaved) {
    return `${cur} · not set`
  }
  if (fromLiveFeed && hasRate) {
    return cur
  }
  return 'waiting MT4'
}
