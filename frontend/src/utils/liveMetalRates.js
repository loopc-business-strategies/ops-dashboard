export const MT4_LIVE_POLL_MS = 1_000
/** Poll interval when market SSE stream is connected (fallback only). */
export const LIVE_METAL_POLL_STREAM_MS = 60_000
/** Pause polling after a 429 response. */
export const LIVE_METAL_RATE_LIMIT_BACKOFF_MS = 90_000
export const MT4_BRIDGE_SOURCE = 'mt4-bridge'
export const TOPBAR_MARKET_PARAMS = { currency: 'USD', unit: 'toz' }

export function isMt4BridgeRates(rates = {}) {
  return String(rates?.source || '').trim().toLowerCase() === MT4_BRIDGE_SOURCE
}

/** Keep MT4 on fast poll; only slow poll when market SSE is the active non-MT4 feed. */
export function resolveLiveMetalPollIntervalMs(isMarketStreamConnected, source = '') {
  if (isMt4BridgeRates({ source })) return MT4_LIVE_POLL_MS
  if (isMarketStreamConnected && source && !isMt4BridgeRates({ source })) {
    return LIVE_METAL_POLL_STREAM_MS
  }
  return MT4_LIVE_POLL_MS
}

let liveMetalRatesHeld = false
let liveMetalRatesHoldGeneration = 0
let liveMetalRatesReleaseTimer = 0
const liveMetalRatesReleaseListeners = new Set()

/** True while the ERP dashboard report should have the connection before the first price fetch. */
export function isLiveMetalRatesHeld() {
  return liveMetalRatesHeld
}

export function subscribeLiveMetalRatesReleased(listener) {
  liveMetalRatesReleaseListeners.add(listener)
  return () => liveMetalRatesReleaseListeners.delete(listener)
}

/** Pause live price fetches until the expense list arrives, or for 8 seconds. */
export function holdLiveMetalRatesForDashboardReport() {
  liveMetalRatesHoldGeneration += 1
  const generation = liveMetalRatesHoldGeneration
  liveMetalRatesHeld = true
  clearTimeout(liveMetalRatesReleaseTimer)
  liveMetalRatesReleaseTimer = setTimeout(() => {
    releaseLiveMetalRates(generation)
  }, 8000)
  return generation
}

/** Keep the hold after the dashboard report, until the expense list settles. */
export function keepLiveMetalRatesHeld(generation) {
  if (generation != null && generation !== liveMetalRatesHoldGeneration) return
  if (!liveMetalRatesHeld) return
  clearTimeout(liveMetalRatesReleaseTimer)
  liveMetalRatesReleaseTimer = 0
}

export function releaseLiveMetalRates(generation) {
  if (generation != null && generation !== liveMetalRatesHoldGeneration) return
  if (!liveMetalRatesHeld) return
  liveMetalRatesHeld = false
  clearTimeout(liveMetalRatesReleaseTimer)
  liveMetalRatesReleaseTimer = 0
  liveMetalRatesReleaseListeners.forEach((listener) => listener())
}

let liveMetalFetchStarted = false
let liveMetalFetchFinished = false
const liveMetalFetchStartListeners = new Set()
const liveMetalFetchFinishListeners = new Set()

/** True once the first live price request has been issued. */
export function hasLiveMetalFetchStarted() {
  return liveMetalFetchStarted
}

/** True once that first live price request has settled. */
export function hasLiveMetalFetchFinished() {
  return liveMetalFetchFinished
}

export function markLiveMetalFetchStarted() {
  if (liveMetalFetchStarted) return
  liveMetalFetchStarted = true
  liveMetalFetchStartListeners.forEach((listener) => listener())
}

export function markLiveMetalFetchFinished() {
  if (liveMetalFetchFinished) return
  liveMetalFetchFinished = true
  liveMetalFetchFinishListeners.forEach((listener) => listener())
}

export function subscribeLiveMetalFetchStarted(listener) {
  liveMetalFetchStartListeners.add(listener)
  return () => liveMetalFetchStartListeners.delete(listener)
}

export function subscribeLiveMetalFetchFinished(listener) {
  liveMetalFetchFinishListeners.add(listener)
  return () => liveMetalFetchFinishListeners.delete(listener)
}

export function resetLiveMetalFetchStarted() {
  liveMetalFetchStarted = false
  liveMetalFetchFinished = false
}

/**
 * Run `onSettled` once the first live price response is back.
 * If that request never starts, run after 1 second. If it never returns, run after 8 seconds.
 */
export function whenLiveMetalFetchSettled(onSettled) {
  let settled = false
  let timer = 0
  let unsubStarted = () => {}
  let unsubFinished = () => {}
  let unsubReleased = () => {}
  const finish = () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    unsubStarted()
    unsubFinished()
    unsubReleased()
    onSettled()
  }
  const waitForFinish = () => {
    clearTimeout(timer)
    unsubFinished()
    if (hasLiveMetalFetchFinished()) {
      timer = setTimeout(finish, 0)
      return
    }
    timer = setTimeout(finish, 8000)
    unsubFinished = subscribeLiveMetalFetchFinished(() => {
      clearTimeout(timer)
      timer = setTimeout(finish, 0)
    })
  }
  const waitForStart = (capMs) => {
    clearTimeout(timer)
    unsubStarted()
    if (hasLiveMetalFetchFinished()) {
      timer = setTimeout(finish, 0)
      return
    }
    if (hasLiveMetalFetchStarted()) {
      waitForFinish()
      return
    }
    timer = setTimeout(finish, capMs)
    unsubStarted = subscribeLiveMetalFetchStarted(() => {
      clearTimeout(timer)
      waitForFinish()
    })
  }
  if (hasLiveMetalFetchFinished()) {
    timer = setTimeout(finish, 0)
  } else if (hasLiveMetalFetchStarted()) {
    waitForFinish()
  } else if (isLiveMetalRatesHeld()) {
    waitForStart(8000)
    unsubReleased = subscribeLiveMetalRatesReleased(() => {
      waitForStart(1000)
    })
  } else {
    waitForStart(1000)
  }
  return () => {
    settled = true
    clearTimeout(timer)
    unsubStarted()
    unsubFinished()
    unsubReleased()
  }
}

const DASHBOARD_CONNECTION_KINDS = ['stream', 'socket', 'bell', 'live']
const dashboardConnectionsIssued = new Set()
const dashboardConnectionListeners = new Set()

export function markDashboardConnectionIssued(kind) {
  if (!DASHBOARD_CONNECTION_KINDS.includes(kind) || dashboardConnectionsIssued.has(kind)) return
  dashboardConnectionsIssued.add(kind)
  dashboardConnectionListeners.forEach((listener) => listener())
}

export function subscribeDashboardConnectionsIssued(listener) {
  dashboardConnectionListeners.add(listener)
  return () => dashboardConnectionListeners.delete(listener)
}

export function resetDashboardConnectionsIssued() {
  dashboardConnectionsIssued.clear()
  dashboardConnectionsOpened.clear()
  dashboardConnectionFailed = false
}

const dashboardConnectionsOpened = new Set()
const dashboardConnectionOpenListeners = new Set()

/** True once the market stream, metal socket, bell, and live updates have all finished opening. */
export function hasDashboardConnectionsOpened() {
  return dashboardConnectionsOpened.size === DASHBOARD_CONNECTION_KINDS.length
}

export function markDashboardConnectionOpened(kind) {
  if (!DASHBOARD_CONNECTION_KINDS.includes(kind) || dashboardConnectionsOpened.has(kind)) return
  dashboardConnectionsOpened.add(kind)
  dashboardConnectionOpenListeners.forEach((listener) => listener())
}

export function subscribeDashboardConnectionsOpened(listener) {
  dashboardConnectionOpenListeners.add(listener)
  return () => dashboardConnectionOpenListeners.delete(listener)
}

let dashboardConnectionFailed = false
const dashboardConnectionFailListeners = new Set()

/** True once any of those four connections has failed to open. */
export function hasDashboardConnectionFailed() {
  return dashboardConnectionFailed
}

export function markDashboardConnectionFailed(kind) {
  if (!DASHBOARD_CONNECTION_KINDS.includes(kind) || dashboardConnectionsOpened.has(kind)) return
  if (dashboardConnectionFailed) return
  dashboardConnectionFailed = true
  dashboardConnectionFailListeners.forEach((listener) => listener())
}

export function subscribeDashboardConnectionFailed(listener) {
  dashboardConnectionFailListeners.add(listener)
  return () => dashboardConnectionFailListeners.delete(listener)
}

/**
 * Run `onOpened` once those four connections have finished opening.
 * A failed open ends the wait. If none are started, run after 1 second.
 * If one never finishes opening and none fail, run after 8 seconds.
 */
export function whenDashboardConnectionsOpened(onOpened) {
  let settled = false
  let timer = 0
  let unsubIssued = () => {}
  let unsubOpened = () => {}
  let unsubFailed = () => {}
  const finish = () => {
    if (settled) return
    settled = true
    clearTimeout(timer)
    unsubIssued()
    unsubOpened()
    unsubFailed()
    onOpened()
  }
  const waitForOpened = () => {
    clearTimeout(timer)
    unsubOpened()
    unsubFailed()
    if (hasDashboardConnectionsOpened() || hasDashboardConnectionFailed()) {
      timer = setTimeout(finish, 0)
      return
    }
    timer = setTimeout(finish, 8000)
    unsubOpened = subscribeDashboardConnectionsOpened(() => {
      if (!hasDashboardConnectionsOpened()) return
      clearTimeout(timer)
      timer = setTimeout(finish, 0)
    })
    unsubFailed = subscribeDashboardConnectionFailed(() => {
      clearTimeout(timer)
      timer = setTimeout(finish, 0)
    })
  }
  if (hasDashboardConnectionsOpened() || hasDashboardConnectionFailed()) {
    timer = setTimeout(finish, 0)
  } else if (dashboardConnectionsIssued.size > 0) {
    waitForOpened()
  } else {
    timer = setTimeout(finish, 1000)
    unsubIssued = subscribeDashboardConnectionsIssued(() => {
      clearTimeout(timer)
      waitForOpened()
    })
    unsubFailed = subscribeDashboardConnectionFailed(() => {
      clearTimeout(timer)
      timer = setTimeout(finish, 0)
    })
  }
  return () => {
    settled = true
    clearTimeout(timer)
    unsubIssued()
    unsubOpened()
    unsubFailed()
  }
}

export const GRAMS_PER_TOZ = 31.1034768
export const GRAMS_PER_KG = 1000

export function normalizeInventoryPriceUnit(value) {
  const unit = String(value || 'OZ').trim().toUpperCase()
  if (unit === 'GRAM' || unit === 'G' || unit === 'GRAMS') return 'G'
  if (unit === 'KG' || unit === 'KILO') return 'KG'
  if (unit === 'OZ' || unit === 'TOZ') return 'TOZ'
  return 'TOZ'
}

export function convertLivePriceUnit(price, fromUnit, toUnit) {
  const amount = Number(price || 0)
  if (!Number.isFinite(amount) || amount <= 0) return 0
  const from = normalizeInventoryPriceUnit(fromUnit)
  const to = normalizeInventoryPriceUnit(toUnit)
  if (from === to) return amount

  let perGram = amount
  if (from === 'TOZ') perGram = amount / GRAMS_PER_TOZ
  else if (from === 'KG') perGram = amount / GRAMS_PER_KG

  if (to === 'G') return perGram
  if (to === 'TOZ') return perGram * GRAMS_PER_TOZ
  if (to === 'KG') return perGram * GRAMS_PER_KG
  return amount
}

export function pickLiveSpotPrice(snapshot, metalKey) {
  if (!snapshot || !metalKey) return 0
  return Number(snapshot[metalKey] || 0)
}

export function resolveLiveInventoryUnitCost(metalName, snapshot, targetUnit = 'OZ') {
  const metalKey = resolveLiveMetalKey(metalName)
  if (!metalKey || !snapshot) return null
  const spot = pickLiveSpotPrice(snapshot, metalKey)
  if (spot <= 0) return null
  const liveUnit = snapshot.unit || 'TOZ'
  return convertLivePriceUnit(spot, liveUnit, targetUnit)
}

export function resolveInventoryValuationUnitCost(storedUnitCost, metalName, snapshot, priceUnit = 'OZ') {
  const targetUnit = normalizeInventoryPriceUnit(priceUnit)
  const liveCost = resolveLiveInventoryUnitCost(metalName, snapshot, targetUnit)
  if (liveCost != null && liveCost > 0) return liveCost
  const stored = Number(storedUnitCost || 0)
  if (!(stored > 0)) return 0
  // Metal inventory qty is grams; legacy book/live costs are usually OZ — convert when valuing in G.
  if (targetUnit === 'G') return convertLivePriceUnit(stored, 'OZ', 'G')
  return stored
}

export function liveRatesToMetalRatesState(snapshot) {
  if (!snapshot) return null
  const gold = Number(snapshot.gold || 0)
  const silver = Number(snapshot.silver || 0)
  if (gold <= 0 && silver <= 0) return null
  const unit = normalizeMarketUnit(snapshot.unit)
  const toGram = (price) => (unit === 'TOZ' ? convertLivePriceUnit(price, 'TOZ', 'G') : price)
  return {
    goldPrice: toGram(gold),
    silverPrice: toGram(silver),
    platinumPrice: toGram(Number(snapshot.platinum || 0)),
    priceCurrency: snapshot.currency || 'USD',
    priceUnit: 'G',
    sourceGoldPrice: gold,
    sourceSilverPrice: silver,
    sourcePlatinumPrice: Number(snapshot.platinum || 0),
    sourceUnit: unit,
    source: snapshot.source || '',
    updatedAt: snapshot.updatedAt || null,
  }
}

export function resolveEffectiveSpotPrices({
  liveSnapshot,
  enquiryGold = 0,
  enquirySilver = 0,
  fallbackGold = 0,
  fallbackSilver = 0,
} = {}) {
  const liveUnit = normalizeMarketUnit(liveSnapshot?.unit)
  const liveGramGold = Number(liveSnapshot?.gold || 0) > 0
    ? (liveUnit === 'TOZ' ? convertLivePriceUnit(liveSnapshot.gold, 'TOZ', 'G') : Number(liveSnapshot.gold))
    : 0
  const liveGramSilver = Number(liveSnapshot?.silver || 0) > 0
    ? (liveUnit === 'TOZ' ? convertLivePriceUnit(liveSnapshot.silver, 'TOZ', 'G') : Number(liveSnapshot.silver))
    : 0
  return {
    goldPriceUSD: liveGramGold > 0 ? liveGramGold : (Number(enquiryGold || 0) || Number(fallbackGold || 0)),
    silverPriceUSD: liveGramSilver > 0 ? liveGramSilver : (Number(enquirySilver || 0) || Number(fallbackSilver || 0)),
  }
}

export function buildMetalRatesFromApiPayload(rates = {}) {
  const useSourceToz = normalizeMarketUnit(rates.sourceUnit || rates.priceUnit) === 'TOZ'
  const pickPrice = (sourceValue, storedValue) => {
    const source = Number(sourceValue) || 0
    return useSourceToz && source > 0 ? source : Number(storedValue) || 0
  }
  return {
    goldPrice: pickPrice(rates.sourceGoldPrice, rates.goldPrice),
    silverPrice: pickPrice(rates.sourceSilverPrice, rates.silverPrice),
    platinumPrice: pickPrice(rates.sourcePlatinumPrice, rates.platinumPrice),
    priceCurrency: String(rates.priceCurrency || 'USD').trim().toUpperCase() || 'USD',
    priceUnit: useSourceToz ? 'TOZ' : String(rates.priceUnit || 'G').trim().toUpperCase() || 'G',
    sourceGoldPrice: Number(rates.sourceGoldPrice || 0) || Number(rates.goldPrice || 0),
    sourceSilverPrice: Number(rates.sourceSilverPrice || 0) || Number(rates.silverPrice || 0),
    sourcePlatinumPrice: Number(rates.sourcePlatinumPrice || 0) || Number(rates.platinumPrice || 0),
    sourceUnit: normalizeMarketUnit(rates.sourceUnit || rates.priceUnit),
    source: String(rates.source || '').trim(),
    updatedAt: rates.updatedAt || null,
  }
}

export function resolveLiveVoucherMetalRate(metalSymbol, metalName, liveRates, rateType = 'OZ') {
  const metalKey = resolveLiveMetalKey(metalSymbol || metalName)
  if (!metalKey || !liveRates) return 0
  const spot = metalKey === 'gold'
    ? Number(liveRates.sourceGoldPrice || liveRates.goldPrice || 0)
    : metalKey === 'silver'
      ? Number(liveRates.sourceSilverPrice || liveRates.silverPrice || 0)
      : Number(liveRates.sourcePlatinumPrice || liveRates.platinumPrice || 0)
  if (spot <= 0) return 0
  const liveUnit = normalizeMarketUnit(liveRates.sourceUnit || liveRates.priceUnit || 'TOZ')
  return convertLivePriceUnit(spot, liveUnit, rateType)
}

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
  if (status === 429) return 'rate limited'
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

export function formatLiveMetalSourceLabel(source = '') {
  const src = String(source || '').trim().toLowerCase()
  if (!src || src === 'waiting-mt4') return ''
  if (src === MT4_BRIDGE_SOURCE) return 'MT4'
  if (src === 'metals.dev' || src === 'external-metals') return 'live'
  if (src === 'mock-realtime') return 'demo'
  if (['inventory', 'local-metal-rate', 'manual', 'default'].includes(src)) return 'saved'
  return 'live'
}

/** Ticker note when prices are not coming from MT4 (the server falls back once MT4 is stale). */
export function liveMetalFallbackNote(source = '') {
  const src = String(source || '').trim().toLowerCase()
  if (!src || src === MT4_BRIDGE_SOURCE || src === 'waiting-mt4' || src === 'mock-realtime') return ''
  return formatLiveMetalSourceLabel(src) === 'saved' ? 'Saved price · MT4 offline' : 'Market price · MT4 offline'
}

export function metalStatusSubline(snapshot, price, error, _metalKey = 'gold') {
  const errorLabel = metalErrorLabel(error)
  if (errorLabel) return errorLabel

  const cur = `${snapshot.currency}/${formatLiveMetalUnit(snapshot.unit || 'TOZ')}`
  const feedLabel = formatLiveMetalSourceLabel(snapshot.source)

  if (price > 0 && feedLabel) {
    return `${cur} · ${feedLabel}`
  }
  if (price > 0) {
    return cur
  }
  return 'loading…'
}
