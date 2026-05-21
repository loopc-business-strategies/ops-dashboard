import React, { useEffect, useRef, useState } from 'react'
import { DonutChart } from './ERPTabCharts'
import { BASE, axios, getAuthConfig } from '../../../api/erp-accounting/client'

function fmtMoney(val, currency = '') {
  const n = Number(val || 0)
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${currency} ${formatted}` : formatted
}

function fmtSigned(val) {
  const n = Number(val || 0)
  const formatted = Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  if (n > 0) return `+${formatted}`
  if (n < 0) return `-${formatted}`
  return formatted
}

function fmtPosition(val) {
  return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

function MarginsWidget({ dashboard, onNavigate }) {
  const [tab, setTab] = useState('customers')
  const [showModal, setShowModal] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalSort, setModalSort] = useState('margin-desc')
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  const muted = '#6B7280'; const ink = '#111827'
  const rawCustomers = dashboard?.customerMargins || []
  const rawSuppliers = dashboard?.supplierMargins?.rows || []

  const mapMarginRow = (row, nameKey, options = {}) => {
    const rawNet = Number(row?.equity ?? row?.netCashFlow ?? 0)
    const marginAmount = Number(row?.marginAmount || 0)
    const rawExcess = Number(row?.marginExcess ?? (rawNet - marginAmount))
    const net = options.favorableCredit && rawNet < 0 ? Math.abs(rawNet) : rawNet
    const excess = options.favorableCredit && rawExcess < 0 ? Math.abs(rawExcess) : rawExcess
    const status = String(row?.status || (net > 0 ? 'POSITIVE' : net < 0 ? 'NEGATIVE' : 'NEUTRAL')).toUpperCase()
    const rawMargin = row?.marginPercent
    const marginPercent = Number.isFinite(Number(rawMargin)) ? Number(rawMargin) : (marginAmount > 0 ? (Math.abs(net) / marginAmount) * 100 : 0)
    const equityFmt = fmtSigned(net)
    const marginFmt = Number.isFinite(marginPercent) ? `${Number(marginPercent).toFixed(2)} %` : '—'
    return {
      name: String(row?.[nameKey] || row?.name || '-'),
      equity: net,
      equityFmt,
      status,
      marginAmount,
      marginAmountFmt: fmtMoney(marginAmount),
      excess,
      excessFmt: fmtSigned(excess),
      goldPosition: Number(row?.goldPosition || 0),
      silverPosition: Number(row?.silverPosition || 0),
      marginFmt,
      marginPercent,
    }
  }
  const customers = rawCustomers.map((row) => mapMarginRow(row, 'customerName', { favorableCredit: true }))
  const suppliers = rawSuppliers.map((row) => mapMarginRow(row, 'supplierName'))
  const activeRows = tab === 'suppliers' ? suppliers : customers
  const activeLabel = tab === 'suppliers' ? 'supplier' : 'customer'
  const activeTitle = tab === 'suppliers' ? 'Supplier Margin' : 'Customer Margin'

  const modalRows = (() => {
    const q = modalSearch.trim().toLowerCase()
    const rows = activeRows.filter(c => !q || c.name.toLowerCase().includes(q))
    if (modalSort === 'margin-asc')    rows.sort((a, b) => (Number.isFinite(a.marginPercent) ? a.marginPercent : -1) - (Number.isFinite(b.marginPercent) ? b.marginPercent : -1))
    else if (modalSort === 'name-asc') rows.sort((a, b) => a.name.localeCompare(b.name))
    else                               rows.sort((a, b) => (Number.isFinite(b.marginPercent) ? b.marginPercent : -1) - (Number.isFinite(a.marginPercent) ? a.marginPercent : -1))
    return rows
  })()

  const onMouseDown = (e) => {
    if (e.target.closest('button')) return
    dragging.current = true
    dragStart.current = { mx: e.clientX, my: e.clientY, px: dragPos.x, py: dragPos.y }
    e.preventDefault()
  }
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      setDragPos({ x: dragStart.current.px + e.clientX - dragStart.current.mx, y: dragStart.current.py + e.clientY - dragStart.current.my })
    }
    const onUp = () => { dragging.current = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [])

  const tabSt = (active) => ({
    padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: active ? '600' : '500',
    color: active ? '#059669' : muted, cursor: 'pointer',
    borderBottom: `2px solid ${active ? '#059669' : 'transparent'}`,
    background: active ? '#fff' : 'transparent', userSelect: 'none',
  })
  const statusColor = (s) => s === 'POSITIVE' ? '#16A34A' : s === 'NEGATIVE' ? '#DC2626' : '#6B7280'

  return (
    <div>
      <div style={{ display: 'flex', background: '#F9FAFB', borderBottom: '1px solid #F0FDF4' }}>
        <div style={tabSt(tab === 'customers')} onClick={() => setTab('customers')}>Customer Margins</div>
        <div style={tabSt(tab === 'suppliers')} onClick={() => setTab('suppliers')}>Supplier Margins</div>
      </div>
      <div style={{ padding: '0.75rem 0.8125rem' }}>
        {activeRows.length === 0
            ? <p style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No {activeLabel} data available.</p>
            : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead><tr style={{ borderBottom: '1px solid #F0FDF4' }}>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left',   fontSize: '0.65rem', fontWeight: '700', color: muted }}>{tab === 'suppliers' ? 'Supplier' : 'Customer'}</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>Gold Position</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>Silver Position</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>Equity</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>Margin</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>Excess</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '700', color: muted }}>Status</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>Margin %</th>
                </tr></thead>
                <tbody>
                  {activeRows.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '0.35rem 0.4rem', fontWeight: '500', color: ink }}>{c.name}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '600', color: Number(c.goldPosition || 0) < 0 ? '#DC2626' : '#1D4ED8', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtPosition(c.goldPosition)}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '600', color: Number(c.silverPosition || 0) < 0 ? '#DC2626' : '#1D4ED8', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtPosition(c.silverPosition)}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '500', color: c.equity > 0 ? '#16A34A' : c.equity < 0 ? '#DC2626' : ink }}>{c.equityFmt}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '500', color: '#1D4ED8', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.marginAmountFmt}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '500', color: c.excess < 0 ? '#DC2626' : '#1D4ED8', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.excessFmt}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'center', fontWeight: '700', fontSize: '0.68rem', color: statusColor(c.status) }}>{c.status}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', color: muted }}>{c.marginFmt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }
        <div style={{ marginTop: '0.6rem', textAlign: 'right' }}>
          <button
            onClick={() => {
              if (onNavigate) {
                onNavigate(tab === 'suppliers' ? 'supplier-margin' : 'customer-margin')
                return
              }
              setShowModal(true); setModalSearch(''); setModalSort('margin-desc'); setDragPos({ x: 0, y: 0 })
            }}
            style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}
          >↗ View Full Report</button>
        </div>
      </div>

      {/* ── Full Report Modal (centered, draggable, see-through backdrop) ── */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 3000, pointerEvents: 'none' }}>
          <div
            onClick={() => setShowModal(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.18)', backdropFilter: 'blur(1px)', pointerEvents: 'all' }}
          />
          <div
            ref={dragRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              transform: `translate(calc(-50% + ${dragPos.x}px), calc(-50% + ${dragPos.y}px))`,
              width: 'min(1080px, 96vw)', maxHeight: '82vh',
              display: 'flex', flexDirection: 'column',
              background: '#FFFFFF',
              borderRadius: '0.7rem',
              boxShadow: '0 24px 64px rgba(15,23,42,0.35)',
              overflow: 'hidden',
              pointerEvents: 'all',
            }}
          >
            <div
              onMouseDown={onMouseDown}
              style={{ background: 'var(--grad-brand)', padding: '0.85rem 1.1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, cursor: 'grab', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <span style={{ fontSize: '1.1rem' }}>📊</span>
                <span style={{ color: '#FFFFFF', fontWeight: '700', fontSize: '1rem', letterSpacing: '0.02em' }}>{activeTitle} — Full Report</span>
                <span style={{ background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: '0.7rem', fontWeight: '700', borderRadius: '999px', padding: '0.1rem 0.55rem' }}>{modalRows.length} {activeLabel}s</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', marginLeft: '0.3rem' }}>⠿ drag</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#FFFFFF', borderRadius: '0.35rem', width: '1.9rem', height: '1.9rem', cursor: 'pointer', fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >✕</button>
            </div>
            <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', background: '#F8FAFC', flexShrink: 0 }}>
              <input
                placeholder={`Search ${activeLabel}...`}
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                style={{ flex: 1, minWidth: '160px', padding: '0.42rem 0.65rem', border: '1px solid #CBD5E1', borderRadius: '0.4rem', fontSize: '0.82rem', color: ink, background: '#FFFFFF' }}
              />
              <select
                value={modalSort}
                onChange={(e) => setModalSort(e.target.value)}
                style={{ padding: '0.42rem 0.6rem', border: '1px solid #CBD5E1', borderRadius: '0.4rem', background: '#FFFFFF', color: ink, fontSize: '0.82rem' }}
              >
                <option value="margin-desc">Sort: Margin % ↓</option>
                <option value="margin-asc">Sort: Margin % ↑</option>
                <option value="name-asc">Sort: Name A–Z</option>
              </select>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {modalRows.length === 0
                ? <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '2rem', fontSize: '0.85rem' }}>No {activeLabel}s found.</p>
                : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(180deg, #E9F3FF 0%, #D7E9FF 100%)', borderBottom: '1px solid #BFD0E5', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'left',   fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem' }}>{tab === 'suppliers' ? 'Supplier Name' : 'Customer Name'}</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>Gold Position</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>Silver Position</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>Equity</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>Margin</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>Excess</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'center', fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem' }}>Status</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalRows.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #EEF2F7', background: i % 2 === 0 ? '#FFFFFF' : '#FCFDFF' }}>
                          <td style={{ padding: '0.42rem 0.9rem', fontWeight: '600', color: c.equity < 0 ? '#DC2626' : '#1D4ED8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>{c.name}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: Number(c.goldPosition || 0) < 0 ? '#DC2626' : '#1D4ED8', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtPosition(c.goldPosition)}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: Number(c.silverPosition || 0) < 0 ? '#DC2626' : '#1D4ED8', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtPosition(c.silverPosition)}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: c.equity > 0 ? '#16A34A' : c.equity < 0 ? '#DC2626' : ink, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.equityFmt}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: '#1D4ED8', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.marginAmountFmt}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: c.excess < 0 ? '#DC2626' : '#1D4ED8', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.excessFmt}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: statusColor(c.status) }}>{c.status}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: c.equity < 0 ? '#DC2626' : '#1D4ED8', fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.marginFmt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
            <div style={{ padding: '0.55rem 1rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '0.72rem', color: muted, flexShrink: 0 }}>
              Equity shows signed net cash flow. Positive values are favorable, negative values are payable.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const SPOT_METAL_ROWS = [
  { key: 'gold', label: 'Gold', symbol: 'XAU', color: '#D97706' },
  { key: 'silver', label: 'Silver', symbol: 'XAG', color: '#64748B' },
  { key: 'platinum', label: 'Platinum', symbol: 'XPT', color: '#4F46E5' },
  { key: 'palladium', label: 'Palladium', symbol: 'XPD', color: '#0F766E' },
]

/** Trading-style spot strip: USD per troy oz, fast refresh, tick flash on change. */
function SpotMetalsLiveWidget() {
  const currency = 'USD'
  const unit = 'toz'
  const [market, setMarket] = useState({
    metals: {},
    currency: 'USD',
    unit: 'toz',
    source: '',
    updatedAt: null,
    warning: '',
    feedStatus: '',
    cached: false,
    streamSeq: 0,
    streamAt: null,
  })
  const [history, setHistory] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [transport, setTransport] = useState('loading')
  const [tickDir, setTickDir] = useState({})
  const lastMid = useRef({})

  useEffect(() => {
    let cancelled = false
    let es = null
    let pollTimer = null
    let fallbackTimer = null
    let gotStreamMessage = false

    const applyPayload = (payload, { showSpinner } = { showSpinner: false }) => {
      if (!payload || payload.success === false) {
        setError(payload?.message || 'Spot feed unavailable')
        if (showSpinner) setLoading(false)
        return
      }
      const metals = payload.metals || {}
      const nextDir = {}
      SPOT_METAL_ROWS.forEach(({ key }) => {
        const n = Number(metals[key] || 0)
        const prev = Number(lastMid.current[key])
        if (Number.isFinite(n) && n > 0 && Number.isFinite(prev) && prev > 0 && n !== prev) {
          nextDir[key] = n > prev ? 'up' : 'down'
        }
      })
      lastMid.current = {
        ...lastMid.current,
        ...Object.fromEntries(SPOT_METAL_ROWS.map(({ key }) => [key, Number(metals[key] || 0)])),
      }
      if (Object.keys(nextDir).length) {
        setTickDir(nextDir)
        window.setTimeout(() => setTickDir({}), 700)
      }

      setMarket({
        metals,
        currency: payload.currency || currency,
        unit: payload.unit || unit,
        source: payload.source || '',
        updatedAt: payload.updatedAt || payload.generatedAt || null,
        warning: payload.warning || '',
        feedStatus: payload.feedStatus || '',
        cached: Boolean(payload.cached),
        streamSeq: Number(payload.streamSeq || 0),
        streamAt: payload.streamAt != null ? Number(payload.streamAt) : null,
      })
      setHistory((prev) => {
        const next = { ...prev }
        const forceTape = Number(payload.streamSeq || 0) > 0
        Object.entries(metals).forEach(([metal, price]) => {
          const n = Number(price || 0)
          if (!Number.isFinite(n) || n <= 0) return
          const arr = next[metal] || []
          const last = arr[arr.length - 1]
          if (!forceTape && Number(last) === n) return
          next[metal] = [...arr, n].slice(-64)
        })
        return next
      })
      setError('')
      if (showSpinner) setLoading(false)
    }

    const pollOnce = async (showSpinner) => {
      if (cancelled) return
      if (showSpinner) setLoading(true)
      try {
        const { data: payload } = await axios.get(`${BASE}/reports/market-prices`, getAuthConfig(null, { currency, unit }))
        applyPayload(payload, { showSpinner })
      } catch (err) {
        setError(err.response?.data?.message || 'Spot feed unavailable')
        if (showSpinner) setLoading(false)
      }
    }

    const startPolling = () => {
      if (pollTimer || cancelled) return
      setTransport('poll')
      void pollOnce(true)
      pollTimer = window.setInterval(() => { void pollOnce(false) }, 3200)
    }

    const cleanup = () => {
      cancelled = true
      window.clearTimeout(fallbackTimer)
      if (es) {
        es.close()
        es = null
      }
      if (pollTimer) {
        window.clearInterval(pollTimer)
        pollTimer = null
      }
    }

    if (typeof EventSource === 'undefined') {
      startPolling()
      return cleanup
    }

    const streamUrl = `${BASE}/reports/market-prices/stream?currency=${encodeURIComponent(currency)}&unit=${encodeURIComponent(unit)}`
    setLoading(true)

    try {
      es = new EventSource(streamUrl, { withCredentials: true })
    } catch {
      startPolling()
      return cleanup
    }

    fallbackTimer = window.setTimeout(() => {
      if (cancelled || gotStreamMessage) return
      if (es) {
        es.close()
        es = null
      }
      startPolling()
    }, 5000)

    let firstSse = true
    es.onmessage = (ev) => {
      if (cancelled) return
      try {
        gotStreamMessage = true
        window.clearTimeout(fallbackTimer)
        applyPayload(JSON.parse(ev.data), { showSpinner: firstSse })
        firstSse = false
        setTransport('sse')
      } catch {
        /* ignore malformed chunk */
      }
    }

    es.onerror = () => {
      if (cancelled) return
      if (!gotStreamMessage) return
      if (es) {
        es.close()
        es = null
      }
      startPolling()
    }

    return cleanup
  }, [currency, unit])

  const live = String(market.feedStatus || '').toLowerCase() === 'live'
  const spotDecimals = live ? 4 : 2
  const money = (value) =>
    `USD ${Number(value || 0).toLocaleString('en-US', {
      minimumFractionDigits: spotDecimals,
      maximumFractionDigits: spotDecimals,
    })}`

  const spark = (values, stroke) => {
    const data = (values || []).filter((v) => Number.isFinite(v) && v > 0)
    if (data.length === 0) {
      return (
        <svg width="88" height="36" viewBox="0 0 88 36" aria-hidden="true" style={{ flexShrink: 0 }}>
          <line x1="4" y1="18" x2="84" y2="18" stroke="#cbd5e1" strokeWidth="1.2" strokeDasharray="4 3" strokeLinecap="round" />
        </svg>
      )
    }
    if (data.length === 1) {
      return (
        <svg width="88" height="36" viewBox="0 0 88 36" aria-hidden="true" style={{ flexShrink: 0 }}>
          <line x1="4" y1="18" x2="84" y2="18" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    }
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || Math.max(Math.abs(max) * 0.0001, 1e-9)
    const points = data.map((v, index) => `${(index / (data.length - 1)) * 88},${30 - ((v - min) / range) * 22 + 4}`).join(' ')
    return (
      <svg width="88" height="36" viewBox="0 0 88 36" aria-hidden="true" style={{ flexShrink: 0 }}>
        <polyline points={points} fill="none" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.65rem',
          flexWrap: 'wrap',
          marginBottom: '0.65rem',
          padding: '0.5rem 0.55rem',
          borderRadius: '0.45rem',
          background: live ? 'linear-gradient(90deg,#052e1a 0%,#0f172a 55%,#0f172a 100%)' : 'linear-gradient(90deg,#422006 0%,#1e293b 100%)',
          border: `1px solid ${live ? '#14532d' : '#78350f'}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              borderRadius: 999,
              background: live ? '#22c55e' : '#f59e0b',
              boxShadow: live ? '0 0 0 6px rgba(34,197,94,0.18)' : 'none',
              flexShrink: 0,
            }}
          />
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.72rem', fontWeight: '800', color: '#f8fafc', letterSpacing: '0.04em' }}>SPOT · USD / troy oz</p>
            <p style={{ margin: '0.12rem 0 0', fontSize: '0.62rem', color: '#94a3b8', fontWeight: '600' }}>
              {loading ? 'Updating…' : (
                <>
                  {live
                    ? (transport === 'sse' ? 'Live push (SSE)' : transport === 'poll' ? 'Live (poll)' : 'Connecting…')
                    : 'Fallback'}
                  {(() => {
                    const t = market.streamAt != null ? new Date(market.streamAt) : market.updatedAt ? new Date(market.updatedAt) : null
                    if (!t) return null
                    return ` · ${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                  })()}
                  {live && market.streamSeq ? ` · #${market.streamSeq}` : ''}
                </>
              )}
            </p>
          </div>
        </div>
        <div style={{ fontSize: '0.62rem', fontWeight: '700', color: '#e2e8f0', textAlign: 'right', maxWidth: '11rem' }}>
          {live ? (market.source || 'metals.dev') : (market.source || 'local')}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '0.2rem' }}>
        {SPOT_METAL_ROWS.map((metal) => {
          const rawPrice = Number(market.metals?.[metal.key] || 0)
          const values = history[metal.key] || (rawPrice > 0 ? [rawPrice] : [])
          const base = Number(values[0] || rawPrice)
          const change = base > 0 && rawPrice > 0 ? rawPrice - base : 0
          const changePct = base > 0 && rawPrice > 0 ? (change / base) * 100 : 0
          const tick = tickDir[metal.key]
          const up = change >= 0
          const stroke = tick === 'up' ? '#22c55e' : tick === 'down' ? '#ef4444' : up ? '#16a34a' : '#dc2626'
          const rowBg = tick === 'up' ? 'rgba(34,197,94,0.12)' : tick === 'down' ? 'rgba(239,68,68,0.1)' : 'transparent'

          return (
            <div
              key={metal.key}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(92px, 1fr) 92px minmax(118px, auto)',
                gap: '0.5rem',
                alignItems: 'center',
                padding: '0.48rem 0.35rem',
                borderBottom: '1px solid #e2e8f0',
                borderRadius: '0.35rem',
                background: rowBg,
                transition: 'background 0.35s ease',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 8, background: metal.color, flexShrink: 0 }} />
                  <span style={{ fontSize: '0.78rem', color: '#0f172a', fontWeight: '800' }}>{metal.label}</span>
                  <span style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: '800' }}>{metal.symbol}</span>
                </div>
                <div style={{ marginTop: 2, fontSize: '0.6rem', color: '#64748b', fontWeight: '600' }}>1 troy oz mid · strip {values.length}×</div>
              </div>
              {spark(values.length ? values : [], stroke)}
              <div style={{ textAlign: 'right' }}>
                <div
                  style={{
                    color: rawPrice > 0 ? '#0f172a' : '#94a3b8',
                    fontWeight: '900',
                    fontSize: '0.92rem',
                    fontVariantNumeric: 'tabular-nums',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {rawPrice > 0 ? money(rawPrice) : '—'}
                </div>
                <div style={{ color: stroke, fontSize: '0.64rem', fontWeight: '800', fontVariantNumeric: 'tabular-nums' }}>
                  {rawPrice > 0 && base > 0 && values.length >= 2
                    ? `${up ? '+' : ''}${money(change)} · ${up ? '+' : ''}${changePct.toFixed(3)}% strip`
                    : ' '}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {(error || market.warning) && (
        <p style={{ margin: '0.55rem 0 0', color: '#b45309', fontSize: '0.68rem', lineHeight: 1.45, fontWeight: '600' }}>
          {error || market.warning}
        </p>
      )}
    </div>
  )
}

// ── AP/AR Widget — AR / AP tabs, full 3-col width ─────────────
function APARWidget({ dashboard, onNavigate }) {
  const [tab, setTab] = useState('ar')
  const muted = '#6B7280'; const ink = '#111827'
  const ap = dashboard?.apAr
  const arRows = ap?.customerOutstanding || []
  const apRows = ap?.supplierOutstanding || []
  const tabSt = (active) => ({
    padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: active ? '600' : '500',
    color: active ? '#059669' : muted, cursor: 'pointer',
    borderBottom: `2px solid ${active ? '#059669' : 'transparent'}`,
    background: active ? '#fff' : 'transparent', userSelect: 'none',
  })
  return (
    <div>
      <div style={{ padding: '0.75rem 0.8125rem 0' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.625rem' }}>
          {[
            { label: 'RECEIVABLE (AR)', val: ap?.totalAR, sub: `${ap?.arCount || 0} open`,    vc: '#16A34A', bg: '#DCFCE7' },
            { label: 'PAYABLE (AP)',    val: ap?.totalAP, sub: `${ap?.apCount || 0} pending`, vc: '#DC2626', bg: '#FEE2E2' },
            { label: 'NET POSITION',   val: ap?.netPosition, sub: Number(ap?.netPosition || 0) >= 0 ? '▲ Favorable' : '▼ Deficit', vc: '#059669', bg: '#E8F5EF' },
          ].map(c => (
            <div key={c.label} style={{ padding: '0.625rem', borderRadius: '0.5rem', background: c.bg, textAlign: 'center' }}>
              <p style={{ fontSize: '0.62rem', color: muted, fontWeight: '700', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>{c.label}</p>
              <p style={{ fontSize: '1.05rem', fontWeight: '700', color: c.vc, margin: 0 }}>{fmtMoney(c.val)}</p>
              <p style={{ fontSize: '0.68rem', color: c.vc, marginTop: '0.15rem' }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', background: '#F9FAFB', borderBottom: '1px solid #F0FDF4' }}>
        <div style={tabSt(tab === 'ar')} onClick={() => setTab('ar')}>Receivable (AR)</div>
        <div style={tabSt(tab === 'ap')} onClick={() => setTab('ap')}>Payable (AP)</div>
      </div>
      <div style={{ padding: '0 0.8125rem 0.75rem' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead><tr style={{ borderBottom: '1px solid #F0FDF4' }}>
            {(tab === 'ar' ? ['Customer', 'Outstanding', 'Count'] : ['Supplier', 'Outstanding', 'Count']).map(h => (
              <th key={h} style={{ padding: '0.3rem 0.4rem', textAlign: h === 'Customer' || h === 'Supplier' ? 'left' : 'right', fontSize: '0.65rem', fontWeight: '700', color: muted }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(tab === 'ar' ? arRows : apRows).length === 0
              ? <tr><td colSpan={3} style={{ padding: '0.75rem 0.4rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.78rem' }}>No data for period.</td></tr>
              : (tab === 'ar' ? arRows : apRows).slice(0, 6).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td style={{ padding: '0.35rem 0.4rem', fontWeight: '500', color: ink }}>{r.customerName || r.supplierName}</td>
                  <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '600', color: tab === 'ar' ? '#16A34A' : '#DC2626' }}>{fmtMoney(r.outstanding)}</td>
                  <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', color: muted }}>{r.count || '—'}</td>
                </tr>
              ))
            }
          </tbody>
          {(tab === 'ar' ? arRows : apRows).length > 0 && (
            <tfoot><tr style={{ borderTop: '2px solid #E8F5EF', background: '#F9FAFB' }}>
              <td style={{ padding: '0.35rem 0.4rem', fontWeight: '700' }}>Total {tab === 'ar' ? 'AR' : 'AP'}</td>
              <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '700', color: tab === 'ar' ? '#16A34A' : '#DC2626' }}>{fmtMoney(tab === 'ar' ? ap?.totalAR : ap?.totalAP)}</td>
              <td />
            </tr></tfoot>
          )}
        </table>
        {onNavigate && (
          <div style={{ marginTop: '0.6rem', textAlign: 'right' }}>
            <button
              onClick={() => onNavigate('apar')}
              style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}
            >↗ View Full Details</button>
          </div>
        )}
      </div>
    </div>
  )
}


function FixingRegisterDashboardWidget({ fixingRegister, onNavigate, fallbackPositions = [] }) {
  const filter = fixingRegister?.filter || {}
  const setFilter = fixingRegister?.setFilter
  const results = Array.isArray(fixingRegister?.results) ? fixingRegister.results : []
  const opening = fixingRegister?.opening || { qtyOz: 0, value: 0 }
  const loading = Boolean(fixingRegister?.loading)
  const error = fixingRegister?.error || ''
  const options = Array.isArray(fixingRegister?.metalOptions) ? fixingRegister.metalOptions : []
  const refresh = fixingRegister?.onRefresh
  const fmtQty = fixingRegister?.formatQty || ((value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 }))
  const fmtRate = fixingRegister?.formatRate || ((value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }))
  const fmtAmt = fixingRegister?.formatAmount || ((value) => Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
  const qUnit = filter.quantityUnit || 'GOZ'
  const rUnit = filter.rateUnit || 'GOZ'
  const metalCodeLabel = String(filter.metalType || '').split('::')[0].toUpperCase() || 'ALL'
  const hasRegisterState = Boolean(fixingRegister)
  const selectedParty = filter.partyFilter === 'selected'

  const updateFilter = (patch) => {
    if (!setFilter) return
    setFilter((prev) => ({ ...prev, ...patch }))
  }
  const isQtyImpactRow = (row) => String(row?.fixingMode || '').trim().toLowerCase() !== 'unfixing'
  const totalBuyOz = results.filter((r) => r.direction === 'buy' && isQtyImpactRow(r)).reduce((s, r) => s + Number(r.qty || 0), 0)
  const totalSellOz = results.filter((r) => r.direction === 'sell' && isQtyImpactRow(r)).reduce((s, r) => s + Number(r.qty || 0), 0)
  const netOz = totalBuyOz - totalSellOz
  const openingQtyOz = filter.excludeOpeningBalance ? 0 : Number(opening.qtyOz || 0)
  const openingValue = filter.excludeOpeningBalance ? 0 : Number(opening.value || 0)
  const getRowSignedValue = (row) => {
    const amount = Number(row?.amount || 0)
    if (String(row?.fixingMode || '').trim().toLowerCase() === 'unfixing') return amount
    return String(row?.direction || '').toLowerCase() === 'buy' ? amount : -amount
  }
  const txnNetValue = results.reduce((sum, row) => sum + getRowSignedValue(row), 0)
  const closingQtyOz = openingQtyOz + netOz
  const closingValue = openingValue + txnNetValue
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
  const fmtSignedAmt = (v) => {
    const n = Number(v || 0)
    const abs = fmtAmt(Math.abs(n))
    return n < 0 ? `(${abs})` : abs
  }
  const fmtSignedQty = (v) => {
    const n = Number(v || 0)
    const abs = fmtQty(Math.abs(n), qUnit)
    return n < 0 ? `(${abs})` : abs
  }
  const fmtSignedRate = (v) => {
    const n = Number(v || 0)
    const abs = fmtRate(Math.abs(n), rUnit)
    return n < 0 ? `(${abs})` : abs
  }
  const fallbackTotal = fallbackPositions.reduce((s, p) => s + Number(p.amount || 0), 0)
  const normaliseMetalCode = (position = {}) => {
    const raw = String(position.code || position.metal || '').trim().toUpperCase()
    if (raw.includes('XAU') || raw.includes('GOLD')) return 'XAU'
    if (raw.includes('XAG') || raw.includes('SILV')) return 'XAG'
    if (raw.includes('XPT') || raw.includes('PLAT')) return 'XPT'
    return raw
  }
  const positionByMetal = new Map(
    fallbackPositions
      .map((position) => [normaliseMetalCode(position), position])
      .filter(([code]) => ['XAU', 'XAG', 'XPT'].includes(code))
  )
  const summaryRows = [
    { code: 'XAU', metal: 'Gold' },
    { code: 'XAG', metal: 'Silver' },
    { code: 'XPT', metal: 'Platinum' },
  ].map((row) => {
    const position = positionByMetal.get(row.code) || {}
    const netPosition = Number(position.netPosition ?? position.qty ?? 0)
    return {
      ...row,
      unit: position.unit || 'GOZ',
      netPosition: Number.isFinite(netPosition) ? netPosition : 0,
    }
  })
  const fmtNetPosition = (value, unit = 'GOZ') => {
    const n = Number(value || 0)
    const rounded = Math.abs(n) < 0.0005 ? 0 : n
    const abs = Math.abs(rounded).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 })
    const sign = rounded > 0 ? '+' : rounded < 0 ? '-' : ''
    return `${sign}${abs} ${unit}`
  }

  return (
    <div style={{ background: '#FFFFFF', padding: '0.7rem' }}>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        {summaryRows.map((row) => {
          const isPositive = row.netPosition > 0.0005
          const isNegative = row.netPosition < -0.0005
          return (
            <div
              key={row.code}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) auto',
                alignItems: 'center',
                gap: '0.8rem',
                padding: '0.65rem 0.75rem',
                border: '1px solid #D8E0EA',
                borderRadius: '0.45rem',
                background: '#F8FAFC',
              }}
            >
              <div>
                <div style={{ color: '#0F172A', fontSize: '0.82rem', fontWeight: '800' }}>{row.metal}</div>
                <div style={{ color: '#64748B', fontSize: '0.66rem', fontWeight: '700', marginTop: '0.12rem' }}>{row.code}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: isPositive ? '#047857' : isNegative ? '#DC2626' : '#334155', fontSize: '0.9rem', fontWeight: '900', fontVariantNumeric: 'tabular-nums' }}>
                  {fmtNetPosition(row.netPosition, row.unit)}
                </div>
                <div style={{ color: '#94A3B8', fontSize: '0.62rem', fontWeight: '800', marginTop: '0.12rem', textTransform: 'uppercase' }}>Net Position</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )

  const fieldStyle = {
    width: '100%',
    minHeight: 30,
    padding: '0.32rem 0.5rem',
    border: '1px solid #CBD5E1',
    borderRadius: '0.3rem',
    background: '#FFFFFF',
    color: '#1E293B',
    fontSize: '0.72rem',
    fontWeight: '700',
    boxSizing: 'border-box',
  }
  const labelStyle = { display: 'grid', gap: '0.18rem', color: '#64748B', fontSize: '0.6rem', fontWeight: '800' }
  const head1 = { padding: '0.26rem 0.38rem', border: '1px solid #A7ADB7', background: '#F0CF8D', color: '#263241', fontSize: '0.62rem', fontWeight: '800', textTransform: 'uppercase', whiteSpace: 'nowrap' }
  const head2 = { ...head1, padding: '0.2rem 0.38rem', background: '#F7E5BD', fontSize: '0.6rem' }
  const cell = { padding: '0.26rem 0.4rem', border: '1px solid #D5DAE2', color: '#1F2937', background: '#FFFFFF' }
  const numCell = { ...cell, textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: '600' }
  let runningQtyOz = openingQtyOz
  let runningAmount = openingValue

  return (
    <div style={{ background: '#FFFFFF' }}>
      <div style={{ padding: '0.55rem 0.7rem', borderBottom: '1px solid #E5E7EB' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '0.45rem', alignItems: 'end' }}>
          <label style={labelStyle}>
            Metal
            <select value={filter.metalType || ''} onChange={(e) => updateFilter({ metalType: e.target.value })} style={fieldStyle} disabled={!hasRegisterState}>
              {options.length ? options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>) : <option value="">All Metals</option>}
            </select>
          </label>
          <label style={labelStyle}>
            Quantity Unit
            <select value={qUnit} onChange={(e) => updateFilter({ quantityUnit: e.target.value })} style={fieldStyle} disabled={!hasRegisterState}>
              <option value="GOZ">GOZ - Troy Oz</option>
              <option value="GRAM">GRAM</option>
              <option value="KG">KG</option>
              <option value="TOLA">TOLA</option>
            </select>
          </label>
          <label style={labelStyle}>
            Rate Unit
            <select value={rUnit} onChange={(e) => updateFilter({ rateUnit: e.target.value })} style={fieldStyle} disabled={!hasRegisterState}>
              <option value="GOZ">GOZ - per Troy Oz</option>
              <option value="GRAM">GRAM</option>
              <option value="KG">KG</option>
              <option value="TOLA">TOLA</option>
            </select>
          </label>
          <label style={labelStyle}>
            From Date
            <input type="date" value={filter.fromDate || ''} onChange={(e) => updateFilter({ fromDate: e.target.value })} style={fieldStyle} disabled={!hasRegisterState} />
          </label>
          <label style={labelStyle}>
            To Date
            <input type="date" value={filter.toDate || ''} onChange={(e) => updateFilter({ toDate: e.target.value })} style={fieldStyle} disabled={!hasRegisterState} />
          </label>
        </div>
        <div style={{ marginTop: '0.45rem', display: 'grid', gridTemplateColumns: '1.15fr 0.9fr 1.45fr 0.75fr auto', gap: '0.45rem', alignItems: 'end' }}>
          <label style={labelStyle}>
            Order By
            <select value={filter.orderBy || 'voucherNo'} onChange={(e) => updateFilter({ orderBy: e.target.value })} style={fieldStyle} disabled={!hasRegisterState}>
              <option value="voucherNo">Voucher Number</option>
              <option value="docDate">Doc Date</option>
              <option value="valueDate">Value Date</option>
            </select>
          </label>
          <label style={labelStyle}>
            Group By
            <select value={filter.groupBy || 'none'} onChange={(e) => updateFilter({ groupBy: e.target.value })} style={fieldStyle} disabled={!hasRegisterState}>
              <option value="none">- None -</option>
              <option value="customer">Customer</option>
              <option value="branch">Branch</option>
              <option value="valuedate">Value Date</option>
            </select>
          </label>
          <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'center', flexWrap: 'wrap', paddingBottom: '0.34rem' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#059669', fontSize: '0.72rem', fontWeight: '800' }}>
              <input type="radio" name="dashFixingPartyFilter" checked={(filter.partyFilter || 'all') === 'all'} onChange={() => updateFilter({ partyFilter: 'all' })} disabled={!hasRegisterState} />
              All
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#475569', fontSize: '0.72rem' }}>
              <input type="radio" name="dashFixingPartyFilter" checked={filter.partyFilter === 'selected'} onChange={() => updateFilter({ partyFilter: 'selected' })} disabled={!hasRegisterState} />
              Selected
            </label>
            {selectedParty && (
              <input
                placeholder="Party name"
                value={filter.partySearch || ''}
                onChange={(e) => updateFilter({ partySearch: e.target.value })}
                style={{ ...fieldStyle, width: 180, minHeight: 28 }}
                disabled={!hasRegisterState}
              />
            )}
          </div>
          <label style={labelStyle}>
            Status
            <select value={filter.status || 'preview'} onChange={(e) => updateFilter({ status: e.target.value })} style={fieldStyle} disabled={!hasRegisterState}>
              <option value="preview">Preview</option>
              <option value="final">Final</option>
            </select>
          </label>
          <button
            type="button"
            onClick={refresh}
            disabled={!refresh || loading}
            style={{ minHeight: 30, padding: '0.3rem 0.72rem', borderRadius: '0.35rem', border: '1px solid #7DD3C7', background: loading ? '#CCFBF1' : '#ECFDF5', color: '#0F766E', fontWeight: '800', fontSize: '0.72rem', cursor: refresh && !loading ? 'pointer' : 'default' }}
          >
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
        <div style={{ marginTop: '0.42rem', display: 'flex', gap: '0.9rem', alignItems: 'center', flexWrap: 'wrap', color: '#64748B', fontSize: '0.68rem' }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#334155' }}>
            <input type="checkbox" checked={Boolean(filter.excludeOpeningBalance)} onChange={(e) => updateFilter({ excludeOpeningBalance: e.target.checked })} disabled={!hasRegisterState} />
            Exclude Opening Balance
          </label>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', color: '#334155' }}>
            <input type="checkbox" checked={Boolean(filter.excludeFutures)} onChange={(e) => updateFilter({ excludeFutures: e.target.checked })} disabled={!hasRegisterState} />
            Exclude Futures
          </label>
          <span>Unfixing rows affect USD amount balance only; XAU position balance is unchanged.</span>
        </div>
        {error && <div style={{ marginTop: '0.45rem', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', background: '#FEE2E2', color: '#991B1B', fontSize: '0.72rem', fontWeight: '600' }}>{error}</div>}
      </div>

      <div style={{ padding: '0.62rem 0.7rem 0.55rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '0.45rem', marginBottom: '0.52rem' }}>
          {[
            { label: 'Total Buy', value: `${fmtQty(totalBuyOz, qUnit)} ${qUnit}`, bg: '#DCFCE7', color: '#15803D' },
            { label: 'Total Sell', value: `${fmtQty(totalSellOz, qUnit)} ${qUnit}`, bg: '#FEE2E2', color: '#DC2626' },
            { label: 'Net Position', value: `${netOz >= 0 ? '+' : '-'}${fmtQty(Math.abs(netOz), qUnit)} ${qUnit}`, bg: '#DBEAFE', color: netOz >= 0 ? '#1D4ED8' : '#B45309' },
            { label: 'Records', value: String(results.length), bg: '#F3F4F6', color: '#111827' },
          ].map((card) => (
            <div key={card.label} style={{ padding: '0.45rem 0.55rem', borderRadius: '0.38rem', background: card.bg, minWidth: 0 }}>
              <div style={{ fontSize: '0.58rem', color: '#64748B', fontWeight: '800', textTransform: 'uppercase', marginBottom: '0.18rem' }}>{card.label}</div>
              <div style={{ color: card.color, fontSize: '0.82rem', fontWeight: '900', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.value}</div>
            </div>
          ))}
        </div>

        <div style={{ overflow: 'auto', border: '1px solid #9AA4B2', borderRadius: '0.25rem', maxHeight: '230px', background: '#FFFFFF' }}>
          <table style={{ width: '100%', minWidth: '1040px', borderCollapse: 'collapse', fontSize: '0.68rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>
                <th rowSpan={2} style={{ ...head1, textAlign: 'right' }}>#</th>
                <th rowSpan={2} style={{ ...head1, textAlign: 'left' }}>Doc Date</th>
                <th rowSpan={2} style={{ ...head1, textAlign: 'left' }}>Val Date</th>
                <th rowSpan={2} style={{ ...head1, textAlign: 'left' }}>Doc No</th>
                <th rowSpan={2} style={{ ...head1, textAlign: 'left' }}>Description</th>
                <th colSpan={3} style={{ ...head1, textAlign: 'center' }}>{`${metalCodeLabel} (${qUnit})`}</th>
                <th colSpan={3} style={{ ...head1, textAlign: 'center' }}>Amount (USD)</th>
                <th rowSpan={2} style={{ ...head1, textAlign: 'right' }}>Average</th>
              </tr>
              <tr>
                <th style={{ ...head2, textAlign: 'right' }}>In</th>
                <th style={{ ...head2, textAlign: 'right' }}>Out</th>
                <th style={{ ...head2, textAlign: 'right' }}>Balance</th>
                <th style={{ ...head2, textAlign: 'right' }}>{`Rate (${rUnit})`}</th>
                <th style={{ ...head2, textAlign: 'right' }}>Value</th>
                <th style={{ ...head2, textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ ...cell, textAlign: 'right', color: '#64748B' }}>-</td>
                <td style={cell}>-</td>
                <td style={cell}>-</td>
                <td style={{ ...cell, fontWeight: '800' }}>Opening C/F</td>
                <td style={cell}>Opening Carry Forward</td>
                <td style={numCell}>-</td>
                <td style={numCell}>-</td>
                <td style={numCell}>{fmtSignedQty(openingQtyOz)}</td>
                <td style={numCell}>-</td>
                <td style={numCell}>-</td>
                <td style={numCell}>{fmtSignedAmt(openingValue)}</td>
                <td style={numCell}>{runningQtyOz !== 0 ? fmtSignedRate(runningAmount / runningQtyOz) : '-'}</td>
              </tr>
              {results.slice(0, 5).map((row, idx) => {
                const qtyOz = Number(row.qty || 0)
                const isBuy = String(row.direction || '').toLowerCase() === 'buy'
                const signedQtyOz = isQtyImpactRow(row) ? (isBuy ? qtyOz : -qtyOz) : 0
                const signedValue = getRowSignedValue(row)
                runningQtyOz += signedQtyOz
                runningAmount += signedValue
                const avgRate = runningQtyOz !== 0 ? runningAmount / runningQtyOz : null
                return (
                  <tr key={row.rowId || `${row.voucherNo}-${idx}`} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FCFAF4' }}>
                    <td style={{ ...cell, textAlign: 'right', color: '#64748B' }}>{idx + 1}</td>
                    <td style={cell}>{fmtDate(row.docDate)}</td>
                    <td style={cell}>{fmtDate(row.valueDate)}</td>
                    <td style={{ ...cell, fontWeight: '800' }}>{row.voucherNo || '-'}</td>
                    <td style={{ ...cell, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {filter.groupBy && filter.groupBy !== 'none' && row.groupKey && <span style={{ color: '#0F766E', fontWeight: '800', marginRight: '0.3rem' }}>[{row.groupKey}]</span>}
                      {row.remarks || `${row.sourceType || ''} ${row.customerName || ''}`.trim() || '-'}
                    </td>
                    <td style={numCell}>{isBuy && qtyOz > 0 ? fmtQty(qtyOz, qUnit) : '-'}</td>
                    <td style={numCell}>{!isBuy && qtyOz > 0 ? fmtQty(qtyOz, qUnit) : '-'}</td>
                    <td style={numCell}>{fmtSignedQty(runningQtyOz)}</td>
                    <td style={numCell}>{fmtRate(Number(row.price || 0), rUnit)}</td>
                    <td style={numCell}>{fmtSignedAmt(signedValue)}</td>
                    <td style={numCell}>{fmtSignedAmt(runningAmount)}</td>
                    <td style={numCell}>{avgRate === null ? '-' : fmtSignedRate(avgRate)}</td>
                  </tr>
                )
              })}
              <tr style={{ background: '#FFF7E6' }}>
                <td style={{ ...cell, textAlign: 'right', color: '#B45309', fontWeight: '800' }}>-</td>
                <td style={{ ...cell, color: '#B45309', fontWeight: '800' }}>-</td>
                <td style={{ ...cell, color: '#B45309', fontWeight: '800' }}>-</td>
                <td style={{ ...cell, color: '#B45309', fontWeight: '800' }}>Closing C/F</td>
                <td style={{ ...cell, color: '#B45309', fontWeight: '800' }}>Closing Carry Forward</td>
                <td style={{ ...numCell, color: '#B45309' }}>{fmtQty(totalBuyOz, qUnit)}</td>
                <td style={{ ...numCell, color: '#B45309' }}>{fmtQty(totalSellOz, qUnit)}</td>
                <td style={{ ...numCell, color: '#B45309' }}>{fmtSignedQty(closingQtyOz)}</td>
                <td style={{ ...numCell, color: '#B45309' }}>-</td>
                <td style={{ ...numCell, color: '#B45309' }}>{fmtSignedAmt(txnNetValue)}</td>
                <td style={{ ...numCell, color: '#B45309' }}>{fmtSignedAmt(closingValue)}</td>
                <td style={{ ...numCell, color: '#B45309' }}>{closingQtyOz !== 0 ? fmtSignedRate(closingValue / closingQtyOz) : '-'}</td>
              </tr>
              {!results.length && (
                <tr>
                  <td colSpan={12} style={{ padding: '1rem', textAlign: 'center', color: '#94A3B8', border: '1px solid #D5DAE2' }}>
                    {hasRegisterState ? 'Click Refresh to load fixing register rows for the selected filters.' : `No fixing positions in period. Current exposure: ${fmtMoney(fallbackTotal)}`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {onNavigate && (
          <div style={{ marginTop: '0.45rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', color: '#64748B', fontSize: '0.66rem' }}>
            <span>{results.length > 5 ? `Showing first 5 of ${results.length} rows` : `${results.length} row${results.length === 1 ? '' : 's'}`}</span>
            <button onClick={() => onNavigate('fixing-register')} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '800', padding: 0, textDecoration: 'underline' }}>View full statement</button>
          </div>
        )}
      </div>
    </div>
  )
}

function renderERP_DashWidget(id, dashboard, chatMessages = [], onNavigate = null, onNavigateMain = null, options = {}) {
  const bdr = '1px solid #F0FDF4'
  const rowStyle = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: bdr, fontSize: '0.82rem' }
  const muted = '#6B7280'
  const ink = '#111827'

  const METAL_COLORS = { Gold: '#F59E0B', Silver: '#9CA3AF', Platinum: '#6366F1' }
  const VOL_COLORS = ['#F59E0B', '#9CA3AF', '#6366F1', '#EC4899', '#059669']

  // Inline sparkline helper
  const sparkLine = (data, clr) => {
    const mn = Math.min(...data), mx = Math.max(...data), rg = mx - mn || 1
    const pts = data.map((v, i) => `${(i / (data.length - 1)) * 52},${24 - ((v - mn) / rg) * 20 + 2}`).join(' ')
    return <svg width="52" height="26" style={{ flexShrink: 0 }}><polyline points={pts} fill="none" stroke={clr} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }

  // Responsive widget container style
  const widgetContainerStyle = {
    background: '#fff',
    borderRadius: '0.75rem',
    boxShadow: '0 1px 4px rgba(0,0,0,0.03)',
    padding: '1.1rem 1.2rem',
    marginBottom: '1.2rem',
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
    maxWidth: '100%',
  }

  // For mobile, reduce padding and margin
  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 640
  if (isMobile) {
    widgetContainerStyle.padding = '0.7rem 0.5rem'
    widgetContainerStyle.marginBottom = '0.7rem'
    widgetContainerStyle.borderRadius = '0.5rem'
  }

  switch (id) {
    case 'margins':
      return <div style={widgetContainerStyle}><MarginsWidget dashboard={dashboard} onNavigate={onNavigate} /></div>

    case 'metals': {
      return (
        <div style={widgetContainerStyle}>
          <SpotMetalsLiveWidget />
        </div>
      )
    }

    case 'bank': {
      const bankRows = dashboard?.bankBalances || []
      const cashRows = dashboard?.cashBalances || []
      const allRows = [...bankRows, ...cashRows]
      const total = allRows.reduce((s, a) => s + Number(a.balance || 0), 0)
      return (
        <div style={widgetContainerStyle}>
          {allRows.length === 0
            ? <p style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No accounts found.</p>
            : allRows.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #F9FAFB' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '500', color: ink }}>{a.accountName}</div>
                  <div style={{ fontSize: '0.7rem', color: muted }}>{a.accountCode}</div>
                </div>
                <span style={{ fontWeight: '600', color: ink, fontSize: '0.82rem' }}>{fmtMoney(a.balance)}</span>
              </div>
            ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem', marginTop: '0.1rem', borderTop: '2px solid #E8F5EF', fontSize: '0.82rem' }}>
            <span style={{ fontWeight: '700', color: ink }}>Total</span>
            <span style={{ fontWeight: '700', color: '#059669' }}>{fmtMoney(total)}</span>
          </div>
          {onNavigate && (
            <div style={{ marginTop: '0.6rem', textAlign: 'right' }}>
              <button
                onClick={() => onNavigate('bank')}
                style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}
              >↗ View Full Details</button>
            </div>
          )}
        </div>
      )
    }

    case 'cashflow': {
      const cf = dashboard?.cashFlow
      const monthly = cf?.monthly || []
      const getInflow = (row) => Number(row?.inflow ?? row?.cashIn ?? 0)
      const getOutflow = (row) => Number(row?.outflow ?? row?.cashOut ?? 0)
      const mx = Math.max(...monthly.map((m) => Math.max(getInflow(m), getOutflow(m))), 1)
      const currentNet = Number(monthly[monthly.length - 1]?.net || 0)
      const previousNet = Number(monthly[monthly.length - 2]?.net || 0)
      const netDelta = currentNet - previousNet
      const hasTrendDelta = monthly.length >= 2
      const trendDirection = netDelta > 0 ? 'up' : netDelta < 0 ? 'down' : 'flat'
      const trendColor = trendDirection === 'up' ? '#059669' : trendDirection === 'down' ? '#DC2626' : muted
      const trendArrow = trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→'
      const quality = cf?.quality || {}
      const activity = cf?.activity || {}
      const summaryItems = [
        { label: 'Inflow',  val: cf?.inflow,  bg: '#DCFCE7', vc: '#059669' },
        { label: 'Outflow', val: cf?.outflow, bg: '#FEE2E2', vc: '#DC2626' },
        { label: 'Net',     val: cf?.net,     bg: '#E8F5EF', vc: Number(cf?.net || 0) >= 0 ? '#059669' : '#DC2626' },
      ]
      const activityItems = [
        { key: 'operating', label: 'Operating', val: Number(activity?.operating?.net || 0) },
        { key: 'investing', label: 'Investing', val: Number(activity?.investing?.net || 0) },
        { key: 'financing', label: 'Financing', val: Number(activity?.financing?.net || 0) },
      ]
      return (
        <div style={widgetContainerStyle}>
          {monthly.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.4rem' }}>
                {[['#22C97E', 'Inflow'], ['#FCA5A5', 'Outflow'], ['#059669', 'Net']].map(([c, l]) => (
                  <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: muted }}>
                    <span style={{ width: 8, height: 8, borderRadius: '2px', background: c, display: 'inline-block' }} />{l}
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '5px', height: '72px', marginBottom: '0.6rem' }}>
                {monthly.map((m, i) => {
                  const inH = Math.max((getInflow(m) / mx) * 60, 2)
                  const outH = Math.max((getOutflow(m) / mx) * 60, 2)
                  const netH = Math.max((Math.abs(Number(m.net || 0)) / mx) * 60, 2)
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ display: 'flex', gap: '1px', alignItems: 'flex-end', height: '62px' }}>
                        <div style={{ flex: 1, borderRadius: '2px 2px 0 0', background: '#22C97E', height: `${inH}px` }} />
                        <div style={{ flex: 1, borderRadius: '2px 2px 0 0', background: '#FCA5A5', height: `${outH}px` }} />
                        <div style={{ flex: 1, borderRadius: '2px 2px 0 0', background: '#059669', height: `${netH}px` }} />
                      </div>
                      <div style={{ fontSize: '0.6rem', color: muted, marginTop: '3px' }}>{m.month}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
            {summaryItems.map(item => (
              <div key={item.label} style={{ background: item.bg, borderRadius: '0.375rem', padding: '0.5rem', textAlign: 'center' }}>
                <p style={{ fontSize: '0.67rem', color: muted, margin: '0 0 2px' }}>{item.label}</p>
                <p style={{ fontSize: '0.82rem', fontWeight: '700', color: item.vc, margin: 0 }}>{fmtMoney(item.val)}</p>
              </div>
            ))}
          </div>
          {hasTrendDelta && (
            <p style={{ margin: '0.55rem 0 0', fontSize: '0.72rem', color: trendColor, fontWeight: '600', textAlign: 'right' }}>
              {trendArrow} Cashflow trend delta: {fmtMoney(netDelta)} (vs prev month)
            </p>
          )}
          <div style={{ marginTop: '0.45rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.4rem' }}>
            {activityItems.map((item) => {
              const isPos = item.val >= 0
              return (
                <div key={item.key} style={{ border: '1px solid #E5E7EB', borderRadius: '0.35rem', padding: '0.35rem 0.4rem' }}>
                  <p style={{ margin: 0, fontSize: '0.64rem', color: muted }}>{item.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', fontWeight: '700', color: isPos ? '#059669' : '#DC2626' }}>
                    {fmtMoney(item.val)}
                  </p>
                </div>
              )
            })}
          </div>
          <p style={{ margin: '0.45rem 0 0', fontSize: '0.7rem', color: muted, textAlign: 'right' }}>
            Runway: {quality?.runwayMonths == null ? '—' : `${Number(quality.runwayMonths).toFixed(1)} mo`} | Coverage: {quality?.operatingCoverage == null ? '—' : `${Number(quality.operatingCoverage).toFixed(2)}x`}
          </p>
        </div>
      )
    }

    case 'expenses': {
      const exp = dashboard?.expenses
      const breakdown = exp?.breakdown || []
      const total = Number(exp?.total || 0)
      const COLORS = ['#1a6647', '#4DB890', '#A8D8C0', '#0EA5E9', '#6366F1', '#D97706']
      const segments = breakdown.slice(0, 6).map((item, i) => ({ label: item.name, value: item.amount, color: COLORS[i % COLORS.length] }))
      return (
        <div style={widgetContainerStyle}>
          {total === 0
            ? <p style={{ fontSize: '0.78rem', color: '#9CA3AF', textAlign: 'center', padding: '0.5rem 0' }}>No expenses in period.</p>
            : <DonutChart segments={segments} total={total} label={`$${(total / 1000).toFixed(0)}k`} />
          }
        </div>
      )
    }

    case 'volume': {
      const vols = dashboard?.volumeTraded || []
      const totalQty = vols.reduce((s, v) => s + Number(v.qty || 0), 0)
      const mx = Math.max(...vols.map(v => Number(v.qty || 0)), 1)
      return (
        <div style={widgetContainerStyle}>
          {vols.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '68px', marginBottom: '0.625rem' }}>
              {vols.map((v, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: '600', color: '#059669' }}>{Number(v.qty || 0).toFixed(0)}</span>
                  <div style={{ width: '100%', background: VOL_COLORS[i % VOL_COLORS.length], borderRadius: '4px 4px 0 0', height: `${Math.max((Number(v.qty || 0) / mx) * 48, 3)}px` }} />
                  <span style={{ fontSize: '0.58rem', color: muted }}>{(v.metal || '').slice(0, 4)}</span>
                </div>
              ))}
            </div>
          )}
          {vols.length === 0
            ? <p style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No volume data in period.</p>
            : vols.map((v, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #F9FAFB', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: VOL_COLORS[i % VOL_COLORS.length], display: 'inline-block' }} />
                  <span style={{ fontWeight: '500', color: ink }}>{v.metal}</span>
                </div>
                <span style={{ color: '#374151' }}>{Number(v.qty || 0).toLocaleString()} oz</span>
                <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '500', background: '#E8F5EF', color: '#065f46' }}>{fmtMoney(v.value)}</span>
              </div>
            ))
          }
          {vols.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '0.4rem', fontSize: '0.82rem', fontWeight: '600', borderTop: '1px solid #E8F5EF', marginTop: '0.2rem' }}>
              <span>Total</span><span style={{ color: '#059669' }}>{totalQty.toLocaleString()} oz</span>
            </div>
          )}
        </div>
      )
    }

    case 'apar':
      return <div style={widgetContainerStyle}><APARWidget dashboard={dashboard} onNavigate={onNavigate} /></div>

    case 'fixing': {
      return (
        <div style={{ ...widgetContainerStyle, padding: 0, overflow: 'hidden' }}>
          <FixingRegisterDashboardWidget fixingRegister={options.fixingRegister} onNavigate={onNavigate} fallbackPositions={dashboard?.fixingPositions || []} />
        </div>
      )
    }

    case 'chat': {
      const FALLBACK_MSGS = [
        { mine: false, av: 'R', bg: '#EDE9FE', tc: '#7C3AED', text: 'Gold fixing confirmed at $2,341.50/oz', time: '10:30 AM' },
        { mine: true,  av: 'N', bg: '#E8F5EF', tc: '#1A6647', text: 'Proceed with ABC Trading allocation', time: '10:32 AM' },
        { mine: false, av: 'R', bg: '#EDE9FE', tc: '#7C3AED', text: 'Done. Invoice #1042 sent to PlatGroup', time: '11:15 AM' },
      ]
      const hasMsgs = chatMessages.length > 0
      return (
        <div style={widgetContainerStyle}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: hasMsgs ? '0.4rem' : '0.5rem', marginBottom: '0.6rem', maxHeight: '130px', overflowY: 'auto' }}>
            {hasMsgs
              ? chatMessages.slice(-4).map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#E8F5EF', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '700', flexShrink: 0 }}>
                    {String(m.senderName || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.25rem' }}>
                      <span style={{ fontSize: '0.7rem', fontWeight: '600', color: ink }}>{m.senderName}</span>
                      <span style={{ fontSize: '0.62rem', color: '#9CA3AF', flexShrink: 0 }}>{new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p style={{ fontSize: '0.72rem', color: muted, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.text}</p>
                  </div>
                </div>
              ))
              : FALLBACK_MSGS.map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.5rem', flexDirection: m.mine ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                  <div style={{ width: 22, height: 22, borderRadius: '50%', background: m.bg, color: m.tc, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: '700', flexShrink: 0 }}>{m.av}</div>
                  <div style={{ maxWidth: '78%', padding: '5px 8px', borderRadius: '9px', fontSize: '0.75rem', lineHeight: 1.4, background: m.mine ? '#059669' : '#fff', color: m.mine ? '#fff' : ink, boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>{m.text}</div>
                </div>
              ))
            }
          </div>
          {onNavigateMain && (
            <div style={{ textAlign: 'center', padding: '0.35rem', background: '#F0FDF4', borderRadius: '6px', fontSize: '0.72rem', color: '#059669', fontWeight: '500', cursor: 'pointer' }} onClick={() => onNavigateMain('chat')}>
              💬 Open full chat →
            </div>
          )}
        </div>
      )
    }

    case 'notif': {
      return (
        <div style={widgetContainerStyle}>
          {[
            { icon: '⚠️', iconBg: '#FEE2E2', text: `${Number(dashboard?.vendorComplianceRisk?.nonCompliant || 0)} vendor(s) at risk · Avg score ${Number(dashboard?.vendorComplianceRisk?.averageScore || 0)}%`, time: 'Today' },
            { icon: '📄', iconBg: '#FEF9C3', text: `Doc expiry: ${Number(dashboard?.vendorDocumentExpiry?.warning30 || 0)} in 30d · ${Number(dashboard?.vendorDocumentExpiry?.warning60 || 0)} in 60d`, time: 'Today' },
            ...(dashboard?.lowStockAlerts?.length ? [{ icon: '📦', iconBg: '#DBEAFE', text: `${dashboard.lowStockAlerts.length} item(s) below minimum stock`, time: 'Now' }] : []),
            { icon: '✅', iconBg: '#DCFCE7', text: 'Dashboard refreshed successfully', time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          ].map((n, i, arr) => (
            <div key={i} style={{ display: 'flex', gap: '0.625rem', padding: '0.45rem 0', borderBottom: i < arr.length - 1 ? bdr : 'none', alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '7px', background: n.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>{n.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.75rem', color: ink, lineHeight: 1.4, margin: 0 }}>{n.text}</p>
                <p style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: '2px' }}>{n.time}</p>
              </div>
            </div>
          ))}
          {onNavigate && (
            <div style={{ marginTop: '0.6rem', textAlign: 'right' }}>
              <button
                onClick={() => onNavigate('notif')}
                style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}
              >↗ View All Alerts</button>
            </div>
          )}
        </div>
      )
    }
    

    default: return <p style={{ fontSize: '0.82rem', color: '#9CA3AF', textAlign: 'center', padding: '1.5rem 0' }}>Widget content</p>
  }
}

export { fmtMoney, MarginsWidget, APARWidget, renderERP_DashWidget }
