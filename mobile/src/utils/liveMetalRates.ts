export const MT4_LIVE_POLL_MS = 1_000
export const LIVE_METAL_POLL_MS = MT4_LIVE_POLL_MS
export const LIVE_METAL_POLL_STREAM_MS = 60_000
export const LIVE_METAL_RATE_LIMIT_BACKOFF_MS = 90_000
export const MT4_BRIDGE_SOURCE = 'mt4-bridge'

export function resolveLiveMetalPollIntervalMs(isMarketStreamConnected: boolean, source = '') {
  if (isMt4BridgeRates({ source })) return MT4_LIVE_POLL_MS
  if (isMarketStreamConnected && source && !isMt4BridgeRates({ source })) {
    return LIVE_METAL_POLL_STREAM_MS
  }
  return MT4_LIVE_POLL_MS
}

export const GRAMS_PER_TOZ = 31.1034768
export const GRAMS_PER_KG = 1000

export type MetalRatesError = {
  status?: number
  network?: boolean
  message?: string
}

export type LiveMetalSnapshot = {
  gold: number
  silver: number
  platinum: number
  currency: string
  unit: string
  source: string
  updatedAt: string | null
  deltas: { gold: number; silver: number; platinum: number } | null
  prevSnapshot: { gold: number; silver: number; platinum: number } | null
}

export function isMt4BridgeRates(rates: { source?: string } = {}) {
  return String(rates?.source || '').trim().toLowerCase() === MT4_BRIDGE_SOURCE
}

export function normalizeMarketUnit(value?: string) {
  const unit = String(value || 'G').trim().toUpperCase()
  if (unit === 'G' || unit === 'GRAM' || unit === 'GRAMS') return 'G'
  if (unit === 'TOZ' || unit === 'OZ') return 'TOZ'
  if (unit === 'KG') return 'KG'
  return unit || 'G'
}

export function normalizeInventoryPriceUnit(value?: string) {
  const unit = String(value || 'OZ').trim().toUpperCase()
  if (unit === 'GRAM' || unit === 'G' || unit === 'GRAMS') return 'G'
  if (unit === 'KG' || unit === 'KILO') return 'KG'
  if (unit === 'OZ' || unit === 'TOZ') return 'TOZ'
  return 'TOZ'
}

export function convertLivePriceUnit(price: number | string, fromUnit: string, toUnit: string) {
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

export function fmtSpot(n: number | string) {
  const x = Number(n || 0)
  if (!Number.isFinite(x) || x <= 0) return '—'
  return x.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

export function fmtMoveRow(delta: number, prevPrice: number) {
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

export function resolveEffectiveSpotPrices({
  liveSnapshot,
  enquiryGold = 0,
  enquirySilver = 0,
  fallbackGold = 0,
  fallbackSilver = 0,
}: {
  liveSnapshot?: Pick<LiveMetalSnapshot, 'gold' | 'silver' | 'unit'> | null
  enquiryGold?: number
  enquirySilver?: number
  fallbackGold?: number
  fallbackSilver?: number
} = {}) {
  const liveUnit = normalizeMarketUnit(liveSnapshot?.unit)
  const liveGramGold =
    Number(liveSnapshot?.gold || 0) > 0
      ? liveUnit === 'TOZ'
        ? convertLivePriceUnit(liveSnapshot!.gold, 'TOZ', 'G')
        : Number(liveSnapshot!.gold)
      : 0
  const liveGramSilver =
    Number(liveSnapshot?.silver || 0) > 0
      ? liveUnit === 'TOZ'
        ? convertLivePriceUnit(liveSnapshot!.silver, 'TOZ', 'G')
        : Number(liveSnapshot!.silver)
      : 0
  return {
    goldPriceUSD: liveGramGold > 0 ? liveGramGold : Number(enquiryGold || 0) || Number(fallbackGold || 0),
    silverPriceUSD:
      liveGramSilver > 0 ? liveGramSilver : Number(enquirySilver || 0) || Number(fallbackSilver || 0),
  }
}

export function buildMetalRatesFromApiPayload(rates: Record<string, unknown> = {}) {
  const useSourceToz = normalizeMarketUnit(String(rates.sourceUnit || rates.priceUnit || '')) === 'TOZ'
  const pickPrice = (sourceValue: unknown, storedValue: unknown) => {
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
    sourceUnit: normalizeMarketUnit(String(rates.sourceUnit || rates.priceUnit || '')),
    source: String(rates.source || '').trim(),
    updatedAt: (rates.updatedAt as string | null) || null,
  }
}

export function formatLiveMetalUnit(unit?: string) {
  const normalized = normalizeMarketUnit(unit)
  if (normalized === 'TOZ') return 'OZ'
  return normalized
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

export function metalErrorLabel(error: MetalRatesError | null | undefined) {
  const status = Number(error?.status || 0)
  if (status === 401) return 'login required'
  if (status === 403) return 'permission denied'
  if (status === 429) return 'rate limited'
  if (status === 503) return 'bridge unavailable'
  if (error?.network) return 'backend offline'
  return error?.message || ''
}

export function metalErrorFromException(error: unknown): MetalRatesError {
  if (error && typeof error === 'object' && 'status' in error) {
    const err = error as { status?: number; network?: boolean; message?: string }
    return {
      status: Number(err.status || 0),
      network: Boolean(err.network),
      message: String(err.message || '').trim() || (err.status ? 'backend error' : 'backend offline'),
    }
  }
  return { status: 0, network: true, message: 'backend offline' }
}

export function metalStatusSubline(
  snapshot: Pick<LiveMetalSnapshot, 'currency' | 'unit' | 'source'>,
  price: number,
  error: MetalRatesError | null | undefined,
) {
  const errorLabel = metalErrorLabel(error)
  if (errorLabel) return errorLabel

  const cur = `${snapshot.currency}/${formatLiveMetalUnit(snapshot.unit || 'TOZ')}`
  const feedLabel = formatLiveMetalSourceLabel(snapshot.source)

  if (price > 0 && feedLabel) return `${cur} · ${feedLabel}`
  if (price > 0) return cur
  return 'loading…'
}
