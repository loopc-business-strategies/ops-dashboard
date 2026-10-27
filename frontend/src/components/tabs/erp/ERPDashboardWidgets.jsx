import React, { useEffect, useRef, useState } from 'react'
import { useErpLiveMetalSpotPrices } from './useErpLiveMetalSpotPrices'
import { mapErpLiveMarginRow } from './mapErpLiveMarginRow'
import { useExpenseRegister } from './useExpenseRegister'
import ExpenseChartsPanel from './ExpenseChartsPanel'
import ExpenseStatsFooter from './ExpenseStatsFooter'
import { useExpensePeriodFilter } from './useExpensePeriodFilter'
import { useExpenseChartData } from './useExpenseChartData'
import { useExpenseFooterStats } from './useExpenseFooterStats'
import { useLanguage } from '../../../context/LanguageContext'

import { formatAmount, formatMoney } from '../../../utils/money'
import { ERP_TAB_COLORS } from './erpTabPresentation'
import { filterAndSortDashboardMarginRows } from './dashboardMarginRows'

const ERP_LINK = ERP_TAB_COLORS.link
const ERP_POSITIVE = ERP_TAB_COLORS.positive

function fillTemplate(template, vars) {
  return String(template || '').replace(/\{(\w+)\}/g, (_, key) => (
    vars[key] == null ? '' : String(vars[key])
  ))
}

function fmtMoney(val, currency = '') {
  if (currency) return formatMoney(val, currency)
  return formatAmount(val)
}

function fmtPosition(val) {
  return Number(val || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

function MarginsWidget({
  dashboard,
  onNavigate,
  liveRecalcEnabled = false,
  baseCurrencyCode = 'USD',
}) {
  const { t } = useLanguage()
  const liveSpot = useErpLiveMetalSpotPrices()
  const goldPriceUSD = liveSpot.goldPriceUSD
  const silverPriceUSD = liveSpot.silverPriceUSD
  const marginLiveRecalc = liveRecalcEnabled && liveSpot.liveRecalcEnabled
  const [tab, setTab] = useState('customers')
  const [equitySort, setEquitySort] = useState('desc') // highest equity first by default
  const [showModal, setShowModal] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalSort, setModalSort] = useState('equity-desc')
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 })
  const dragRef = useRef(null)
  const dragging = useRef(false)
  const dragStart = useRef({ mx: 0, my: 0, px: 0, py: 0 })

  const muted = '#6B7280'; const ink = '#111827'
  const rawCustomers = dashboard?.customerMargins || []
  const rawSuppliers = dashboard?.supplierMargins?.rows || []

  const mapRow = (row, nameKey, options = {}) => mapErpLiveMarginRow(row, nameKey, {
    ...options,
    goldPriceUSD,
    silverPriceUSD,
    marginLiveRecalc,
    baseCurrencyCode,
  })
  // Customer Margins: Credit-positive funds (−ledger) + metal revaluation.
  const customers = rawCustomers.map((row) => mapRow(row, 'customerName'))
  const suppliers = rawSuppliers.map((row) => mapRow(row, 'supplierName', { suppressMetalSpotMtm: true }))
  // Card: hide Equity 0.00 rows; sort by equity (default highest → lowest).
  const activeRows = filterAndSortDashboardMarginRows(
    tab === 'suppliers' ? suppliers : customers,
    equitySort,
  )
  const activeTitle = tab === 'suppliers' ? t('erpSupplierMargin') : t('erpCustomerMargin')

  const modalRows = (() => {
    const q = modalSearch.trim().toLowerCase()
    const rows = activeRows.filter(c => !q || c.name.toLowerCase().includes(q))
    if (modalSort === 'equity-asc') {
      rows.sort((a, b) => Number(a.equity || 0) - Number(b.equity || 0))
    } else if (modalSort === 'equity-desc') {
      rows.sort((a, b) => Number(b.equity || 0) - Number(a.equity || 0))
    } else if (modalSort === 'margin-asc') {
      rows.sort((a, b) => (Number.isFinite(a.marginPercent) ? a.marginPercent : -1) - (Number.isFinite(b.marginPercent) ? b.marginPercent : -1))
    } else if (modalSort === 'name-asc') {
      rows.sort((a, b) => a.name.localeCompare(b.name))
    } else {
      rows.sort((a, b) => (Number.isFinite(b.marginPercent) ? b.marginPercent : -1) - (Number.isFinite(a.marginPercent) ? a.marginPercent : -1))
    }
    return rows
  })()

  const toggleEquitySort = () => {
    setEquitySort((prev) => (prev === 'desc' ? 'asc' : 'desc'))
  }

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
    color: active ? 'var(--purple)' : muted, cursor: 'pointer',
    borderBottom: `2px solid ${active ? 'var(--purple)' : 'transparent'}`,
    background: active ? '#fff' : 'transparent', userSelect: 'none',
  })
  const statusColor = (s) => s === 'POSITIVE' ? '#16A34A' : s === 'NEGATIVE' ? '#DC2626' : '#6B7280'

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'flex', background: '#F9FAFB', borderBottom: '1px solid #F0FDF4', flexShrink: 0 }}>
        <div style={tabSt(tab === 'customers')} onClick={() => setTab('customers')}>{t('customerMargins')}</div>
        <div style={tabSt(tab === 'suppliers')} onClick={() => setTab('suppliers')}>{t('supplierMargins')}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0.75rem 0.8125rem' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {activeRows.length === 0
            ? <p style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>{tab === 'suppliers' ? t('noSupplierData') : t('noCustomerData')}</p>
            : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                <thead><tr style={{ borderBottom: '1px solid #F0FDF4' }}>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'left',   fontSize: '0.65rem', fontWeight: '700', color: muted }}>{tab === 'suppliers' ? t('supplier') : t('customer')}</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>{t('goldPosition')}</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>{t('silverPosition')}</th>
                  <th
                    role="button"
                    tabIndex={0}
                    title={equitySort === 'desc' ? t('sortEquityDesc') : t('sortEquityAsc')}
                    onClick={toggleEquitySort}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleEquitySort() } }}
                    style={{ padding: '0.3rem 0.4rem', textAlign: 'right', fontSize: '0.65rem', fontWeight: '700', color: 'var(--purple)', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                  >
                    {t('equity')} {equitySort === 'desc' ? '↓' : '↑'}
                  </th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>{t('margin')}</th>
                  <th style={{ padding: '0.3rem 0.4rem', textAlign: 'right',  fontSize: '0.65rem', fontWeight: '700', color: muted }}>{t('marginPct')}</th>
                </tr></thead>
                <tbody>
                  {activeRows.map((c, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                      <td style={{ padding: '0.35rem 0.4rem', fontWeight: '500', color: ink }}>{c.name}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '600', color: Number(c.goldPosition || 0) < 0 ? '#DC2626' : ERP_POSITIVE, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtPosition(c.goldPosition)}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '600', color: Number(c.silverPosition || 0) < 0 ? '#DC2626' : ERP_POSITIVE, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtPosition(c.silverPosition)}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '500', color: c.equity > 0 ? '#16A34A' : c.equity < 0 ? '#DC2626' : ink }}>{c.equityFmt}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '500', color: ERP_POSITIVE, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.marginAmountFmt}</td>
                      <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', color: muted }}>{c.marginFmt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
        }
        </div>
        <p style={{ margin: '0.45rem 0 0', color: muted, fontSize: '0.68rem', lineHeight: 1.4, flexShrink: 0 }}>
          {tab === 'suppliers' ? t('supplierEquityNote') : t('customerEquityNote')}
        </p>
        <div style={{ marginTop: '0.45rem', textAlign: 'right', flexShrink: 0 }}>
          <button
            onClick={() => {
              if (onNavigate) {
                onNavigate(tab === 'suppliers' ? 'supplier-margin' : 'customer-margin')
                return
              }
              setShowModal(true); setModalSearch(''); setModalSort(equitySort === 'asc' ? 'equity-asc' : 'equity-desc'); setDragPos({ x: 0, y: 0 })
            }}
            style={{ background: 'none', border: 'none', color: ERP_LINK, cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}
          >{t('viewFullReport')}</button>
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
                <span style={{ color: '#FFFFFF', fontWeight: '700', fontSize: '1rem', letterSpacing: '0.02em' }}>{fillTemplate(t('titleFullReport'), { title: activeTitle })}</span>
                <span style={{ background: 'rgba(255,255,255,0.2)', color: '#FFFFFF', fontSize: '0.7rem', fontWeight: '700', borderRadius: '999px', padding: '0.1rem 0.55rem' }}>{fillTemplate(tab === 'suppliers' ? t('supplierCount') : t('customerCount'), { n: modalRows.length })}</span>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.68rem', marginLeft: '0.3rem' }}>{t('dragHint')}</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#FFFFFF', borderRadius: '0.35rem', width: '1.9rem', height: '1.9rem', cursor: 'pointer', fontSize: '1rem', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              >✕</button>
            </div>
            <div style={{ padding: '0.65rem 1rem', borderBottom: '1px solid #E2E8F0', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', background: '#F8FAFC', flexShrink: 0 }}>
              <input
                placeholder={tab === 'suppliers' ? t('searchSupplier') : t('searchCustomer')}
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                style={{ flex: 1, minWidth: '160px', padding: '0.42rem 0.65rem', border: '1px solid #CBD5E1', borderRadius: '0.4rem', fontSize: '0.82rem', color: ink, background: '#FFFFFF' }}
              />
              <select
                value={modalSort}
                onChange={(e) => setModalSort(e.target.value)}
                style={{ padding: '0.42rem 0.6rem', border: '1px solid #CBD5E1', borderRadius: '0.4rem', background: '#FFFFFF', color: ink, fontSize: '0.82rem' }}
              >
                <option value="equity-desc">{t('sortEquityDesc')}</option>
                <option value="equity-asc">{t('sortEquityAsc')}</option>
                <option value="margin-desc">{t('sortMarginDesc')}</option>
                <option value="margin-asc">{t('sortMarginAsc')}</option>
                <option value="name-asc">{t('sortNameAsc')}</option>
              </select>
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {modalRows.length === 0
                ? <p style={{ textAlign: 'center', color: '#9CA3AF', padding: '2rem', fontSize: '0.85rem' }}>{tab === 'suppliers' ? t('noSuppliersFound') : t('noCustomersFound')}</p>
                : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--brand-soft)', borderBottom: '1px solid var(--brand-border)', position: 'sticky', top: 0, zIndex: 1 }}>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'left',   fontWeight: '700', color: 'var(--brand-on-soft)', fontSize: '0.78rem' }}>{tab === 'suppliers' ? t('supplierName') : t('customerName')}</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: 'var(--brand-on-soft)', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>{t('goldPosition')}</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: 'var(--brand-on-soft)', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>{t('silverPosition')}</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: 'var(--brand-on-soft)', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>{t('equity')}</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: 'var(--brand-on-soft)', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>{t('margin')}</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: 'var(--brand-on-soft)', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>{t('excess')}</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'center', fontWeight: '700', color: 'var(--brand-on-soft)', fontSize: '0.78rem' }}>{t('status')}</th>
                        <th style={{ padding: '0.5rem 0.9rem', textAlign: 'right',  fontWeight: '700', color: 'var(--brand-on-soft)', fontSize: '0.78rem', fontFamily: 'Consolas, monospace' }}>{t('marginPct')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modalRows.map((c, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #EEF2F7', background: i % 2 === 0 ? '#FFFFFF' : '#FCFDFF' }}>
                          <td style={{ padding: '0.42rem 0.9rem', fontWeight: '600', color: c.equity < 0 ? '#DC2626' : ERP_POSITIVE, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '220px' }}>{c.name}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: Number(c.goldPosition || 0) < 0 ? '#DC2626' : ERP_POSITIVE, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtPosition(c.goldPosition)}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: Number(c.silverPosition || 0) < 0 ? '#DC2626' : ERP_POSITIVE, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{fmtPosition(c.silverPosition)}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: c.equity > 0 ? '#16A34A' : c.equity < 0 ? '#DC2626' : ink, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.equityFmt}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: ERP_POSITIVE, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.marginAmountFmt}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: c.excess < 0 ? '#DC2626' : ERP_POSITIVE, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.excessFmt}</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'center', fontWeight: '700', fontSize: '0.75rem', color: statusColor(c.status) }}>{
                            c.status === 'POSITIVE' ? t('statusPositive')
                              : c.status === 'NEGATIVE' ? t('statusNegative')
                                : c.status === 'NEUTRAL' ? t('statusNeutral')
                                  : c.status
                          }</td>
                          <td style={{ padding: '0.42rem 0.9rem', textAlign: 'right', fontWeight: '700', color: c.equity < 0 ? '#DC2626' : ERP_POSITIVE, fontFamily: 'Consolas, monospace', fontVariantNumeric: 'tabular-nums' }}>{c.marginFmt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
              }
            </div>
            <div style={{ padding: '0.55rem 1rem', borderTop: '1px solid #E2E8F0', background: '#F8FAFC', fontSize: '0.72rem', color: muted, flexShrink: 0 }}>
              {t('equitySignedNote')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── AP/AR Widget — AR / AP tabs, full 3-col width ─────────────
function APARWidget({ dashboard, onNavigate, baseCurrencyCode = 'USD' }) {
  const { t } = useLanguage()
  const [tab, setTab] = useState('ar')
  const muted = '#6B7280'; const ink = '#111827'
  const ap = dashboard?.apAr
  const arRows = ap?.customerOutstanding || []
  const apRows = ap?.supplierOutstanding || []
  const netPosition = Number(ap?.netPosition || 0)
  const netFavorable = netPosition >= 0
  const tabSt = (active) => ({
    padding: '0.45rem 0.9rem', fontSize: '0.75rem', fontWeight: active ? '600' : '500',
    color: active ? 'var(--purple)' : muted, cursor: 'pointer',
    borderBottom: `2px solid ${active ? 'var(--purple)' : 'transparent'}`,
    background: active ? '#fff' : 'transparent', userSelect: 'none',
  })
  const headers = tab === 'ar'
    ? [t('customer'), t('outstanding'), t('count')]
    : [t('supplier'), t('outstanding'), t('count')]
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ padding: '0.75rem 0.8125rem 0', flexShrink: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', marginBottom: '0.625rem' }}>
          {[
            { label: t('receivableAR'), val: ap?.totalAR, sub: fillTemplate(t('openCount'), { n: ap?.arCount || 0 }), vc: '#16A34A', bg: '#DCFCE7' },
            { label: t('payableAP'), val: ap?.totalAP, sub: fillTemplate(t('pendingCount'), { n: ap?.apCount || 0 }), vc: '#DC2626', bg: '#FEE2E2' },
            {
              label: t('erpNetPosition').toUpperCase(),
              val: ap?.netPosition,
              sub: netFavorable ? t('favorable') : t('deficit'),
              vc: netFavorable ? '#059669' : '#DC2626',
              bg: netFavorable ? '#E8F5EF' : '#FEE2E2',
            },
          ].map(c => (
            <div key={c.label} style={{ padding: '0.625rem', borderRadius: '0.5rem', background: c.bg, textAlign: 'center' }}>
              <p style={{ fontSize: '0.62rem', color: muted, fontWeight: '700', letterSpacing: '0.04em', marginBottom: '0.2rem' }}>{c.label}</p>
              <p style={{ fontSize: '1.05rem', fontWeight: '700', color: c.vc, margin: 0 }}>{fmtMoney(c.val, baseCurrencyCode)}</p>
              <p style={{ fontSize: '0.68rem', color: c.vc, marginTop: '0.15rem' }}>{c.sub}</p>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', background: '#F9FAFB', borderBottom: '1px solid #F0FDF4', flexShrink: 0 }}>
        <div style={tabSt(tab === 'ar')} onClick={() => setTab('ar')}>{t('receivableARTab')}</div>
        <div style={tabSt(tab === 'ap')} onClick={() => setTab('ap')}>{t('payableAPTab')}</div>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0 0.8125rem 0.75rem' }}>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
          <thead><tr style={{ borderBottom: '1px solid #F0FDF4' }}>
            {headers.map((h, hi) => (
              <th key={h} style={{ padding: '0.3rem 0.4rem', textAlign: hi === 0 ? 'left' : 'right', fontSize: '0.65rem', fontWeight: '700', color: muted }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {(tab === 'ar' ? arRows : apRows).length === 0
              ? <tr><td colSpan={3} style={{ padding: '0.75rem 0.4rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.78rem' }}>{t('noOutstanding')}</td></tr>
              : (tab === 'ar' ? arRows : apRows).slice(0, 6).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #F9FAFB' }}>
                  <td style={{ padding: '0.35rem 0.4rem', fontWeight: '500', color: ink }}>{r.customerName || r.supplierName}</td>
                  <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '600', color: tab === 'ar' ? '#16A34A' : '#DC2626' }}>{fmtMoney(r.outstanding, r.currency || baseCurrencyCode)}</td>
                  <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', color: muted }}>{r.count || '—'}</td>
                </tr>
              ))
            }
          </tbody>
          {(tab === 'ar' ? arRows : apRows).length > 0 && (
            <tfoot><tr style={{ borderTop: '2px solid #E8F5EF', background: '#F9FAFB' }}>
              <td style={{ padding: '0.35rem 0.4rem', fontWeight: '700' }}>{tab === 'ar' ? t('totalAR') : t('totalAP')}</td>
              <td style={{ padding: '0.35rem 0.4rem', textAlign: 'right', fontWeight: '700', color: tab === 'ar' ? '#16A34A' : '#DC2626' }}>{fmtMoney(tab === 'ar' ? ap?.totalAR : ap?.totalAP, baseCurrencyCode)}</td>
              <td />
            </tr></tfoot>
          )}
        </table>
        </div>
        {onNavigate && (
          <div style={{ marginTop: '0.6rem', textAlign: 'right', flexShrink: 0 }}>
            <button
              onClick={() => onNavigate('apar')}
              style={{ background: 'none', border: 'none', color: ERP_LINK, cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}
            >{t('viewFullDetails')}</button>
          </div>
        )}
      </div>
    </div>
  )
}

function ExpensesWidget({ dashboard, token, baseCurrencyCode = 'USD', reportReady = true }) {
  const { t } = useLanguage()
  const expenseListReady = reportReady !== false
  const {
    year: yearFilter,
    startDate: registerStartDate,
    endDate: registerEndDate,
  } = useExpensePeriodFilter({ defaultMonth: '' })

  const {
    items: registerItems,
    total: registerTotal,
    loading: registerLoading,
  } = useExpenseRegister({
    token,
    enabled: Boolean(token) && expenseListReady,
    startDate: registerStartDate,
    endDate: registerEndDate,
    category: '',
    paymentSource: 'all',
    limit: 200,
  })

  const {
    segments,
    displayTotal,
    filteredTrend,
    maxTrend,
    peakMonthIndex,
    selectedMonthIndex,
    subLabel,
    registerReady,
  } = useExpenseChartData({
    dashboard,
    registerItems,
    registerLoading: registerLoading || !expenseListReady,
    token,
    yearFilter,
    monthFilter: '',
    trendRange: '6m',
  })

  const footerStats = useExpenseFooterStats({
    dashboard,
    registerItems,
    registerTotal,
    registerReady,
    filteredTrend,
    monthFilter: '',
  })

  if (!token) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontSize: '0.78rem', color: '#9CA3AF', textAlign: 'center', padding: '0.5rem 0' }}>{t('signInToLoadExpenses')}</p>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', minHeight: 0, padding: '0.35rem 0.45rem', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <ExpenseChartsPanel
        compact
        segments={segments}
        displayTotal={displayTotal}
        subLabel={subLabel}
        filteredTrend={filteredTrend}
        maxTrend={maxTrend}
        peakMonthIndex={peakMonthIndex}
        selectedMonthIndex={selectedMonthIndex}
        trendRangeLabel={t('monthlyExpenses')}
        baseCurrencyCode={baseCurrencyCode}
        style={{ flex: 1, minHeight: 0 }}
      />
      <ExpenseStatsFooter compact {...footerStats} baseCurrencyCode={baseCurrencyCode} />
    </div>
  )
}


function FixingPositionSummaryWidget({ dashboard, onNavigate }) {
  const { t } = useLanguage()
  const positions = Array.isArray(dashboard?.fixingPositions) ? dashboard.fixingPositions : []
  const normaliseMetalCode = (position = {}) => {
    const raw = String(position.code || position.metal || '').trim().toUpperCase()
    if (raw.includes('XAU') || raw.includes('GOLD')) return 'XAU'
    if (raw.includes('XAG') || raw.includes('SILV')) return 'XAG'
    if (raw.includes('XPT') || raw.includes('PLAT')) return 'XPT'
    if (raw.includes('XPD') || raw.includes('PALL')) return 'XPD'
    return raw
  }
  const byMetal = new Map(
    positions
      .map((p) => [normaliseMetalCode(p), p])
      .filter(([code]) => ['XAU', 'XAG', 'XPT', 'XPD'].includes(code))
  )
  const rows = [
    { code: 'XAU', title: t('metalGold'), subtitle: 'XAU' },
    { code: 'XAG', title: t('metalSilver'), subtitle: 'XAG' },
    { code: 'XPT', title: t('metalPlatinum'), subtitle: 'XPT' },
    { code: 'XPD', title: t('metalPalladium'), subtitle: 'XPD' },
  ].map((row) => {
    const p = byMetal.get(row.code) || {}
    const net = Number(p.netPosition ?? p.qty ?? 0)
    const unit = String(p.unit || 'GOZ').toUpperCase()
    return { ...row, net, unit }
  })
  const fmt = (n, u) => {
    const rounded = Math.abs(n) < 0.0005 ? 0 : n
    if (Math.abs(rounded) < 0.0005) return `0.000 ${u}`
    const abs = Math.abs(rounded).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 })
    const sign = rounded > 0 ? '+' : '-'
    return `${sign}${abs} ${u}`
  }
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0, padding: '0.65rem 0.75rem 0.75rem' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'grid', gap: '0.5rem', alignContent: 'start' }}>
        {rows.map((r) => (
          <div
            key={r.code}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: '0.75rem',
              padding: '0.55rem 0.65rem',
              border: '1px solid #FBCFE8',
              borderRadius: '0.45rem',
              background: '#FDF2F8',
            }}
          >
            <div>
              <div style={{ color: '#0F172A', fontSize: '0.8rem', fontWeight: '800' }}>{r.title}</div>
              <div style={{ color: '#9D174D', fontSize: '0.64rem', fontWeight: '700', marginTop: '0.1rem' }}>{r.subtitle}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                color: r.net < -0.0005 ? '#DC2626' : r.net > 0.0005 ? '#047857' : '#334155',
                fontSize: '0.88rem',
                fontWeight: '900',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {fmt(r.net, r.unit)}
              </div>
              <div style={{ color: '#94A3B8', fontSize: '0.6rem', fontWeight: '800', marginTop: '0.08rem', textTransform: 'uppercase' }}>{t('netPositionShort')}</div>
            </div>
          </div>
        ))}
      </div>
      {onNavigate && (
        <div style={{ marginTop: '0.55rem', textAlign: 'right', flexShrink: 0 }}>
          <button type="button" onClick={() => onNavigate('fixing-register')} style={{ background: 'none', border: 'none', color: ERP_LINK, cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}>
            {t('viewFullStatement')}
          </button>
        </div>
      )}
    </div>
  )
}


const MarginsWidgetMemo = MarginsWidget
const APARWidgetMemo = React.memo(APARWidget)
const ExpensesWidgetMemo = React.memo(ExpensesWidget)
const FixingPositionSummaryWidgetMemo = React.memo(FixingPositionSummaryWidget)

function ERPDashWidgetBody({ id, dashboard, chatMessages = [], onNavigate = null, onNavigateMain = null, options = {} }) {
  const { t } = useLanguage()
  const { liveRecalcEnabled = false } = options
  const baseCurrencyCode = options.baseCurrencyCode || 'USD'
  const bdr = '1px solid #F0FDF4'
  const muted = '#6B7280'
  const ink = '#111827'

  const VOL_COLORS = ['#F59E0B', '#9CA3AF', '#6366F1', '#EC4899', '#059669']

  const widgetContainerStyle = {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
    marginBottom: 0,
    padding: 0,
    background: 'transparent',
    borderRadius: 0,
    boxShadow: 'none',
  }

  const widgetScrollStyle = { flex: 1, minHeight: 0, overflowY: 'auto' }

  switch (id) {
    case 'margins':
      return <MarginsWidgetMemo dashboard={dashboard} onNavigate={onNavigate} liveRecalcEnabled={liveRecalcEnabled} baseCurrencyCode={baseCurrencyCode} />

    case 'bank': {
      const bankRows = dashboard?.bankBalances || []
      const cashRows = dashboard?.cashBalances || []
      const allRows = [...bankRows, ...cashRows]
      const total = allRows.reduce((s, a) => s + Number(a.balance || 0), 0)
      return (
        <div style={widgetContainerStyle}>
          <div style={widgetScrollStyle}>
          {allRows.length === 0
            ? <p style={{ fontSize: '0.78rem', color: '#9CA3AF', padding: '0.75rem' }}>{t('noAccountsFound')}</p>
            : allRows.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0.75rem', borderBottom: '1px solid #F9FAFB' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '500', color: ink }}>{a.accountName}</div>
                  <div style={{ fontSize: '0.7rem', color: muted }}>{a.accountCode}</div>
                </div>
                <span style={{ fontWeight: '600', color: ink, fontSize: '0.82rem' }}>{fmtMoney(a.balance, a.currency || baseCurrencyCode)}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.75rem', borderTop: '2px solid #E8F5EF', fontSize: '0.82rem', flexShrink: 0 }}>
            <span style={{ fontWeight: '700', color: ink }}>{t('total')}</span>
            <span style={{ fontWeight: '700', color: '#059669' }}>{fmtMoney(total, baseCurrencyCode)}</span>
          </div>
          {onNavigate && (
            <div style={{ padding: '0 0.75rem 0.6rem', textAlign: 'right', flexShrink: 0 }}>
              <button
                onClick={() => onNavigate('bank')}
                style={{ background: 'none', border: 'none', color: ERP_LINK, cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}
              >{t('viewFullDetails')}</button>
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
        { label: t('inflow'),  val: cf?.inflow,  bg: '#DCFCE7', vc: '#059669' },
        { label: t('outflow'), val: cf?.outflow, bg: '#FEE2E2', vc: '#DC2626' },
        { label: t('net'),     val: cf?.net,     bg: '#E8F5EF', vc: Number(cf?.net || 0) >= 0 ? '#059669' : '#DC2626' },
      ]
      const activityItems = [
        { key: 'operating', label: t('operating'), val: Number(activity?.operating?.net || 0) },
        { key: 'investing', label: t('investing'), val: Number(activity?.investing?.net || 0) },
        { key: 'financing', label: t('financing'), val: Number(activity?.financing?.net || 0) },
      ]
      return (
        <div style={widgetContainerStyle}>
          <div style={{ ...widgetScrollStyle, padding: '0.75rem' }}>
          {monthly.length > 0 && (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.4rem' }}>
                {[['#22C97E', t('inflow')], ['#FCA5A5', t('outflow')], ['var(--purple)', t('net')]].map(([c, l]) => (
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
                        <div style={{ flex: 1, borderRadius: '2px 2px 0 0', background: 'var(--purple)', height: `${netH}px` }} />
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
                <p style={{ fontSize: '0.82rem', fontWeight: '700', color: item.vc, margin: 0 }}>{fmtMoney(item.val, baseCurrencyCode)}</p>
              </div>
            ))}
          </div>
          {hasTrendDelta && (
            <p style={{ margin: '0.55rem 0 0', fontSize: '0.72rem', color: trendColor, fontWeight: '600', textAlign: 'right' }}>
              {fillTemplate(t('cashflowTrendDelta'), { arrow: trendArrow, amount: fmtMoney(netDelta, baseCurrencyCode) })}
            </p>
          )}
          <div style={{ marginTop: '0.45rem', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.4rem' }}>
            {activityItems.map((item) => {
              const isPos = item.val >= 0
              return (
                <div key={item.key} style={{ border: '1px solid #E5E7EB', borderRadius: '0.35rem', padding: '0.35rem 0.4rem' }}>
                  <p style={{ margin: 0, fontSize: '0.64rem', color: muted }}>{item.label}</p>
                  <p style={{ margin: '2px 0 0', fontSize: '0.72rem', fontWeight: '700', color: isPos ? '#059669' : '#DC2626' }}>
                    {fmtMoney(item.val, baseCurrencyCode)}
                  </p>
                </div>
              )
            })}
          </div>
          <p style={{ margin: '0.45rem 0 0', fontSize: '0.7rem', color: muted, textAlign: 'right' }}>
            {fillTemplate(t('runwayCoverage'), {
              runway: quality?.runwayMonths == null ? '—' : `${Number(quality.runwayMonths).toFixed(1)} mo`,
              coverage: quality?.operatingCoverage == null ? '—' : `${Number(quality.operatingCoverage).toFixed(2)}x`,
            })}
          </p>
          </div>
        </div>
      )
    }

    case 'expenses': {
      return (
        <ExpensesWidgetMemo
          dashboard={dashboard}
          token={options.token}
          reportReady={options.reportReady}
          onOpenLedgerEntry={options.onOpenLedgerEntry}
          baseCurrencyCode={baseCurrencyCode}
        />
      )
    }

    case 'volume': {
      const vols = dashboard?.volumeTraded || []
      const totalQty = vols.reduce((s, v) => s + Number(v.qty || 0), 0)
      const mx = Math.max(...vols.map(v => Number(v.qty || 0)), 1)
      return (
        <div style={widgetContainerStyle}>
          {vols.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '68px', marginBottom: '0.625rem', padding: '0.75rem 0.75rem 0', flexShrink: 0 }}>
              {vols.map((v, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '0.6rem', fontWeight: '600', color: '#059669' }}>{Number(v.qty || 0).toFixed(0)}</span>
                  <div style={{ width: '100%', background: VOL_COLORS[i % VOL_COLORS.length], borderRadius: '4px 4px 0 0', height: `${Math.max((Number(v.qty || 0) / mx) * 48, 3)}px` }} />
                  <span style={{ fontSize: '0.58rem', color: muted }}>{(v.metal || '').slice(0, 4)}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ ...widgetScrollStyle, padding: '0 0.75rem' }}>
          {vols.length === 0
            ? <p style={{ fontSize: '0.78rem', color: '#9CA3AF' }}>{t('noVolumeData')}</p>
            : vols.map((v, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.4rem 0', borderBottom: '1px solid #F9FAFB', fontSize: '0.8rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: VOL_COLORS[i % VOL_COLORS.length], display: 'inline-block' }} />
                  <span style={{ fontWeight: '500', color: ink }}>{v.metal}</span>
                </div>
                <span style={{ color: '#374151' }}>{Number(v.qty || 0).toLocaleString()} oz</span>
                <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: '500', background: '#E8F5EF', color: '#065f46' }}>{fmtMoney(v.value, baseCurrencyCode)}</span>
              </div>
            ))
          }
          </div>
          {vols.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.4rem 0.75rem', fontSize: '0.82rem', fontWeight: '600', borderTop: '1px solid #E8F5EF', flexShrink: 0 }}>
              <span>{t('total')}</span><span style={{ color: '#059669' }}>{totalQty.toLocaleString()} oz</span>
            </div>
          )}
        </div>
      )
    }

    case 'apar':
      return <APARWidgetMemo dashboard={dashboard} onNavigate={onNavigate} baseCurrencyCode={baseCurrencyCode} />

    case 'fixing':
      return <FixingPositionSummaryWidgetMemo dashboard={dashboard} onNavigate={onNavigate} />

    case 'chat': {
      const FALLBACK_MSGS = [
        { mine: false, av: 'R', bg: '#EDE9FE', tc: '#7C3AED', text: t('chatDemoMsg1'), time: '10:30 AM' },
        { mine: true,  av: 'N', bg: 'var(--brand-soft)', tc: 'var(--purple)', text: t('chatDemoMsg2'), time: '10:32 AM' },
        { mine: false, av: 'R', bg: '#EDE9FE', tc: '#7C3AED', text: t('chatDemoMsg3'), time: '11:15 AM' },
      ]
      const hasMsgs = chatMessages.length > 0
      return (
        <div style={widgetContainerStyle}>
          <div style={{ ...widgetScrollStyle, padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: hasMsgs ? '0.4rem' : '0.5rem' }}>
            {hasMsgs
              ? chatMessages.slice(-4).map((m, i) => (
                <div key={i} style={{ display: 'flex', gap: '0.4rem', alignItems: 'flex-start' }}>
                  <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'var(--brand-soft)', color: 'var(--purple)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '700', flexShrink: 0 }}>
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
                  <div style={{ maxWidth: '78%', padding: '5px 8px', borderRadius: '9px', fontSize: '0.75rem', lineHeight: 1.4, background: m.mine ? 'var(--purple)' : '#fff', color: m.mine ? 'var(--brand-on-primary)' : ink, boxShadow: '0 1px 3px rgba(0,0,0,.07)' }}>{m.text}</div>
                </div>
              ))
            }
          </div>
          {onNavigateMain && (
            <div style={{ textAlign: 'center', padding: '0.35rem 0.75rem 0.6rem', background: 'var(--brand-soft)', borderRadius: '6px', fontSize: '0.72rem', color: 'var(--purple)', fontWeight: '500', cursor: 'pointer', flexShrink: 0, margin: '0 0.75rem 0.6rem' }} onClick={() => onNavigateMain('chat')}>
              {t('openFullChat')}
            </div>
          )}
        </div>
      )
    }

    case 'notif': {
      return (
        <div style={widgetContainerStyle}>
          <div style={{ ...widgetScrollStyle, padding: '0.75rem' }}>
          {[
            {
              icon: '⚠️',
              iconBg: '#FEE2E2',
              text: fillTemplate(t('vendorsAtRisk'), {
                n: Number(dashboard?.vendorComplianceRisk?.nonCompliant || 0),
                score: Number(dashboard?.vendorComplianceRisk?.averageScore || 0),
              }),
              time: t('today'),
            },
            {
              icon: '📄',
              iconBg: '#FEF9C3',
              text: fillTemplate(t('docExpiryAlert'), {
                n30: Number(dashboard?.vendorDocumentExpiry?.warning30 || 0),
                n60: Number(dashboard?.vendorDocumentExpiry?.warning60 || 0),
              }),
              time: t('today'),
            },
            ...(dashboard?.lowStockAlerts?.length ? [{
              icon: '📦',
              iconBg: '#DBEAFE',
              text: fillTemplate(t('lowStockAlerts'), { n: dashboard.lowStockAlerts.length }),
              time: t('now'),
            }] : []),
            { icon: '✅', iconBg: '#DCFCE7', text: t('dashboardRefreshed'), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
          ].map((n, i, arr) => (
            <div key={i} style={{ display: 'flex', gap: '0.625rem', padding: '0.45rem 0', borderBottom: i < arr.length - 1 ? bdr : 'none', alignItems: 'flex-start' }}>
              <div style={{ width: 28, height: 28, borderRadius: '7px', background: n.iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', flexShrink: 0 }}>{n.icon}</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: '0.75rem', color: ink, lineHeight: 1.4, margin: 0 }}>{n.text}</p>
                <p style={{ fontSize: '0.68rem', color: '#9CA3AF', marginTop: '2px' }}>{n.time}</p>
              </div>
            </div>
          ))}
          </div>
          {onNavigate && (
            <div style={{ padding: '0 0.75rem 0.6rem', textAlign: 'right', flexShrink: 0 }}>
              <button
                onClick={() => onNavigate('notif')}
                style={{ background: 'none', border: 'none', color: ERP_LINK, cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600', padding: 0, textDecoration: 'underline' }}
              >{t('viewAllAlerts')}</button>
            </div>
          )}
        </div>
      )
    }

    default: return <p style={{ fontSize: '0.82rem', color: '#9CA3AF', textAlign: 'center', padding: '1.5rem 0' }}>{t('widgetContent')}</p>
  }
}

function renderERP_DashWidget(id, dashboard, chatMessages = [], onNavigate = null, onNavigateMain = null, options = {}) {
  return (
    <ERPDashWidgetBody
      id={id}
      dashboard={dashboard}
      chatMessages={chatMessages}
      onNavigate={onNavigate}
      onNavigateMain={onNavigateMain}
      options={options}
    />
  )
}

export { fmtMoney, MarginsWidget, APARWidget, renderERP_DashWidget }
