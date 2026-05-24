import { useCallback, useEffect, useRef, useState } from 'react'
import { currenciesApi } from '../api/erp-accounting/currencies'
import { reportsApi } from '../api/erp-accounting/reports'
import { startMetalRatesRealtime } from '../utils/realtimeSocket'

const POLL_MS = 60_000
const TOPBAR_MARKET_PARAMS = { currency: 'USD', unit: 'g' }

function fmtSpot(n) {
  const x = Number(n || 0)
  if (!Number.isFinite(x) || x <= 0) return '—'
  return x.toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: 2 })
}

function fmtMoveRow(delta, prevPrice) {
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

const METALS = [
  { key: 'gold', label: 'Gold', swatch: '#FACC15', sym: 'Au', labelColor: '#FDE047' },
  { key: 'silver', label: 'Silver', swatch: '#CBD5E1', sym: 'Ag', labelColor: 'rgba(248, 250, 252, 0.88)' },
  { key: 'platinum', label: 'Platinum', swatch: '#A855F7', sym: 'Pt', labelColor: '#FDE68A' },
]

function metalErrorLabel(error) {
  const status = Number(error?.status || 0)
  if (status === 401) return 'login required'
  if (status === 403) return 'permission denied'
  if (status === 503) return 'bridge unavailable'
  if (error?.network) return 'backend offline'
  return error?.message || ''
}

function metalErrorFromException(error) {
  const status = Number(error?.response?.status || 0)
  const serverMessage = String(error?.response?.data?.message || '').trim()
  return {
    status,
    network: !error?.response,
    message: serverMessage || (status ? 'backend error' : 'backend offline'),
  }
}

function normalizeMarketUnit(value) {
  const unit = String(value || 'G').trim().toUpperCase()
  if (unit === 'G' || unit === 'GRAM' || unit === 'GRAMS') return 'G'
  if (unit === 'TOZ' || unit === 'OZ') return 'TOZ'
  if (unit === 'KG') return 'KG'
  return unit || 'G'
}

function marketPricesToRates(payload) {
  const metals = payload?.metals
  if (!payload?.success || !metals || typeof metals !== 'object') return null
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

/** Second line under price when there is no move row yet. */
function metalStatusSubline(snapshot, price, error) {
  const errorLabel = metalErrorLabel(error)
  if (errorLabel) return errorLabel

  const cur = `${snapshot.currency}/${snapshot.unit || 'G'}`
  const src = String(snapshot.source || '').toLowerCase()
  const fromSaved = ['manual', 'inventory', 'default'].includes(src)
  const fromLiveFeed = Boolean(src && !fromSaved && src !== 'waiting-mt4')
  const hasAnyRate = (Number(snapshot.gold) || 0) > 0
    || (Number(snapshot.silver) || 0) > 0
    || (Number(snapshot.platinum) || 0) > 0

  if (price > 0) {
    return fromSaved ? `${cur} · saved` : cur
  }
  if (fromSaved) {
    return `${cur} · not set`
  }
  if (fromLiveFeed && hasAnyRate) {
    return cur
  }
  return 'waiting MT4'
}

/**
 * Tenant top bar: live Gold / Silver / Platinum spot from ERP metal-rates API.
 * Second row shows movement since the previous live snapshot once one exists.
 */
export default function TopbarMetalTickers({ token, tenant }) {
  const [snapshot, setSnapshot] = useState({
    gold: 0,
    silver: 0,
    platinum: 0,
    currency: 'USD',
    unit: 'G',
    source: '',
    updatedAt: null,
    deltas: null,
    prevSnapshot: null,
  })
  const [error, setError] = useState(null)
  const lastSnapshotRef = useRef(null)

  const applyRates = useCallback((rates) => {
    if (!rates) return
    const next = {
      gold: Number(rates.goldPrice) || 0,
      silver: Number(rates.silverPrice) || 0,
      platinum: Number(rates.platinumPrice) || 0,
      currency: String(rates.priceCurrency || 'USD').trim().toUpperCase() || 'USD',
      unit: String(rates.priceUnit || 'G').trim().toUpperCase() || 'G',
      source: String(rates.source || '').trim(),
      updatedAt: rates.updatedAt || null,
    }
    const prevSnapshot = lastSnapshotRef.current
    let deltas = null
    if (prevSnapshot && (prevSnapshot.gold > 0 || prevSnapshot.silver > 0 || prevSnapshot.platinum > 0)) {
      deltas = {
        gold: next.gold - prevSnapshot.gold,
        silver: next.silver - prevSnapshot.silver,
        platinum: next.platinum - prevSnapshot.platinum,
      }
    }
    lastSnapshotRef.current = { gold: next.gold, silver: next.silver, platinum: next.platinum }
    setError(null)
    setSnapshot({
      ...next,
      deltas,
      prevSnapshot: prevSnapshot && (prevSnapshot.gold > 0 || prevSnapshot.silver > 0 || prevSnapshot.platinum > 0)
        ? { gold: prevSnapshot.gold, silver: prevSnapshot.silver, platinum: prevSnapshot.platinum }
        : null,
    })
  }, [])

  const load = useCallback(async () => {
    if (!token) return
    try {
      const live = await currenciesApi.getLiveMetalRates(token)
      const liveRates = live?.rates
      const g = Number(liveRates?.goldPrice) || 0
      const s = Number(liveRates?.silverPrice) || 0
      const p = Number(liveRates?.platinumPrice) || 0
      if (live?.success && liveRates && g > 0 && s > 0 && p > 0) {
        applyRates(liveRates)
        return
      }

      try {
        const market = await reportsApi.getMarketPrices(token, { ...TOPBAR_MARKET_PARAMS, fresh: 1 })
        const marketRates = marketPricesToRates(market)
        const mg = Number(marketRates?.goldPrice) || 0
        const ms = Number(marketRates?.silverPrice) || 0
        const mp = Number(marketRates?.platinumPrice) || 0
        if (marketRates && mg > 0 && ms > 0 && mp > 0) {
          applyRates(marketRates)
          return
        }
      } catch {
        // Some roles can read saved rates but not reports. Keep the topbar useful for them.
      }

      // Bridge offline or not configured: show last saved / inventory / defaults from standard endpoint
      const saved = await currenciesApi.getMetalRates(token)
      if (saved?.success && saved.rates) {
        applyRates(saved.rates)
        if (!live?.live) {
          setError(live?.message ? { message: 'bridge offline' } : null)
        }
      }
    } catch (err) {
      setError(metalErrorFromException(err))
    }
  }, [applyRates, token])

  useEffect(() => {
    void load()
    const id = window.setInterval(() => void load(), POLL_MS)
    return () => window.clearInterval(id)
  }, [load])

  useEffect(() => startMetalRatesRealtime({
    token,
    tenant,
    onRatesUpdate: (payload) => applyRates(payload?.rates || payload?.data?.rates),
  }), [applyRates, tenant, token])

  useEffect(() => {
    if (!token || typeof window === 'undefined' || typeof window.EventSource !== 'function') return undefined

    let closed = false
    const source = new window.EventSource(
      reportsApi.getMarketPricesStreamUrl(TOPBAR_MARKET_PARAMS),
      { withCredentials: true },
    )

    source.onmessage = (event) => {
      if (closed) return
      try {
        const rates = marketPricesToRates(JSON.parse(event.data))
        if (rates) applyRates(rates)
      } catch {
        // Ignore malformed stream ticks; polling and socket fallback remain active.
      }
    }

    source.onerror = () => {
      setError((prev) => prev || { message: 'market stream offline' })
    }

    return () => {
      closed = true
      source.close()
    }
  }, [applyRates, token])

  const pillBase = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.45rem',
    padding: '0.35rem 0.65rem 0.35rem 0.5rem',
    borderRadius: '999px',
    background: 'rgba(15, 23, 42, 0.42)',
    border: '1px solid rgba(255,255,255,0.14)',
    minWidth: '8.75rem',
    maxWidth: '12.5rem',
    flexShrink: 0,
  }

  return (
    <div className="flex items-center justify-end gap-2 min-w-0 flex-wrap" style={{ rowGap: 6 }}>
      {METALS.map(({ key, label, swatch, sym, labelColor }) => {
        const price = snapshot[key]
        const move = snapshot.deltas && snapshot.prevSnapshot && !error
          ? fmtMoveRow(snapshot.deltas[key], snapshot.prevSnapshot[key])
          : null

        return (
          <div
            key={key}
            style={pillBase}
            title={snapshot.updatedAt ? `Updated ${new Date(snapshot.updatedAt).toLocaleString('en-GB')}` : undefined}
          >
            <span
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: swatch,
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '0.58rem',
                fontWeight: 800,
                color: key === 'platinum' ? '#fafafa' : '#0f172a',
                letterSpacing: '-0.02em',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
              aria-hidden
            >
              {sym}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minWidth: 0, flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'auto minmax(3.75rem, 1fr)', alignItems: 'baseline', gap: '0.35rem', width: '100%', lineHeight: 1.15 }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 600, color: labelColor || 'rgba(255,255,255,0.55)', letterSpacing: '0.02em', whiteSpace: 'nowrap' }}>{label}</span>
                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: '#ffffff', textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fmtSpot(price)}</span>
              </div>
              <div
                style={{
                  marginTop: '0.12rem',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  color: error ? '#fbbf24' : move ? (move.up ? '#4ade80' : '#f87171') : 'rgba(255,255,255,0.45)',
                  whiteSpace: 'nowrap',
                }}
              >
                {move ? (
                  <>
                    <span>{move.arrow}</span>
                    <span style={{ marginLeft: '0.15rem' }}>{move.rest}</span>
                  </>
                ) : (
                  <span>{metalStatusSubline(snapshot, price, error)}</span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
