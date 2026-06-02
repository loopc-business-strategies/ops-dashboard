import type { LiveMetalRatesRow } from '@/src/api/dashboard'

export type MetalSnapshot = {
  gold: number
  silver: number
  platinum: number
  currency: string
  unit: string
  source: string
  updatedAt: string | null
}

export function normalizeMarketUnit(value: string | undefined): string {
  const unit = String(value || 'G').trim().toUpperCase()
  if (unit === 'G' || unit === 'GRAM' || unit === 'GRAMS') return 'G'
  if (unit === 'TOZ' || unit === 'OZ') return 'TOZ'
  if (unit === 'KG') return 'KG'
  return unit || 'G'
}

function pickDisplayPrice(
  rates: LiveMetalRatesRow,
  sourceVal: number | undefined,
  storedVal: number | undefined,
  useSourceToz: boolean,
): number {
  const source = Number(sourceVal || 0)
  return useSourceToz && source > 0 ? source : Number(storedVal || 0)
}

/** Build display snapshot (TOZ source prices when applicable), aligned with web LiveMetalRatesContext. */
export function snapshotFromRates(rates: LiveMetalRatesRow | null | undefined): MetalSnapshot | null {
  if (!rates) return null
  const useSourceToz = normalizeMarketUnit(rates.sourceUnit || rates.priceUnit) === 'TOZ'
  return {
    gold: pickDisplayPrice(rates, rates.sourceGoldPrice, rates.goldPrice, useSourceToz),
    silver: pickDisplayPrice(rates, rates.sourceSilverPrice, rates.silverPrice, useSourceToz),
    platinum: pickDisplayPrice(rates, rates.sourcePlatinumPrice, rates.platinumPrice, useSourceToz),
    currency: String(rates.priceCurrency || 'USD').trim().toUpperCase() || 'USD',
    unit: useSourceToz ? 'TOZ' : String(rates.priceUnit || 'G').trim().toUpperCase() || 'G',
    source: String(rates.source || '').trim(),
    updatedAt: rates.updatedAt != null ? String(rates.updatedAt) : null,
  }
}

export function fmtSpot(n: number): string {
  const x = Number(n || 0)
  if (!Number.isFinite(x) || x <= 0) return '—'
  return x.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

export function fmtMoveRow(delta: number, prevPrice: number): { up: boolean; arrow: string; rest: string } | null {
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

export function formatLiveMetalUnit(unit: string | undefined): string {
  const normalized = normalizeMarketUnit(unit)
  if (normalized === 'TOZ') return 'OZ'
  return normalized
}

export function formatLiveMetalSourceLabel(source: string): string {
  const src = String(source || '').trim().toLowerCase()
  if (!src || src === 'waiting-mt4') return ''
  if (src === 'mt4-bridge') return 'MT4'
  if (src === 'metals.dev' || src === 'external-metals') return 'live'
  if (src === 'mock-realtime') return 'demo'
  if (['inventory', 'local-metal-rate', 'manual', 'default'].includes(src)) return 'saved'
  if (src === 'market') return 'live'
  return 'live'
}

export function metalStatusSubline(
  snapshot: MetalSnapshot,
  price: number,
  errorLabel: string,
): string {
  if (errorLabel) return errorLabel
  const cur = `${snapshot.currency}/${formatLiveMetalUnit(snapshot.unit || 'TOZ')}`
  const feedLabel = formatLiveMetalSourceLabel(snapshot.source)
  if (price > 0 && feedLabel) return `${cur} · ${feedLabel}`
  if (price > 0) return cur
  return 'loading…'
}
