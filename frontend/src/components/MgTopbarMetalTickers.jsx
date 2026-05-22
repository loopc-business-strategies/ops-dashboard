import { useCallback, useEffect, useRef, useState } from 'react'
import { currenciesApi } from '../api/erp-accounting/currencies'
import { startMetalRatesRealtime } from '../utils/realtimeSocket'

const POLL_MS = 60_000

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

/**
 * MG tenant top bar: live Gold / Silver / Platinum spot from ERP metal-rates API.
 * Second row shows prior poll price plus move since last refresh (after the first poll).
 */
export default function MgTopbarMetalTickers({ token, tenant }) {
  const [snapshot, setSnapshot] = useState({
    gold: 0,
    silver: 0,
    platinum: 0,
    currency: 'USD',
    unit: 'G',
    source: '',
    updatedAt: null,
    deltas: null,
    prevPoll: null,
  })
  const lastPollRef = useRef(null)

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
    const prevPoll = lastPollRef.current
    let deltas = null
    if (prevPoll && (prevPoll.gold > 0 || prevPoll.silver > 0 || prevPoll.platinum > 0)) {
      deltas = {
        gold: next.gold - prevPoll.gold,
        silver: next.silver - prevPoll.silver,
        platinum: next.platinum - prevPoll.platinum,
      }
    }
    lastPollRef.current = { gold: next.gold, silver: next.silver, platinum: next.platinum }
    setSnapshot({
      ...next,
      deltas,
      prevPoll: prevPoll && (prevPoll.gold > 0 || prevPoll.silver > 0 || prevPoll.platinum > 0)
        ? { gold: prevPoll.gold, silver: prevPoll.silver, platinum: prevPoll.platinum }
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
      if (live?.success && liveRates && g > 0 && s > 0) {
        applyRates(liveRates)
        return
      }
      // Bridge offline or not configured: show last saved / inventory / defaults from standard endpoint
      const saved = await currenciesApi.getMetalRates(token)
      if (saved?.success && saved.rates) {
        applyRates(saved.rates)
      }
    } catch {
      void 0
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
        const move = snapshot.deltas && snapshot.prevPoll
          ? fmtMoveRow(snapshot.deltas[key], snapshot.prevPoll[key])
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
                  color: move ? (move.up ? '#4ade80' : '#f87171') : 'rgba(255,255,255,0.45)',
                  whiteSpace: 'nowrap',
                }}
              >
                {move ? (
                  <>
                    <span>{move.arrow}</span>
                    <span style={{ marginLeft: '0.15rem' }}>{move.rest}</span>
                  </>
                ) : (
                  <span>
                    {price > 0
                      ? (() => {
                          const cur = `${snapshot.currency}/${snapshot.unit || 'G'}`
                          const src = String(snapshot.source || '').toLowerCase()
                          const fromSaved = ['manual', 'inventory', 'default'].includes(src)
                          return fromSaved ? `${cur} · saved` : cur
                        })()
                      : 'waiting MT5'}
                  </span>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
