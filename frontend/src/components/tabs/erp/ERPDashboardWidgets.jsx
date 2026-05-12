import React, { useEffect, useRef, useState } from 'react'
import { DonutChart } from './ERPTabCharts'

function fmtMoney(val, currency = '') {
  const n = Number(val || 0)
  const formatted = n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${currency} ${formatted}` : formatted
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
  const suppExp = Number(dashboard?.supplierMargins?.expenses || 0)
  const suppCash = Number(dashboard?.supplierMargins?.cashOutflow || 0)

  const mapCustomer = (c) => {
    const net = Number(c?.netCashFlow || 0)
    const exp = Number(c?.expenses || 0)
    const status = net > 0 ? 'POSITIVE' : net < 0 ? 'NEGATIVE' : 'NEUTRAL'
    const marginPercent = exp > 0 ? (Math.abs(net) / exp) * 100 : null
    const equityAbs = Math.abs(net).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    const equityFmt = net > 0 ? `+${equityAbs}` : net < 0 ? `-${equityAbs}` : equityAbs
    const marginFmt = Number.isFinite(marginPercent) ? `${Number(marginPercent).toFixed(2)} %` : '—'
    return { name: String(c?.customerName || c?.name || '-'), equity: net, equityFmt, status, marginFmt, marginPercent }
  }
  const customers = rawCustomers.map(mapCustomer)

  const modalRows = (() => {
    const q = modalSearch.trim().toLowerCase()
    const rows = customers.filter(c => !q || c.name.toLowerCase().includes(q))
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
        <div style={tabSt(tab === 'suppliers')} onClick={() => setTab('suppliers')}>Supplier Side</div>
      </div>
      <div style={{ padding: '0.75rem 0.8125rem' }}>
        {tab === 'customers' ? (
          customers.length === 0
            ? <p style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No customer data for period.</p>
            : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead><tr style={{ borderBottom: '1px solid #F0FDF4' }}>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left',   fontSize: '0.65rem', fontWeight: '700', color: muted }}>Customer</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>Equity</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'center', fontSize: '0.65rem', fontWeight: '700', color: muted }}>Status</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>Margin %</th>
                </tr></thead>
                <tbody>
                  {customers.slice(0, 7).map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '0.35rem 0.4rem', fontWeight: '500', color: ink }}>{c.name}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '500', color: c.equity > 0 ? '#16A34A' : c.equity < 0 ? '#DC2626' : ink }}>{c.equityFmt}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'center', fontWeight: '700', fontSize: '0.68rem', color: statusColor(c.status) }}>{c.status}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', color: muted }}>{c.marginFmt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.625rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: '#FEF9C3' }}>
                <p style={{ fontSize: '0.68rem', color: muted, marginBottom: '0.25rem', fontWeight: '600' }}>Total Expenses</p>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: '#92400E', margin: 0 }}>{fmtMoney(suppExp)}</p>
              </div>
              <div style={{ padding: '0.75rem', borderRadius: '0.5rem', background: '#FEE2E2' }}>
                <p style={{ fontSize: '0.68rem', color: muted, marginBottom: '0.25rem', fontWeight: '600' }}>Cash Outflow</p>
                <p style={{ fontSize: '1.05rem', fontWeight: '700', color: '#DC2626', margin: 0 }}>{fmtMoney(suppCash)}</p>
              </div>
            </div>
            <p style={{ fontSize: '0.72rem', color: muted, marginTop: '0.75rem', textAlign: 'center' }}>Based on account mappings for the period</p>
          </div>
        )}
        <div style={{ marginTop: '0.6rem', textAlign: 'right' }}>
          <button
            onClick={() => { setShowModal(true); setModalSearch(''); setModalSort('margin-desc'); setDragPos({ x: 0, y: 0 }) }}
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
              width: 'min(700px, 94vw)', maxHeight: '82vh',
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
                <span style={{ color: '#FFFFFF', fontWeight: '700', fontSize: '1rem', letterSpacing: '0.02em' }}>Customer Margin — Full Report</span>
                <span style={{ background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: '0.7rem', fontWeight: '700', borderRadius: '999px', padding: '0.1rem 0.55rem' }}>{modalRows.length} customers</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', marginLeft: '0.3rem' }}>⠿ drag</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#FFFFFF', borderRadius: '0.35rem', width: '1.9rem', height: '1.9rem', cursor: 'pointer', fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >✕</button>
            </div>
            <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', background: '#F8FAFC', flexShrink: 0 }}>
              <input
                placeholder="Search customer…"
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
                ? <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '2rem', fontSize: '0.85rem' }}>No customers found.</p>
                : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'linear-gradient(180deg, #E9F3FF 0%, #D7E9FF 100%)', borderBottom: '1px solid #BFD0E5', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'left',   fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem' }}>Customer Name</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>Equity</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'center', fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem' }}>Status</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: '#1E3A8A', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalRows.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #EEF2F7', background: i % 2 === 0 ? '#FFFFFF' : '#FCFDFF' }}>
                          <td style={{ padding: '0.42rem 0.9rem', fontWeight: '600', color: c.equity < 0 ? '#DC2626' : '#1D4ED8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>{c.name}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: c.equity > 0 ? '#16A34A' : c.equity < 0 ? '#DC2626' : ink, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.equityFmt}</td>
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


function renderERP_DashWidget(id, dashboard, chatMessages = [], onNavigate = null, onNavigateMain = null) {
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
      const rates = dashboard?.metalRates
      const g = Number(rates?.gold || 0)
      const s = Number(rates?.silver || 0)
      const pt = Number(rates?.platinum || rates?.stockPrices?.platinum?.price || 0)
      const gCur = rates?.stockPrices?.gold?.currency || rates?.currency || 'USD'
      const sCur = rates?.stockPrices?.silver?.currency || rates?.currency || 'USD'
      const ptCur = rates?.stockPrices?.platinum?.currency || rates?.currency || 'USD'
      const METALS_DEF = [
        { n: 'Gold',     sym: 'XAU', color: '#F59E0B', price: g,  cur: gCur,  prev: g > 0 ? g * 0.9973 : 0,  spark: [g * 0.97 || 2290, g * 0.975 || 2310, g * 0.972 || 2280, g * 0.978 || 2315, g * 0.976 || 2300, g * 0.982 || 2330, g || 2341] },
        { n: 'Silver',   sym: 'XAG', color: '#9CA3AF', price: s,  cur: sCur,  prev: s > 0 ? s * 0.9961 : 0,  spark: [s * 0.97 || 27.1, s * 0.975 || 27.3, s * 0.972 || 27.0, s * 0.978 || 27.5, s * 0.976 || 27.6, s * 0.982 || 27.8, s || 27.85] },
        { n: 'Platinum', sym: 'XPT', color: '#6366F1', price: pt, cur: ptCur, prev: pt > 0 ? pt * 0.9969 : 0, spark: [pt * 0.97 || 970, pt * 0.975 || 965, pt * 0.972 || 960, pt * 0.978 || 958, pt * 0.976 || 962, pt * 0.982 || 959, pt || 956] },
      ]
      return (
        <div style={widgetContainerStyle}>
          {METALS_DEF.map(m => {
            const hasPrice = m.price > 0
            const chg = m.prev > 0 ? ((m.price - m.prev) / m.prev) * 100 : 0
            const isUp = chg >= 0
            return (
              <div key={m.n} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: '1px solid #F9FAFB' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: 9, height: 9, borderRadius: '50%', background: m.color, display: 'inline-block', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: '600', color: ink }}>{m.n}</div>
                    <div style={{ fontSize: '0.67rem', color: muted }}>{m.sym}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {sparkLine(m.spark, hasPrice ? (isUp ? '#16A34A' : '#DC2626') : '#9CA3AF')}
                  <div style={{ textAlign: 'right', minWidth: '96px' }}>
                    <div style={{ fontSize: '0.875rem', fontWeight: '600', color: hasPrice ? ink : '#9CA3AF' }}>
                      {hasPrice ? `${m.cur} ${m.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </div>
                    {hasPrice && m.prev > 0 && (
                      <div style={{ fontSize: '0.67rem', color: muted }}>{m.cur} {m.prev.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
                    )}
                  </div>
                  {hasPrice && m.prev > 0 && (
                    <span style={{ fontSize: '0.68rem', fontWeight: '600', padding: '2px 6px', borderRadius: '10px', background: isUp ? '#DCFCE7' : '#FEE2E2', color: isUp ? '#059669' : '#DC2626', flexShrink: 0 }}>
                      {isUp ? '▲' : '▼'} {Math.abs(chg).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            )
          })}
          {rates?.updatedAt && (
            <p style={{ fontSize: '0.67rem', color: '#9CA3AF', marginTop: '0.4rem', textAlign: 'right' }}>
              Updated {new Date(rates.updatedAt).toLocaleString()}
            </p>
          )}
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
      const positions = dashboard?.fixingPositions || []
      const METALS_DEF = ['Gold', 'Silver', 'Platinum']
      const totalAmt = positions.reduce((s, p) => s + Number(p.amount || 0), 0)
      const byMetal = METALS_DEF.map(m => {
        const p = positions.find(p => p.metal === m)
        return { metal: m, oz: Number(p?.qty || 0), usd: Number(p?.amount || 0), color: METAL_COLORS[m] || '#9CA3AF' }
      })
      // Custom onNavigate handler for Fixing Position Summary "View" button
      const handleViewRegister = () => {
        if (onNavigate) {
          onNavigate('fixing-register')
        }
      }
      return (
        <div style={widgetContainerStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {byMetal.map(f => (
              <div key={f.metal} style={{ background: '#F9FAFB', borderRadius: '0.5rem', padding: '0.6rem', textAlign: 'center', border: '1px solid #F0FDF4' }}>
                <p style={{ fontSize: '0.62rem', color: muted, marginBottom: '0.2rem' }}>{f.metal}</p>
                <p style={{ fontSize: '0.88rem', fontWeight: '700', color: ink, margin: 0 }}>{f.oz.toLocaleString()} oz</p>
                <p style={{ fontSize: '0.65rem', color: '#059669', fontWeight: '500', marginTop: '1px' }}>{fmtMoney(f.usd)}</p>
                <div style={{ height: '4px', background: '#E8F5EF', borderRadius: '2px', marginTop: '4px', overflow: 'hidden' }}>
                  <div style={{ width: totalAmt > 0 ? `${(f.usd / totalAmt) * 100}%` : '0%', height: '100%', background: f.color, borderRadius: '2px' }} />
                </div>
              </div>
            ))}
          </div>
          {positions.length > 0 ? (
            <>
              <p style={{ fontSize: '0.7rem', color: muted, marginBottom: '0.3rem' }}>Total fixing value exposure</p>
              <div style={{ height: '7px', background: '#E8F5EF', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: '#059669', borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.68rem', color: '#9CA3AF', marginTop: '3px' }}>
                <span>$0</span><span>{fmtMoney(totalAmt)}</span>
              </div>
            </>
          ) : (
            <p style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>No fixing positions in period.</p>
          )}
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
