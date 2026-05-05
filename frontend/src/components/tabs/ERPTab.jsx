import { useEffect, useMemo, useRef, useState } from 'react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import ExcelJS from 'exceljs'
import { useAuth } from '../../context/AuthContext'
import { useLanguage } from '../../context/LanguageContext'
import erpAccountingAPI from '../../api/erp-accounting'
import messagesAPI from '../../api/messages'
import { formatTransactionAuditEntry, formatTransactionCommentKind, getTransactionBulkSelectionLabel } from './transactionWorkflow'
import ChartOfAccountsTree from './ChartOfAccountsTree'
import VoucherTab from './VoucherTab'
import DirectDealsTab from './DirectDealsTab'

const LEDGER_REFERENCE_TYPES = ['journal', 'expense', 'invoice', 'payment', 'purchase', 'vendor_payment', 'inventory', 'payroll']
const LEDGER_DEPARTMENTS = ['finance', 'sales', 'production', 'hr', 'operations', 'management']
const ENQUIRY_HISTORY_STORAGE_KEY = 'erp-account-enquiry-history'
const ENQUIRY_DETAILS_PANEL_STORAGE_KEY = 'erp-account-enquiry-details-panel'
const ENQUIRY_STATEMENT_AUDIT_TOGGLE_STORAGE_KEY = 'erp-account-statement-audit-toggle'
const INVENTORY_STOCK_CODE_SETTINGS_STORAGE_KEY = 'erp-inventory-stock-code-settings'
const ACCOUNT_TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']
const METAL_UNIT_FACTORS = {
  gram: 1,
  ounce: 31.1034768,
  kg: 1000,
}


const createInventoryMappingForm = () => ({
  mainStock: 'gold',
  customMainStock: '',
  metalType: 'gold',
  stockCode: '',
  unit: 'grams',
  currency: 'USD',
  currentPrice: '',
  priceUnit: 'OZ',
  priceCurrency: 'USD',
})

const createInventoryProductForm = () => ({
  stockTypeId: '',
  categoryName: '',
  name: '',
  description: '',
  weight: '',
  grossWeight: '',
  purity: '',
  taxType: 'VAT',
  vatPercent: '',
})

const DEFAULT_INVENTORY_STOCK_CODE_SETTINGS = {
  format: 'metal-purity',
  prefix: 'RM',
}

const resolveMainStockValueFromForm = (form) => {
  if (form.mainStock === 'custom') {
    return String(form.customMainStock || '').trim().toLowerCase()
  }
  return String(form.mainStock || '').trim().toLowerCase()
}

const getMainStockPrefix = (mainStockValue, metalTypeValue) => {
  const normalizedMain = String(mainStockValue || '').trim().toLowerCase()
  const normalizedMetal = String(metalTypeValue || '').trim().toLowerCase()
  if (normalizedMain === 'gold' || normalizedMetal === 'gold') return 'GOLD'
  if (normalizedMain === 'silver' || normalizedMetal === 'silver') return 'SILV'
  if (normalizedMain === 'platinum' || normalizedMetal === 'platinum') return 'PLAT'

  const fallback = (normalizedMain || normalizedMetal || 'STK').replace(/[^a-z0-9]/gi, '').toUpperCase()
  return (fallback || 'STK').slice(0, 4)
}

const buildAutoStockCode = (form, settings = DEFAULT_INVENTORY_STOCK_CODE_SETTINGS) => {
  const mainStockValue = resolveMainStockValueFromForm(form)
  const prefix = getMainStockPrefix(mainStockValue, form.metalType)
  const baseCode = prefix

  if (settings?.format !== 'prefix-metal-purity') {
    return baseCode
  }

  const normalizedPrefix = String(settings?.prefix || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')

  if (!normalizedPrefix) return baseCode
  return `${normalizedPrefix}-${baseCode}`
}

const buildUniqueStockCode = (baseCode, products = [], editingId = '') => {
  const normalizedBase = String(baseCode || '').trim().toUpperCase()
  if (!normalizedBase) return ''

  const existing = new Set(
    products
      .filter((item) => String(item._id || '') !== String(editingId || ''))
      .map((item) => String(item.sku || '').trim().toUpperCase())
      .filter(Boolean)
  )

  if (!existing.has(normalizedBase)) return normalizedBase
  let index = 2
  while (existing.has(`${normalizedBase}-${index}`)) {
    index += 1
  }
  return `${normalizedBase}-${index}`
}

const encodeInventoryCategoryMeta = (meta) => {
  const parts = {
    mainStock: String(meta.mainStock || '').trim().toLowerCase(),
    metalType: String(meta.metalType || '').trim().toLowerCase(),
  }
  if (meta.priceUnit) parts.priceUnit = String(meta.priceUnit).trim().toUpperCase()
  if (meta.priceCurrency) parts.priceCurrency = String(meta.priceCurrency).trim().toUpperCase()
  return Object.entries(parts).map(([k, v]) => `${k}=${v}`).join(';')
}

const decodeInventoryCategoryMeta = (category) => {
  const raw = String(category || '')
  const meta = {}
  raw.split(';').forEach((pair) => {
    const [key, ...rest] = pair.split('=')
    if (!key || rest.length === 0) return
    meta[key.trim()] = rest.join('=').trim()
  })
  return {
    mainStock: String(meta.mainStock || '').toLowerCase(),
    itemType: String(meta.itemType || '').toLowerCase(),
    metalType: String(meta.metalType || '').toLowerCase(),
    purity: String(meta.purity || ''),
  }
}

const decodeInventoryCategoryPairs = (category) => {
  const raw = String(category || '')
  const meta = {}
  raw.split(';').forEach((pair) => {
    const [key, ...rest] = pair.split('=')
    if (!key || rest.length === 0) return
    meta[key.trim()] = rest.join('=').trim()
  })
  return meta
}

const formatVatPercent = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return '-'
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return '-'
  return `${Number(numeric.toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 })}%`
}

const titleCaseWords = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).trim()

function getTransactionTypeLabels(t) {
  return {
    expense: t('expense'),
    sale: t('salesInvoice'),
    purchase: t('purchase'),
    receipt: t('receipt'),
    payment: t('payment'),
    payroll: t('payroll'),
  }
}

const TRANSACTION_STATUS_STYLES = {
  draft: { background: '#FEF3C7', color: '#92400E' },
  submitted: { background: '#DBEAFE', color: '#1D4ED8' },
  approved: { background: '#DCFCE7', color: '#166534' },
  posted: { background: '#D1FAE5', color: '#065F46' },
  returned: { background: '#FCE7F3', color: '#9D174D' },
  rejected: { background: '#FEE2E2', color: '#B91C1C' },
}

function getTransactionActionLabels(t) {
  return {
    create: t('created'),
    update: t('updated'),
    delete: t('deleted'),
    submit: t('submitted'),
    approve: t('approved'),
    post: t('posted'),
    return: t('returnedForEdit'),
    reject: t('rejected'),
    comment: t('commented'),
    upload_attachment: t('attachmentUploaded'),
    delete_attachment: t('attachmentDeleted'),
  }
}

const resolveTransactionAttachmentUrl = (attachment) => {
  if (!attachment) return '#'
  if (attachment.url) return attachment.url
  if (attachment.relativePath) return `${import.meta.env.VITE_API_BASE_URL || ''}${attachment.relativePath}`
  return '#'
}

const createTransactionForm = () => ({
  type: 'expense',
  metalFixStatus: 'fixed',
  amount: '',
  date: new Date().toISOString().slice(0, 10),
  currency: 'USD',
  exchangeRate: '1',
  description: '',
  customerId: '',
  vendorId: '',
  inventoryItemId: '',
  mappingId: '',
  debitAccountId: '',
  creditAccountId: '',
})

const C = {
  p1: '#FFFFFF',
  p2: '#F3F4F6',
  s1: 'var(--purple-light)',
  s2: 'var(--purple)',
  ink: '#111827',
  inkSoft: '#374151',
  t1: '#111827',
  t2: '#374151',
  t3: '#334155',
  danger: '#DC2626',
}

const ERP_DASH_ALL_WIDGETS = [
  { id: 'margins',  label: 'Customer & Supplier Margins',  icon: '📊', color: '#e8f5ef', desc: 'Expense & cash flow by customer/supplier', cols: 2 },
  { id: 'metals',   label: 'Current Metal Prices',          icon: '🥇', color: '#fef9c3', desc: 'Live gold, silver, platinum, palladium',    cols: 1 },
  { id: 'bank',     label: 'Bank & Cash Balances',          icon: '🏦', color: '#dbeafe', desc: 'All account balances overview',             cols: 1, viewTab: 'bank' },
  { id: 'cashflow', label: 'Cash Flow',                     icon: '💸', color: '#dcfce7', desc: 'Monthly inflow / outflow bar chart',        cols: 2 },
  { id: 'expenses', label: 'Expenses',                      icon: '📋', color: '#fee2e2', desc: 'Expense breakdown by category',             cols: 1 },
  { id: 'volume',   label: 'Total Volume Traded',           icon: '📦', color: '#e8f5ef', desc: 'Trade volume by metal type',                cols: 1 },
  { id: 'apar',     label: 'Accounts Payable & Receivable', icon: '⚖️', color: '#fef3c7', desc: 'Live AP / AR with outstanding breakdown',   cols: 3, viewTab: 'apar' },
  { id: 'fixing',   label: 'Fixing Position Summary',       icon: '📌', color: '#f0fdf4', desc: 'Open fixing positions by metal',            cols: 2, viewTab: 'fixing-register' },
  { id: 'chat',     label: 'Chat',                          icon: '💬', color: '#eff6ff', desc: 'Recent team messages',                      cols: 1, viewTab: 'chat' },
  { id: 'notif',    label: 'Notifications & Alerts',        icon: '🔔', color: '#fff7ed', desc: 'System alerts and reminders',               cols: 1, viewTab: 'notif' },
]
const ERP_DASH_DEFAULT = ['margins', 'metals', 'bank', 'cashflow', 'expenses', 'volume', 'apar', 'fixing', 'chat', 'notif']
const ERP_DASH_VALID_IDS = new Set(ERP_DASH_ALL_WIDGETS.map(w => w.id))
const sanitizeDashWidgets = (value) => {
  const src = Array.isArray(value) ? value : ERP_DASH_DEFAULT
  const seen = new Set()
  const out = []
  src.forEach((id) => { if (ERP_DASH_VALID_IDS.has(id) && !seen.has(id)) { seen.add(id); out.push(id) } })
  return out.length ? out : [...ERP_DASH_DEFAULT]
}

// ── Tiny SVG bar chart ─────────────────────────────────────────
function MiniBarChart({ data = [], valueKey = 'value', labelKey = 'label', color = '#059669', height = 56 }) {
  const [hovered, setHovered] = useState(null)
  const max = Math.max(...data.map(d => Number(d[valueKey] || 0)), 1)
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: `${height}px` }}>
        {data.map((d, i) => {
          const pct = Math.max((Number(d[valueKey] || 0) / max) * 100, 2)
          return (
            <div
              key={i}
              style={{ flex: 1, borderRadius: '2px 2px 0 0', background: hovered === i ? '#0EA5E9' : color, height: `${pct}%`, cursor: 'pointer', transition: 'background 0.15s' }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
              title={`${d[labelKey]}: ${Number(d[valueKey] || 0).toLocaleString()}`}
            />
          )
        })}
      </div>
      {hovered !== null && data[hovered] && (
        <div style={{ position: 'absolute', top: -28, left: '50%', transform: 'translateX(-50%)', background: '#111827', color: '#fff', fontSize: '0.68rem', padding: '2px 7px', borderRadius: '4px', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
          {data[hovered][labelKey]}: {Number(data[hovered][valueKey] || 0).toLocaleString()}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '3px' }}>
        {data.map((d, i) => <span key={i} style={{ flex: 1, textAlign: 'center', fontSize: '0.62rem', color: '#9CA3AF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d[labelKey]}</span>)}
      </div>
    </div>
  )
}

// ── Tiny SVG donut chart ───────────────────────────────────────
function DonutChart({ segments = [], total = 0, label = '' }) {
  const [hovered, setHovered] = useState(null)
  const r = 28; const cx = 36; const cy = 36; const stroke = 14
  let cumAngle = -90
  const arcs = segments.map((seg, i) => {
    const pct = total > 0 ? Number(seg.value) / total : 0
    const angle = pct * 360
    const startAngle = cumAngle
    cumAngle += angle
    const toRad = (deg) => (deg * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(startAngle))
    const y1 = cy + r * Math.sin(toRad(startAngle))
    const x2 = cx + r * Math.cos(toRad(startAngle + angle))
    const y2 = cy + r * Math.sin(toRad(startAngle + angle))
    const large = angle > 180 ? 1 : 0
    return { ...seg, i, x1, y1, x2, y2, large, angle, pct }
  })
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
      <svg width="72" height="72" viewBox="0 0 72 72" style={{ flexShrink: 0 }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#E8F5EF" strokeWidth={stroke} />
        {arcs.map((arc) => arc.angle < 0.5 ? null : (
          <path
            key={arc.i}
            d={`M ${arc.x1} ${arc.y1} A ${r} ${r} 0 ${arc.large} 1 ${arc.x2} ${arc.y2}`}
            fill="none"
            stroke={arc.color}
            strokeWidth={hovered === arc.i ? stroke + 2 : stroke}
            onMouseEnter={() => setHovered(arc.i)}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer', transition: 'stroke-width 0.15s' }}
          />
        ))}
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fontWeight="600" fill="#111">{label}</text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
        {arcs.map((arc) => (
          <div
            key={arc.i}
            onMouseEnter={() => setHovered(arc.i)}
            onMouseLeave={() => setHovered(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.72rem', color: hovered === arc.i ? '#111' : '#6B7280', cursor: 'default', fontWeight: hovered === arc.i ? '600' : '400' }}
          >
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: arc.color, flexShrink: 0, display: 'inline-block' }} />
            {arc.label} {(arc.pct * 100).toFixed(0)}%
          </div>
        ))}
      </div>
    </div>
  )
}

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

  const METAL_COLORS = { Gold: '#F59E0B', Silver: '#9CA3AF', Platinum: '#6366F1', Palladium: '#EC4899' }
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
      const pd = Number(rates?.palladium || rates?.stockPrices?.palladium?.price || 0)
      const gCur = rates?.stockPrices?.gold?.currency || rates?.currency || 'USD'
      const sCur = rates?.stockPrices?.silver?.currency || rates?.currency || 'USD'
      const ptCur = rates?.stockPrices?.platinum?.currency || rates?.currency || 'USD'
      const pdCur = rates?.stockPrices?.palladium?.currency || rates?.currency || 'USD'
      const METALS_DEF = [
        { n: 'Gold',      sym: 'XAU', color: '#F59E0B', price: g,  cur: gCur,  prev: g > 0 ? g * 0.9973 : 0,  spark: [g * 0.97 || 2290, g * 0.975 || 2310, g * 0.972 || 2280, g * 0.978 || 2315, g * 0.976 || 2300, g * 0.982 || 2330, g || 2341] },
        { n: 'Silver',    sym: 'XAG', color: '#9CA3AF', price: s,  cur: sCur,  prev: s > 0 ? s * 0.9961 : 0,  spark: [s * 0.97 || 27.1, s * 0.975 || 27.3, s * 0.972 || 27.0, s * 0.978 || 27.5, s * 0.976 || 27.6, s * 0.982 || 27.8, s || 27.85] },
        { n: 'Platinum',  sym: 'XPT', color: '#6366F1', price: pt, cur: ptCur, prev: pt > 0 ? pt * 0.9969 : 0, spark: [pt * 0.97 || 970, pt * 0.975 || 965, pt * 0.972 || 960, pt * 0.978 || 958, pt * 0.976 || 962, pt * 0.982 || 959, pt || 956] },
        { n: 'Palladium', sym: 'XPD', color: '#EC4899', price: pd, cur: pdCur, prev: pd > 0 ? pd * 0.9940 : 0, spark: [pd * 0.97 || 1030, pd * 0.975 || 1020, pd * 0.972 || 1015, pd * 0.978 || 1010, pd * 0.976 || 1012, pd * 0.982 || 1008, pd || 1002] },
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
      const mx = Math.max(...monthly.map(m => Math.max(Number(m.inflow || 0), Number(m.outflow || 0))), 1)
      const summaryItems = [
        { label: 'Inflow',  val: cf?.inflow,  bg: '#DCFCE7', vc: '#059669' },
        { label: 'Outflow', val: cf?.outflow, bg: '#FEE2E2', vc: '#DC2626' },
        { label: 'Net',     val: cf?.net,     bg: '#E8F5EF', vc: Number(cf?.net || 0) >= 0 ? '#059669' : '#DC2626' },
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
                  const inH = Math.max((Number(m.inflow || 0) / mx) * 60, 2)
                  const outH = Math.max((Number(m.outflow || 0) / mx) * 60, 2)
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
      const METALS_DEF = ['Gold', 'Silver', 'Platinum', 'Palladium']
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

const DEFAULT_BRANDING = {
  key: 'default',
  entityName: 'Main Entity',
  branchName: '',
  isDefault: true,
  companyName: 'Ops Dashboard ERP',
  legalName: '',
  reportSubtitle: 'Finance & Accounts Division',
  logoUrl: '',
  logoWidth: 180,
  logoHeight: 56,
  logoFit: 'contain',
  reportFooter: 'Confidential Internal Statement',
  preparedByTitle: 'Prepared By',
  preparedByName: 'Finance Officer',
  reviewedByTitle: 'Reviewed By',
  reviewedByName: 'Accounts Manager',
  approvedByTitle: 'Authorized Signatory',
  approvedByName: 'Finance Controller',
}

const DEFAULT_BRANDING_PROFILES = [{
  key: DEFAULT_BRANDING.key,
  entityName: DEFAULT_BRANDING.entityName,
  branchName: DEFAULT_BRANDING.branchName,
  companyName: DEFAULT_BRANDING.companyName,
  isDefault: DEFAULT_BRANDING.isDefault,
}]

const normalizeBrandingKey = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'default'
}

const clampBrandingDimension = (value, fallback, min, max) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(Math.max(parsed, min), max)
}

const brandingOptionLabel = (branding) => {
  const entity = branding.entityName || DEFAULT_BRANDING.entityName
  const branch = branding.branchName ? ` / ${branding.branchName}` : ''
  const company = branding.companyName ? ` - ${branding.companyName}` : ''
  return `${entity}${branch}${company}`
}

const createLogoRenderAsset = async (logoUrl, width, height, fit = 'contain') => {
  if (!logoUrl || typeof document === 'undefined') return ''

  const boxWidth = clampBrandingDimension(width, DEFAULT_BRANDING.logoWidth, 80, 260)
  const boxHeight = clampBrandingDimension(height, DEFAULT_BRANDING.logoHeight, 32, 120)

  return new Promise((resolve) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = boxWidth
        canvas.height = boxHeight
        const ctx = canvas.getContext('2d')
        if (!ctx) return resolve(logoUrl)
        ctx.clearRect(0, 0, boxWidth, boxHeight)

        if (fit === 'fill') {
          ctx.drawImage(image, 0, 0, boxWidth, boxHeight)
        } else {
          const scale = fit === 'cover'
            ? Math.max(boxWidth / image.width, boxHeight / image.height)
            : Math.min(boxWidth / image.width, boxHeight / image.height)
          const drawWidth = image.width * scale
          const drawHeight = image.height * scale
          const dx = (boxWidth - drawWidth) / 2
          const dy = (boxHeight - drawHeight) / 2
          ctx.drawImage(image, dx, dy, drawWidth, drawHeight)
        }

        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(logoUrl)
      }
    }
    image.onerror = () => resolve(logoUrl)
    image.src = logoUrl
  })
}

function ERPTab({ focusTab, onNavigateMain }) {
  const { user, token } = useAuth()
  const { t } = useLanguage()
  const TRANSACTION_TYPE_LABELS = getTransactionTypeLabels(t)
  const TRANSACTION_ACTION_LABELS = getTransactionActionLabels(t)
  const [activeTab, setActiveTab] = useState(focusTab || 'dashboard')

  useEffect(() => {
    if (focusTab) setActiveTab(focusTab)
  }, [focusTab])

  const dashStorageKey = `erp_dash_${user?.name || 'default'}`
  const [dashWidgets, setDashWidgets] = useState(() => {
    try {
      const s = localStorage.getItem(`erp_dash_${user?.name || 'default'}`)
      return sanitizeDashWidgets(s ? JSON.parse(s) : ERP_DASH_DEFAULT)
    } catch {
      return [...ERP_DASH_DEFAULT]
    }
  })
  const [dashEditMode, setDashEditMode] = useState(false)
  const [dashHoveredWid, setDashHoveredWid] = useState(null)
  const [dashWidgetCols, setDashWidgetCols] = useState({})
  const [dashCustomizeOpen, setDashCustomizeOpen] = useState(false)
  const [dashPickSelected, setDashPickSelected] = useState([])
  const dashDragSrc = useRef(null)

  // Dashboard date-range filter
  const [dashDateFrom, setDashDateFrom] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
  })
  const [dashDateTo, setDashDateTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [dashAutoRefresh, setDashAutoRefresh] = useState(false)
  const [dashChatMessages, setDashChatMessages] = useState([])
  useEffect(() => {
    try { localStorage.setItem(dashStorageKey, JSON.stringify(sanitizeDashWidgets(dashWidgets))) } catch {}
  }, [dashWidgets, dashStorageKey])

  const [accounts, setAccounts] = useState([])
  const [summaryAccounts, setSummaryAccounts] = useState([])
  const [customers, setCustomers] = useState([])
  const [customerMarginSearch, setCustomerMarginSearch] = useState('')
  const [customerMarginCompactView, setCustomerMarginCompactView] = useState(true)
  const [customerMarginSort, setCustomerMarginSort] = useState('margin-desc')
  const [customerMarginContextMenu, setCustomerMarginContextMenu] = useState({ open: false, x: 0, y: 0, row: null })
  const [fixingRegFilter, setFixingRegFilter] = useState({
    metalType: '',
    quantityUnit: 'GOZ',
    rateUnit: 'GOZ',
    orderBy: 'voucherNo',
    fromDate: new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10),
    toDate: new Date().toISOString().slice(0, 10),
    groupBy: 'none',
    partyFilter: 'all',
    partySearch: '',
    excludeOpeningBalance: false,
    excludeFutures: false,
    status: 'preview',
  })
  const [fixingRegResults, setFixingRegResults] = useState([])
  const [fixingRegOpening, setFixingRegOpening] = useState({ qtyOz: 0, value: 0 })
  const [fixingRegLoading, setFixingRegLoading] = useState(false)
  const [fixingRegShown, setFixingRegShown] = useState(false)
  const [fixingRegError, setFixingRegError] = useState('')
  const [fixingRegPanelOffset, setFixingRegPanelOffset] = useState({ x: 0, y: 0 })
  const [fixingRegPanelDrag, setFixingRegPanelDrag] = useState({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
  const [ledger, setLedger] = useState([])
  const [mappings, setMappings] = useState([])
  const [currencies, setCurrencies] = useState([])
  const [dashboard, setDashboard] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({})
  const [ledgerForm, setLedgerForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    mappingId: '',
    debitAccountId: '',
    creditAccountId: '',
    amount: '',
    description: '',
    referenceType: 'journal',
    currency: 'USD',
  })
  const [currencyForm, setCurrencyForm] = useState({ code: '', name: '', symbol: '', exchangeRate: 1, baseCurrency: false })
  const [usdConversion, setUsdConversion] = useState({ usdAmount: '1', targetCode: 'UZS' })
  const [mappingForm, setMappingForm] = useState({ mappingType: '', debitAccountId: '', creditAccountId: '', department: '', description: '' })
  const [mappingFilters, setMappingFilters] = useState({ department: '' })
  const [mappingSummary, setMappingSummary] = useState({ total: 0, shared: 0, byDepartment: {} })
  const [customerForm, setCustomerForm] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    gstVat: '',
    openingBalance: '',
    creditLimit: '',
    paymentTermsDays: '',
    currency: 'USD',
    notes: '',
  })
  const [showForm, setShowForm] = useState(false)
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const [showLedgerForm, setShowLedgerForm] = useState(false)
  const [showCurrencyForm, setShowCurrencyForm] = useState(false)
  const [showMappingForm, setShowMappingForm] = useState(false)
  const [ledgerFilters, setLedgerFilters] = useState({ startDate: '', endDate: '', department: '', referenceType: '', accountId: '' })
  const [editState, setEditState] = useState({ type: '', record: null, form: {} })
  const [success, setSuccess] = useState('')
  const [pagination, setPagination] = useState({ accounts: 1, ledger: 1, mappings: 1 })
  const [sorting, setSorting] = useState({ accounts: { by: 'code', asc: true }, ledger: { by: 'date', asc: false }, mappings: { by: 'type', asc: true } })
  const [showMappingTest, setShowMappingTest] = useState(false)
  const [testMapping, setTestMapping] = useState(null)
  const [accountEnquiryCode, setAccountEnquiryCode] = useState('')
  const [accountEnquiryData, setAccountEnquiryData] = useState(null)
  const [enquiryLoading, setEnquiryLoading] = useState(false)
  const [enquiryStatus, setEnquiryStatus] = useState({ type: '', message: '' })
  const [statementFilters, setStatementFilters] = useState({ startDate: '', endDate: '', referenceType: '', department: '', fixStatus: '' })
  const [showStatementAuditIds, setShowStatementAuditIds] = useState(false)
  const [statementAuditPreferenceReady, setStatementAuditPreferenceReady] = useState(false)
  const [metalRates, setMetalRates] = useState({ goldPrice: 285, silverPrice: 3.5, priceCurrency: 'USD', updatedAt: null })
  const [metalRateForm, setMetalRateForm] = useState({ goldPrice: '285', silverPrice: '3.5', priceCurrency: 'USD' })
  const [enquiryHistory, setEnquiryHistory] = useState([])
  const [metalUnit, setMetalUnit] = useState('gram')
  const [showEnquiryModal, setShowEnquiryModal] = useState(false)
  const [accountSummaryView, setAccountSummaryView] = useState('position')
  const [enquiryModalOffset, setEnquiryModalOffset] = useState({ x: 0, y: 0 })
  const [enquiryModalDrag, setEnquiryModalDrag] = useState({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
  const [detailsPanel, setDetailsPanel] = useState({
    pinned: false,
    floating: false,
    x: 120,
    y: 150,
    width: 500,
    height: 520,
  })
  const [detailsPanelDrag, setDetailsPanelDrag] = useState({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
  const [detailsPanelResize, setDetailsPanelResize] = useState({ active: false, pointerX: 0, pointerY: 0, startW: 500, startH: 520 })
  const detailsPanelRef = useRef(null)
  const statementAuditPreferenceKey = `${ENQUIRY_STATEMENT_AUDIT_TOGGLE_STORAGE_KEY}:${String(user?._id || user?.email || 'anonymous')}`
  const [excessCurrency, setExcessCurrency] = useState('USD')
  const [transactions, setTransactions] = useState([])
  const [vendors, setVendors] = useState([])
  const [inventoryProducts, setInventoryProducts] = useState([])
  const [stockMovements, setStockMovements] = useState([])
  const [stockMovementsLoading, setStockMovementsLoading] = useState(false)
  const [stockMovementsFilter, setStockMovementsFilter] = useState('')
  const [reports, setReports] = useState({
    trialBalance: null,
    profitLoss: null,
    balanceSheet: null,
    dayBook: null,
    customerOutstanding: null,
    vendorOutstanding: null,
    forex: null,
  })
  const [reportView, setReportView] = useState('summary')
  const [reportFilters, setReportFilters] = useState({
    period: 'month',
    startDate: '',
    endDate: '',
    accountType: '',
    includeZeroAccounts: true,
    sortBy: 'accountCode',
    sortDir: 'asc',
    comparePrevious: true,
    referenceType: '',
    minAmount: '',
    search: '',
  })
  const [selectedReportAccountId, setSelectedReportAccountId] = useState('')
  const [selectedReportAccountCode, setSelectedReportAccountCode] = useState('')
  const [ledgerReportRows, setLedgerReportRows] = useState([])
  const [voucherSource, setVoucherSource] = useState(null)
  const [voucherSourceLoading, setVoucherSourceLoading] = useState(false)
  const [selectedTransactionId, setSelectedTransactionId] = useState('')
  const [brandingProfiles, setBrandingProfiles] = useState(DEFAULT_BRANDING_PROFILES)
  const [selectedBrandingKey, setSelectedBrandingKey] = useState(DEFAULT_BRANDING.key)
  const [reportBranding, setReportBranding] = useState(DEFAULT_BRANDING)
  const [brandingForm, setBrandingForm] = useState(DEFAULT_BRANDING)
  const [brandingPreviewLogo, setBrandingPreviewLogo] = useState('')
  const [transactionForm, setTransactionForm] = useState(createTransactionForm)
  const [editingTransactionId, setEditingTransactionId] = useState('')
  const [transactionFilters, setTransactionFilters] = useState({ search: '', status: '', type: '', startDate: '', endDate: '' })
  const [transactionSummary, setTransactionSummary] = useState({ totalCount: 0, totalAmount: 0, draft: 0, submitted: 0, approved: 0, posted: 0, returned: 0, rejected: 0 })
  const [transactionMeta, setTransactionMeta] = useState({ page: 1, limit: 25, total: 0 })
  const [selectedTransactionIds, setSelectedTransactionIds] = useState([])
  const [transactionWorkflowNote, setTransactionWorkflowNote] = useState('')
  const [transactionCommentDraft, setTransactionCommentDraft] = useState('')
  const [transactionAttachmentInputKey, setTransactionAttachmentInputKey] = useState(0)
  const [vendorForm, setVendorForm] = useState({
    vendorCode: '',
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    gstVat: '',
    taxRegistrationNo: '',
    openingBalance: '',
    paymentTermsDays: '30',
    creditLimit: '',
    category: 'general',
    rating: '3',
    riskLevel: 'medium',
    status: 'active',
    notes: '',
    tags: '',
    preferredCurrency: 'USD',
    bankName: '',
    bankAccountNumber: '',
    iban: '',
    swiftCode: '',
    currency: 'USD',
  })
  const [vendorFilters, setVendorFilters] = useState({ search: '', status: '', approvalStatus: '', riskLevel: '', category: '', includeInactive: false })
  const [vendorSummary, setVendorSummary] = useState({ totalVendors: 0, totalOutstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })
  const [vendorPermissions, setVendorPermissions] = useState({ canManage: false, canUpdateOperational: false })
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [selectedVendorDetails, setSelectedVendorDetails] = useState(null)
  const [vendorWorkflowReason, setVendorWorkflowReason] = useState('')
  const [vendorDocumentForm, setVendorDocumentForm] = useState({ docType: 'contract', title: '', documentNo: '', fileUrl: '', issueDate: '', expiryDate: '', status: 'active', verified: false, notes: '' })
  const [vendorPaymentCalendar, setVendorPaymentCalendar] = useState({ rows: [], alerts: { overdue: 0, due_soon: 0, upcoming: 0, later: 0, totalDue: 0 } })
  const [vendorComplianceSummary, setVendorComplianceSummary] = useState({ summary: { total: 0, nonCompliant: 0, avgComplianceScore: 0 }, expiryBuckets: { expired: 0, warning30: 0, warning60: 0, warning90: 0 }, atRisk: [] })
  const [vendorOverdueQueue, setVendorOverdueQueue] = useState({ summary: { total: 0, withRecipient: 0, critical: 0, totalAmountDue: 0 }, queue: [] })
  const [showVendorForm, setShowVendorForm] = useState(false)
  const [editingVendorId, setEditingVendorId] = useState('')
  const [inventoryMappingForm, setInventoryMappingForm] = useState(createInventoryMappingForm)
  const [stockTypeModalTab, setStockTypeModalTab] = useState('details')
  const [editingProductId, setEditingProductId] = useState('')
  const [showInventoryMappingModal, setShowInventoryMappingModal] = useState(false)
  const [showInventoryProductModal, setShowInventoryProductModal] = useState(false)
  const [inventoryProductForm, setInventoryProductForm] = useState(createInventoryProductForm)
  const [editingInventoryProductId, setEditingInventoryProductId] = useState('')
  const [inventoryVatFilter, setInventoryVatFilter] = useState('all')
  const [inventoryVatSortDir, setInventoryVatSortDir] = useState('none')
  const [inventoryStockCodeManualOverride, setInventoryStockCodeManualOverride] = useState(false)
  const [inventoryModalOffset, setInventoryModalOffset] = useState({ x: 0, y: 0 })
  const [inventoryModalDragging, setInventoryModalDragging] = useState(false)
  const inventoryModalDragRef = useRef({ moveHandler: null, upHandler: null })
  const [inventoryProductModalOffset, setInventoryProductModalOffset] = useState({ x: 0, y: 0 })
  const [inventoryProductModalDragging, setInventoryProductModalDragging] = useState(false)
  const inventoryProductModalDragRef = useRef({ moveHandler: null, upHandler: null })
  const [inventoryStockCodeSettings, setInventoryStockCodeSettings] = useState(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS)
  const inventoryStockCodeSettingsKey = `${INVENTORY_STOCK_CODE_SETTINGS_STORAGE_KEY}:${String(user?._id || user?.email || 'anonymous')}`

  const ITEMS_PER_PAGE = 25
  const showNotification = (msg) => {
    setSuccess(msg)
    setTimeout(() => setSuccess(''), 3000)
  }

  // Check if user is logged in
  if (!token) {
    return (
      <div style={{ padding: '2rem', background: '#FEE2E2', border: '1px solid #FCA5A5', borderRadius: '0.5rem', color: '#DC2626', textAlign: 'center' }}>
        <p style={{ fontSize: '1rem', fontWeight: '500' }}>🔒 Please log in to access this module.</p>
      </div>
    )
  }

  // Role-based permissions
  const isSuperAdmin = user?.role === 'super_admin'
  const isDepartmentHead = user?.role === 'department_head'
  const isManagementRole = user?.role === 'management'
  const dept = (user?.department || '').toLowerCase()
  const isFinance = isSuperAdmin || (isDepartmentHead && dept === 'finance')
  const isSalesRole = isSuperAdmin || isManagementRole || (isDepartmentHead && dept === 'sales')
  const isOperationsRole = isSuperAdmin || (isDepartmentHead && ['operations', 'production'].includes(dept))
  const isHRRole = isSuperAdmin || (isDepartmentHead && dept === 'hr')
  const canViewAccounts = isSuperAdmin || isFinance
  const canManageAccounts = isSuperAdmin || isFinance
  const canViewLedger = isSuperAdmin || isFinance
  const canViewCustomers = isSuperAdmin || isFinance || isSalesRole || user?.role === 'management'
  const canManageCustomers = isSuperAdmin || isFinance || isSalesRole
  const canViewBalanceEnquiry = isSuperAdmin || isFinance || isDepartmentHead
  const canUpdateMetalRates = isDepartmentHead && dept === 'finance'
  const canExportAccountSummary = isSuperAdmin
  const canAccessTransactions = isSuperAdmin || isFinance || isSalesRole || isOperationsRole || isHRRole
  const canAccessReports = isSuperAdmin || isFinance
  const canAccessVendors = isSuperAdmin || isFinance || isOperationsRole
  const canManageVendors = isSuperAdmin || isFinance
  const canUpdateVendorOperational = canAccessVendors
  const canAccessInventory = isSuperAdmin || isFinance || isOperationsRole
  const canAccessVouchers = isSuperAdmin || isFinance || isSalesRole || isManagementRole
  const canAccessDirectDeals = isSuperAdmin || isFinance || isSalesRole || isManagementRole
  const canAccessERP = canViewAccounts || canAccessTransactions || canAccessInventory || canViewCustomers
  const selectedUsdConversionCurrency = currencies.find((currency) => currency.code === usdConversion.targetCode) || null
  const selectedUsdConversionRate = Number(selectedUsdConversionCurrency?.exchangeRate || 0)
  const usdAmountValue = Number(usdConversion.usdAmount || 0)
  const usdToTargetAmount = Number.isFinite(usdAmountValue) && usdAmountValue >= 0 && selectedUsdConversionRate > 0
    ? (usdAmountValue / selectedUsdConversionRate)
    : 0
  const inventoryMappingProducts = inventoryProducts.filter((item) => String(item?.category || '').includes('mainStock=') && !String(item?.category || '').includes('recordType=product'))
  const inventoryCatalogProducts = inventoryProducts.filter((item) => String(item?.category || '').includes('recordType=product'))
  const legacyInventoryProducts = inventoryProducts.filter((item) => !String(item?.category || '').includes('mainStock=') && !String(item?.category || '').includes('recordType=product'))
  const inventoryReportProducts = [...inventoryCatalogProducts, ...legacyInventoryProducts]
  const inventoryReportRows = inventoryReportProducts.map((item) => {
    const categoryMeta = decodeInventoryCategoryMeta(item.category)
    const productMeta = decodeInventoryCategoryPairs(item.category)
    const quantity = Math.max(0, Number(item.quantity || 0))
    const unitCost = Number(item.unitCost || 0)
    const stockValue = quantity * unitCost
    const minThreshold = Number(item.minThreshold || 0)
    const metal = titleCaseWords(productMeta.mainStock || productMeta.metalType || categoryMeta.mainStock || categoryMeta.metalType || 'Unmapped')
    const categoryName = productMeta.productCategory || titleCaseWords(productMeta.mainStock || productMeta.metalType || categoryMeta.mainStock || categoryMeta.metalType || item.name)
    const weight = Number(productMeta.grossWeight || productMeta.weight || item.weight || 0)
    const purity = productMeta.productPurity || productMeta.purity || categoryMeta.purity || ''
    const purityWeight = Number(productMeta.purityWeight || 0)
    return {
      item,
      categoryMeta,
      productMeta,
      quantity,
      unitCost,
      stockValue,
      minThreshold,
      metal,
      categoryName,
      weight,
      purity,
      purityWeight,
      stockUnit: item.unit || 'units',
      isLowStock: minThreshold > 0 && quantity <= minThreshold,
    }
  })
  const inventoryTotalQuantity = inventoryReportRows.reduce((sum, row) => sum + row.quantity, 0)
  const inventoryTotalValue = inventoryReportRows.reduce((sum, row) => sum + row.stockValue, 0)
  const inventoryLowStockCount = inventoryReportRows.filter((row) => row.isLowStock).length
  const inventoryTopProducts = [...inventoryReportRows]
    .sort((a, b) => b.stockValue - a.stockValue)
    .slice(0, 5)
  const inventoryMetalBreakdown = Object.values(inventoryReportRows.reduce((groups, row) => {
    const key = row.metal || 'Unmapped'
    if (!groups[key]) {
      groups[key] = {
        metal: key,
        productCount: 0,
        totalQty: 0,
        totalValue: 0,
        lowStockCount: 0,
      }
    }
    groups[key].productCount += 1
    groups[key].totalQty += row.quantity
    groups[key].totalValue += row.stockValue
    groups[key].lowStockCount += row.isLowStock ? 1 : 0
    return groups
  }, {})).sort((a, b) => b.totalValue - a.totalValue)
  const inventoryStockTypeOptions = inventoryMappingProducts.map((item) => {
    const meta = decodeInventoryCategoryMeta(item.category)
    return {
      id: item._id,
      label: titleCaseWords(meta.mainStock || meta.metalType || item.name),
      category: item.category,
      mainStock: titleCaseWords(meta.mainStock || meta.metalType || item.name),
      purity: meta.purity || '',
    }
  })
  const fixingRegisterStockTypeOptions = useMemo(() => {
    const normalizeToMetalCode = (rawValue) => {
      const normalized = String(rawValue || '').trim().toLowerCase()
      if (!normalized) return ''
      if (normalized === 'xau' || normalized === 'gold') return 'XAU'
      if (normalized === 'xag' || normalized === 'silver') return 'XAG'
      if (normalized === 'xpt' || normalized === 'platinum') return 'XPT'
      if (normalized === 'xpd' || normalized === 'palladium') return 'XPD'
      return String(rawValue || '').trim().toUpperCase()
    }

    const stockTypeOptions = inventoryMappingProducts.map((item) => {
      const meta = decodeInventoryCategoryMeta(item.category)
      const source = meta.metalType || meta.mainStock || item.name
      const metalCode = normalizeToMetalCode(source)
      const labelName = titleCaseWords(meta.mainStock || meta.metalType || item.name || item.sku || 'Stock Type')
      const puritySuffix = meta.purity ? ` (${meta.purity})` : ''
      return {
        id: item._id,
        value: `${metalCode}::${item._id}`,
        metalCode,
        label: `${labelName}${puritySuffix}`,
      }
    }).filter((option) => Boolean(option.metalCode))

    if (stockTypeOptions.length) {
      return [
        { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
        ...stockTypeOptions,
      ]
    }

    // Legacy fallback for older datasets where stock types were not encoded in mapping records.
    const legacyProductOptions = inventoryCatalogProducts.map((item) => {
      const meta = decodeInventoryCategoryPairs(item.category)
      const source = meta.metalType || meta.mainStock || item.name
      const metalCode = normalizeToMetalCode(source)
      const productLabel = titleCaseWords(meta.productCategory || item.name || item.sku || 'Product')
      const puritySuffix = meta.productPurity ? ` (${meta.productPurity})` : ''
      return {
        id: item._id,
        value: `${metalCode}::${item._id}`,
        metalCode,
        label: `${productLabel}${puritySuffix}`,
      }
    }).filter((option) => Boolean(option.metalCode))

    if (legacyProductOptions.length) {
      return [
        { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
        ...legacyProductOptions,
      ]
    }

    // Final fallback: allow fixing register to work even when no inventory stock type/product records exist.
    return [
      { id: 'all-metals', value: 'ALL::all', metalCode: 'ALL', label: 'All Metals' },
      { id: 'metal-gold', value: 'XAU::fallback-gold', metalCode: 'XAU', label: 'Gold (XAU)' },
      { id: 'metal-silver', value: 'XAG::fallback-silver', metalCode: 'XAG', label: 'Silver (XAG)' },
      { id: 'metal-platinum', value: 'XPT::fallback-platinum', metalCode: 'XPT', label: 'Platinum (XPT)' },
      { id: 'metal-palladium', value: 'XPD::fallback-palladium', metalCode: 'XPD', label: 'Palladium (XPD)' },
      { id: 'metal-other', value: 'OTHER::fallback-other', metalCode: 'OTHER', label: 'Other Metals' },
    ]
  }, [inventoryCatalogProducts, inventoryMappingProducts])
  const selectedInventoryStockType = inventoryStockTypeOptions.find((item) => item.id === inventoryProductForm.stockTypeId) || null
  const inventoryPurityFactorRaw = Number(inventoryProductForm.purity || 0)
  const inventoryPurityFactor = inventoryPurityFactorRaw > 1 ? inventoryPurityFactorRaw / 1000 : inventoryPurityFactorRaw
  const inventoryProductPurityWeight = (Number(inventoryProductForm.weight || 0) || 0) * (Number.isFinite(inventoryPurityFactor) ? inventoryPurityFactor : 0)
  const inventoryProductsByMetal = inventoryReportRows.reduce((groups, row) => {
    const metalKey = row.metal || 'Unmapped'
    if (!groups[metalKey]) groups[metalKey] = []
    groups[metalKey].push({ item: row.item, meta: row.productMeta, row })
    return groups
  }, {})
  const inventoryTableRows = inventoryReportRows.map((row) => {
    const { item, categoryMeta, productMeta } = row
    const rawVatPercent = Number(productMeta.vatPercent)
    const vatPercent = Number.isFinite(rawVatPercent) ? Number(rawVatPercent.toFixed(2)) : null
    return { item, categoryMeta, productMeta, vatPercent, reportRow: row }
  })
  const filteredInventoryTableRows = inventoryTableRows.filter((row) => {
    if (inventoryVatFilter === 'with-vat') return (row.vatPercent ?? 0) > 0
    if (inventoryVatFilter === 'zero-or-blank') return row.vatPercent === null || row.vatPercent === 0
    return true
  })
  const sortedInventoryTableRows = [...filteredInventoryTableRows].sort((a, b) => {
    if (inventoryVatSortDir === 'none') return 0
    const aVat = a.vatPercent ?? -1
    const bVat = b.vatPercent ?? -1
    if (inventoryVatSortDir === 'asc') return aVat - bVat
    return bVat - aVat
  })
  const availableTransactionTypes = isSuperAdmin || isFinance
    ? ['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll']
    : [
        ...(isSalesRole ? ['sale', 'receipt'] : []),
        ...(isOperationsRole ? ['expense', 'purchase'] : []),
        ...(isHRRole ? ['payroll'] : []),
      ]
  const selectedTransaction = transactions.find((tx) => tx._id === selectedTransactionId) || null
  const rawStatementEntries = accountEnquiryData?.statement?.entries || []
  
  // Trading platform calculations (metal price driven)
  const xauBalance = accountEnquiryData ? Number(accountEnquiryData.metals?.goldBalance || 0) : 0
  const xagBalance = accountEnquiryData ? Number(accountEnquiryData.metals?.silverBalance || 0) : 0
  const goldPriceUSD = accountEnquiryData ? Number(accountEnquiryData.metals?.goldPrice || 0) : 0
  const silverPriceUSD = accountEnquiryData ? Number(accountEnquiryData.metals?.silverPrice || 0) : 0
  const totalFunds = accountEnquiryData ? Number(accountEnquiryData.balances?.absoluteNetBalance || 0) : 0
  
  // Derived calculations
  const xauCurrentValue = xauBalance * goldPriceUSD
  const modalRevaluation = xauCurrentValue  // P&L mirrors position
  const modalTotalFunds = totalFunds
  const modalNetEquity = modalTotalFunds + modalRevaluation
  const modalMarginAmt = -(Math.abs(xauBalance) * goldPriceUSD * 0.02)  // 2% margin on position
  const modalExcess = modalNetEquity - Math.abs(modalMarginAmt)
  const modalMarginPct = Math.abs(modalMarginAmt) !== 0 ? (modalNetEquity / Math.abs(modalMarginAmt)) * 100 : 0
  const breakEvenPrice = Math.abs(xauBalance) !== 0 ? totalFunds / Math.abs(xauBalance) : 0
  const modalStatementCurrency = 'USD'  // Trading platform uses USD
  const formatStatementValue = (value, digits = 2) => {
    const num = Number(value || 0)
    return num.toLocaleString(undefined, {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    })
  }
  const formatStatementNullableValue = (value, digits = 2) => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) return '-'
    return formatStatementValue(value, digits)
  }

  const getSignedColor = (value) => {
    const num = Number(value || 0)
    return num >= 0 ? '#111827' : '#c0392b'  // Red for negative
  }
  const modalPositionRows = accountEnquiryData ? [
    {
      key: 'xau',
      type: 'XAU',
      limits: 0,
      balance: xauBalance,
      price: goldPriceUSD,
      currentValue: xauCurrentValue,
      breakEven: breakEvenPrice,
    },
    {
      key: 'xag',
      type: 'XAG',
      limits: 0,
      balance: xagBalance,
      price: silverPriceUSD,
      currentValue: xagBalance * silverPriceUSD,
      breakEven: Math.abs(xagBalance) !== 0 ? totalFunds / Math.abs(xagBalance) : 0,
    },
  ] : []
  const modalFundsRows = [
    { currency: 'USD', limits: 0, value: modalTotalFunds },
  ]
  const statementReferenceTypes = Array.from(new Set(rawStatementEntries.map((entry) => String(entry.referenceType || '').trim()).filter(Boolean))).sort()
  const statementDepartments = Array.from(new Set(rawStatementEntries.map((entry) => String(entry.department || '').trim()).filter(Boolean))).sort()
  const resolveFixStatus = (entry) => {
    const explicit = String(entry?.metalFixStatus || '').trim().toLowerCase()
    if (explicit === 'fixed' || explicit === 'unfixed') return explicit
    const text = `${String(entry?.description || '')} ${String(entry?.referenceType || '')}`.toLowerCase()
    if (/non[\s-_]?fix|unfix|unfixed/.test(text)) return 'unfixed'
    if (/fixing|fixed|price[\s-_]?fix/.test(text)) return 'fixed'
    return 'unknown'
  }
  const filteredStatementEntries = rawStatementEntries.filter((entry) => {
    const entryDate = entry.date ? new Date(entry.date) : null
    if (statementFilters.startDate) {
      const start = new Date(statementFilters.startDate)
      if (!entryDate || entryDate < start) return false
    }
    if (statementFilters.endDate) {
      const end = new Date(statementFilters.endDate)
      end.setHours(23, 59, 59, 999)
      if (!entryDate || entryDate > end) return false
    }
    if (statementFilters.referenceType && String(entry.referenceType || '') !== statementFilters.referenceType) return false
    if (statementFilters.department && String(entry.department || '') !== statementFilters.department) return false
    if (statementFilters.fixStatus) {
      const fixStatus = resolveFixStatus(entry)
      if (statementFilters.fixStatus === 'fixed' && fixStatus !== 'fixed') return false
      if (statementFilters.fixStatus === 'unfixed' && fixStatus !== 'unfixed') return false
      if (statementFilters.fixStatus === 'unknown' && fixStatus !== 'unknown') return false
    }
    return true
  })
  const resolveDealSide = (entry) => {
    const explicit = String(entry?.metalDealType || entry?.sourceTransactionType || '').toLowerCase().trim()
    if (explicit === 'sale' || explicit === 'purchase') return explicit
    const referenceType = String(entry?.referenceType || '').toLowerCase().trim()
    if (referenceType === 'sale' || referenceType === 'purchase') return referenceType
    return ''
  }
  const resolveMetalCode = (entry) => {
    const explicit = String(entry?.metalCode || '').trim().toUpperCase()
    if (explicit) return explicit
    const text = `${String(entry?.description || '')} ${String(entry?.offsetAccountName || '')} ${String(entry?.offsetAccountCode || '')}`.toLowerCase()
    if (/\bxau\b|\bgold\b/.test(text)) return 'XAU'
    if (/\bxag\b|\bsilver\b/.test(text)) return 'XAG'
    return '-'
  }
  const metalFixingEntries = filteredStatementEntries
    .map((entry) => {
      const dealSide = resolveDealSide(entry)
      if (!dealSide) return null
      const isExplicitMetalTrade = Boolean(entry?.isMetalTrade)
      const hasLegacyMetalHint = String(entry?.metalCode || '').trim() !== '' || /\bxau\b|\bxag\b|gold|silver/i.test(String(entry?.description || ''))
      if (!isExplicitMetalTrade && !hasLegacyMetalHint) return null
      const amount = Math.abs(Number(entry?.signedAmount ?? entry?.debitAmount ?? entry?.creditAmount ?? 0))
      return {
        ...entry,
        dealSide,
        fixStatus: resolveFixStatus(entry),
        metalCode: resolveMetalCode(entry),
        amount,
      }
    })
    .filter(Boolean)
  const fixedMetalEntries = metalFixingEntries.filter((entry) => entry.fixStatus === 'fixed')
  const unfixedMetalEntries = metalFixingEntries.filter((entry) => entry.fixStatus === 'unfixed')
  const unknownFixMetalEntries = metalFixingEntries.filter((entry) => entry.fixStatus === 'unknown')
  const summarizeMetalDealRows = (rows) => rows.reduce((acc, row) => {
    if (row.dealSide === 'sale') {
      acc.saleCount += 1
      acc.saleAmount += row.amount
    }
    if (row.dealSide === 'purchase') {
      acc.purchaseCount += 1
      acc.purchaseAmount += row.amount
    }
    return acc
  }, {
    saleCount: 0,
    purchaseCount: 0,
    saleAmount: 0,
    purchaseAmount: 0,
  })
  const fixedMetalSummary = summarizeMetalDealRows(fixedMetalEntries)
  const unfixedMetalSummary = summarizeMetalDealRows(unfixedMetalEntries)
  const formatStatementDate = (value) => {
    if (!value) return '-'
    const dt = new Date(value)
    if (Number.isNaN(dt.getTime())) return '-'
    return dt.toLocaleDateString()
  }
  const recentPaymentReceiptEntry = [...rawStatementEntries]
    .filter((entry) => {
      const type = String(entry.referenceType || '').toLowerCase()
      return type === 'payment' || type === 'receipt'
    })
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))[0] || null
  const transactionPageCount = Math.max(1, Math.ceil(Number(transactionMeta.total || 0) / Number(transactionMeta.limit || 25)))
  const isTransactionEditMode = Boolean(editingTransactionId)
  const allVisibleTransactionsSelected = Boolean(transactions.length) && transactions.every((tx) => selectedTransactionIds.includes(tx._id))

  const emptyCardStyle = {
    background: '#F9FAFB',
    border: '1px dashed #D1D5DB',
    borderRadius: '0.5rem',
    padding: '1rem',
    color: C.inkSoft,
    fontSize: '0.875rem',
  }

  const modalBackdropStyle = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(17, 24, 39, 0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
    padding: '1rem',
  }

  const modalCardStyle = {
    width: 'min(540px, 100%)',
    background: '#FFFFFF',
    borderRadius: '0.75rem',
    boxShadow: '0 18px 50px rgba(15, 23, 42, 0.2)',
    padding: '1.25rem',
  }

  const modalInputStyle = {
    display: 'block',
    width: '100%',
    padding: '0.65rem 0.75rem',
    marginBottom: '0.75rem',
    background: '#F9FAFB',
    border: '1px solid #D1D5DB',
    color: C.ink,
    borderRadius: '0.5rem',
  }

  const detailsPanelIsFloating = detailsPanel.floating || detailsPanel.pinned

  const getCurrentDetailsPanelGeometry = () => {
    const rect = detailsPanelRef.current?.getBoundingClientRect()
    if (!rect) {
      return {
        x: detailsPanel.x,
        y: detailsPanel.y,
        width: detailsPanel.width,
        height: detailsPanel.height,
      }
    }

    return {
      x: rect.left,
      y: rect.top,
      width: rect.width,
      height: rect.height,
    }
  }

  const beginDetailsPanelDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const geometry = getCurrentDetailsPanelGeometry()
    setDetailsPanel((prev) => ({
      ...prev,
      floating: true,
      x: geometry.x,
      y: geometry.y,
      width: geometry.width,
      height: geometry.height,
    }))
    setDetailsPanelDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: geometry.x,
      startY: geometry.y,
    })
  }

  const beginDetailsPanelResize = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    event.stopPropagation()
    setDetailsPanelResize({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startW: detailsPanel.width,
      startH: detailsPanel.height,
    })
  }

  const handleCloseDetailsPanel = () => {
    setDetailsPanel((prev) => ({
      ...prev,
      pinned: false,
      floating: false,
      x: 120,
      y: 150,
      width: 500,
      height: 520,
    }))
  }

  const enquiryBackdropColor = enquiryModalDrag.active ? 'rgba(15, 23, 42, 0.12)' : 'rgba(15, 23, 42, 0.45)'

  const beginEnquiryModalDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setEnquiryModalDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: enquiryModalOffset.x,
      startY: enquiryModalOffset.y,
    })
  }

  const beginFixingRegPanelDrag = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    setFixingRegPanelDrag({
      active: true,
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: fixingRegPanelOffset.x,
      startY: fixingRegPanelOffset.y,
    })
  }

  useEffect(() => {
    if (!showEnquiryModal) {
      setEnquiryModalOffset((prev) => (prev.x === 0 && prev.y === 0 ? prev : { x: 0, y: 0 }))
      setEnquiryModalDrag((prev) => {
        if (!prev.active && prev.pointerX === 0 && prev.pointerY === 0 && prev.startX === 0 && prev.startY === 0) return prev
        return { active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 }
      })
      return undefined
    }

    if (!enquiryModalDrag.active) return undefined

    const handlePointerMove = (event) => {
      setEnquiryModalOffset({
        x: enquiryModalDrag.startX + (event.clientX - enquiryModalDrag.pointerX),
        y: enquiryModalDrag.startY + (event.clientY - enquiryModalDrag.pointerY),
      })
    }

    const handlePointerUp = () => {
      setEnquiryModalDrag((prev) => ({ ...prev, active: false }))
    }

    window.addEventListener('mousemove', handlePointerMove)
    window.addEventListener('mouseup', handlePointerUp)

    return () => {
      window.removeEventListener('mousemove', handlePointerMove)
      window.removeEventListener('mouseup', handlePointerUp)
    }
  }, [showEnquiryModal, enquiryModalDrag])

  useEffect(() => {
    if (activeTab !== 'fixing-register') {
      setFixingRegPanelOffset({ x: 0, y: 0 })
      setFixingRegPanelDrag({ active: false, pointerX: 0, pointerY: 0, startX: 0, startY: 0 })
      return undefined
    }

    if (!fixingRegPanelDrag.active) return undefined

    const onMouseMove = (event) => {
      setFixingRegPanelOffset({
        x: fixingRegPanelDrag.startX + (event.clientX - fixingRegPanelDrag.pointerX),
        y: fixingRegPanelDrag.startY + (event.clientY - fixingRegPanelDrag.pointerY),
      })
    }

    const onMouseUp = () => {
      setFixingRegPanelDrag((prev) => ({ ...prev, active: false }))
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [activeTab, fixingRegPanelDrag])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(ENQUIRY_DETAILS_PANEL_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== 'object') return
      setDetailsPanel((prev) => ({
        ...prev,
        pinned: Boolean(parsed.pinned),
        floating: Boolean(parsed.floating),
        x: Number.isFinite(parsed.x) ? parsed.x : prev.x,
        y: Number.isFinite(parsed.y) ? parsed.y : prev.y,
        width: Number.isFinite(parsed.width) ? parsed.width : prev.width,
        height: Number.isFinite(parsed.height) ? parsed.height : prev.height,
      }))
    } catch {
      // ignore malformed local settings
    }
  }, [])

  useEffect(() => {
    if (!detailsPanelDrag.active && !detailsPanelResize.active) return undefined

    const onMouseMove = (event) => {
      if (detailsPanelDrag.active) {
        setDetailsPanel((prev) => ({
          ...prev,
          x: detailsPanelDrag.startX + (event.clientX - detailsPanelDrag.pointerX),
          y: detailsPanelDrag.startY + (event.clientY - detailsPanelDrag.pointerY),
        }))
      }

      if (detailsPanelResize.active) {
        const nextWidth = Math.max(380, detailsPanelResize.startW + (event.clientX - detailsPanelResize.pointerX))
        const nextHeight = Math.max(360, detailsPanelResize.startH + (event.clientY - detailsPanelResize.pointerY))
        setDetailsPanel((prev) => ({ ...prev, width: nextWidth, height: nextHeight }))
      }
    }

    const onMouseUp = () => {
      setDetailsPanelDrag((prev) => ({ ...prev, active: false }))
      setDetailsPanelResize((prev) => ({ ...prev, active: false }))
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [detailsPanelDrag, detailsPanelResize])

  useEffect(() => {
    localStorage.setItem(ENQUIRY_DETAILS_PANEL_STORAGE_KEY, JSON.stringify(detailsPanel))
  }, [detailsPanel])

  useEffect(() => {
    setStatementAuditPreferenceReady(false)
    try {
      const raw = localStorage.getItem(statementAuditPreferenceKey)
      setShowStatementAuditIds(raw === '1')
    } catch {
      setShowStatementAuditIds(false)
    } finally {
      setStatementAuditPreferenceReady(true)
    }
  }, [statementAuditPreferenceKey])

  useEffect(() => {
    if (!statementAuditPreferenceReady) return
    try {
      localStorage.setItem(statementAuditPreferenceKey, showStatementAuditIds ? '1' : '0')
    } catch {
      // ignore local preference save errors
    }
  }, [statementAuditPreferenceReady, statementAuditPreferenceKey, showStatementAuditIds])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(inventoryStockCodeSettingsKey)
      if (!raw) {
        setInventoryStockCodeSettings(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS)
        return
      }
      const parsed = JSON.parse(raw)
      const format = parsed?.format === 'prefix-metal-purity' ? 'prefix-metal-purity' : 'metal-purity'
      const prefix = String(parsed?.prefix || DEFAULT_INVENTORY_STOCK_CODE_SETTINGS.prefix)
      setInventoryStockCodeSettings({ format, prefix })
    } catch {
      setInventoryStockCodeSettings(DEFAULT_INVENTORY_STOCK_CODE_SETTINGS)
    }
  }, [inventoryStockCodeSettingsKey])

  useEffect(() => {
    try {
      localStorage.setItem(inventoryStockCodeSettingsKey, JSON.stringify(inventoryStockCodeSettings))
    } catch {
      // ignore local preference save errors
    }
  }, [inventoryStockCodeSettingsKey, inventoryStockCodeSettings])

  const loadDashboard = async () => {
    if (!canViewAccounts) return
    setLoading(true)
    try {
      const [data, chatData] = await Promise.all([
        erpAccountingAPI.getDashboardReport(token, { startDate: dashDateFrom, endDate: dashDateTo }),
        messagesAPI.getLatestMessages(token, 'group', 10).catch(() => ({ messages: [] })),
      ])
      setDashboard(data)
      setDashChatMessages(chatData?.messages || chatData || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load dashboard')
    }
    setLoading(false)
  }

  const loadAccounts = async (params = {}) => {
    const isSummaryScope = params.scope === 'summary'
    if (!canViewAccounts && !(isSummaryScope && canViewBalanceEnquiry)) return
    setLoading(true)
    try {
      if (isSummaryScope) {
        const pageSize = 200
        let page = 1
        let total = 0
        let merged = []

        do {
          const data = await erpAccountingAPI.getAccounts(token, { ...params, page, limit: pageSize })
          const rows = data.accounts || []
          total = Number(data.total || 0)
          merged = merged.concat(rows)
          page += 1
          if (!rows.length) break
        } while (merged.length < total)

        const uniqueById = new Map()
        merged.forEach((item) => {
          if (item?._id) uniqueById.set(item._id, item)
        })
        setSummaryAccounts(Array.from(uniqueById.values()))
      } else {
        const data = await erpAccountingAPI.getAccounts(token, params)
        setAccounts(data.accounts || [])
      }
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || `Failed to load ${isSummaryScope ? 'account summary options' : 'accounts'}`)
    }
    setLoading(false)
  }

  const formatSummaryAccountLabel = (account) => {
    const code = String(account?.accountCode || '').trim()
    const name = String(account?.accountName || '').trim()
    const type = String(account?.accountType || '').trim()
    return [code, name, type].filter(Boolean).join(' - ')
  }

  const groupedSummaryAccounts = summaryAccounts
    .slice()
    .sort((a, b) => {
      const aType = String(a.accountType || '').trim()
      const bType = String(b.accountType || '').trim()
      const aTypeIndex = ACCOUNT_TYPE_ORDER.indexOf(aType)
      const bTypeIndex = ACCOUNT_TYPE_ORDER.indexOf(bType)
      const normalizedATypeIndex = aTypeIndex === -1 ? ACCOUNT_TYPE_ORDER.length : aTypeIndex
      const normalizedBTypeIndex = bTypeIndex === -1 ? ACCOUNT_TYPE_ORDER.length : bTypeIndex
      const typeCompare = normalizedATypeIndex - normalizedBTypeIndex
      if (typeCompare !== 0) return typeCompare
      return String(a.accountCode || '').localeCompare(String(b.accountCode || ''))
    })
    .reduce((groups, account) => {
      const type = String(account.accountType || 'Other').trim() || 'Other'
      const existingGroup = groups.find((group) => group.type === type)
      if (existingGroup) existingGroup.accounts.push(account)
      else groups.push({ type, accounts: [account] })
      return groups
    }, [])

  const entryAccountOptions = summaryAccounts.length ? summaryAccounts : accounts

  const filteredGroupedSummaryAccounts = groupedSummaryAccounts
    .map((group) => {
      const lookup = String(accountEnquiryCode || '').trim().toLowerCase()
      if (!lookup) return group
      const filteredAccounts = group.accounts.filter((account) => (
        [account.accountCode, account.accountName, account.accountType]
          .some((value) => String(value || '').toLowerCase().includes(lookup))
      ))
      return { ...group, accounts: filteredAccounts }
    })
    .filter((group) => group.accounts.length > 0)

  const loadLedger = async () => {
    if (!canViewLedger) return
    setLoading(true)
    try {
      const [ledgerData, accountData, currencyData, mappingData] = await Promise.all([
        erpAccountingAPI.getLedger(token, { limit: 100, ...ledgerFilters }),
        erpAccountingAPI.getAccounts(token),
        erpAccountingAPI.getCurrencies(token),
        erpAccountingAPI.getMappings(token),
      ])
      setLedger(ledgerData.entries || [])
      setAccounts(accountData.accounts || [])
      setCurrencies(currencyData.currencies || [])
      setMappings(mappingData.mappings || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load ledger')
    }
    setLoading(false)
  }

  const loadCustomers = async (params) => {
    if (!canViewCustomers) return
    setLoading(true)
    try {
      const data = await erpAccountingAPI.getCustomers(token, params)
      setCustomers(data.customers || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load customers')
    }
    setLoading(false)
  }

  const loadMappings = async (params = mappingFilters) => {
    if (!canViewAccounts) return
    setLoading(true)
    try {
      const [mappingData, accountData] = await Promise.all([
        erpAccountingAPI.getMappings(token, params),
        erpAccountingAPI.getAccounts(token),
      ])
      setMappings(mappingData.mappings || [])
      setMappingSummary(mappingData.summary || { total: 0, shared: 0, byDepartment: {} })
      setAccounts(accountData.accounts || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load mappings')
    }
    setLoading(false)
  }

  const loadCurrencies = async () => {
    setLoading(true)
    try {
      const data = await erpAccountingAPI.getCurrencies(token)
      setCurrencies(data.currencies || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load currencies')
    }
    setLoading(false)
  }

  const loadReportBranding = async (brandingKey = selectedBrandingKey || DEFAULT_BRANDING.key) => {
    try {
      const data = await erpAccountingAPI.getReportBranding(token, { key: brandingKey })
      const branding = { ...DEFAULT_BRANDING, ...(data.branding || {}) }
      setBrandingProfiles(data.profiles?.length ? data.profiles : DEFAULT_BRANDING_PROFILES)
      setSelectedBrandingKey(data.selectedKey || branding.key || DEFAULT_BRANDING.key)
      setReportBranding(branding)
      setBrandingForm(branding)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load report branding')
    }
  }

  const loadMetalRates = async () => {
    try {
      const data = await erpAccountingAPI.getMetalRates(token)
      const rates = data.rates || { goldPrice: 285, silverPrice: 3.5, priceCurrency: 'USD', updatedAt: null }
      setMetalRates(rates)
      setMetalRateForm({
        goldPrice: String(rates.goldPrice ?? 285),
        silverPrice: String(rates.silverPrice ?? 3.5),
        priceCurrency: rates.priceCurrency || 'USD',
      })
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load metal rates')
    }
  }

  const loadAllVendors = async (baseFilters = {}) => {
    const pageSize = 100
    let page = 1
    let total = Number.POSITIVE_INFINITY
    let merged = []
    let permissions = { canManage: false, canUpdateOperational: false }

    while (merged.length < total) {
      const data = await erpAccountingAPI.getVendors(token, { ...baseFilters, page, limit: pageSize })
      const rows = data.vendors || []
      merged = merged.concat(rows)
      total = Number(data.total || merged.length)
      permissions = data.permissions || permissions
      if (!rows.length) break
      page += 1
    }

    const uniqueById = new Map()
    merged.forEach((item) => {
      if (item?._id) uniqueById.set(item._id, item)
    })
    const vendors = Array.from(uniqueById.values())

    const summaryTotals = vendors.reduce((acc, row) => {
      acc.count += 1
      acc.outstanding += Number(row.outstanding || 0)
      acc.overLimit += row.isOverLimit ? 1 : 0
      acc.blacklisted += row.status === 'blacklisted' ? 1 : 0
      acc.onHold += row.status === 'on_hold' ? 1 : 0
      acc.nonCompliant += row.compliance?.compliant ? 0 : 1
      return acc
    }, { count: 0, outstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })

    return {
      vendors,
      permissions,
      summary: {
        totalVendors: summaryTotals.count,
        totalOutstanding: Number(summaryTotals.outstanding.toFixed(2)),
        overLimit: summaryTotals.overLimit,
        blacklisted: summaryTotals.blacklisted,
        onHold: summaryTotals.onHold,
        nonCompliant: summaryTotals.nonCompliant,
      },
    }
  }

  const loadTransactions = async (overrides = {}) => {
    if (!canAccessTransactions) return
    setLoading(true)
    try {
      const params = {
        page: overrides.page || transactionMeta.page,
        limit: overrides.limit || transactionMeta.limit,
        ...((overrides.search ?? transactionFilters.search) ? { search: overrides.search ?? transactionFilters.search } : {}),
        ...((overrides.status ?? transactionFilters.status) ? { status: overrides.status ?? transactionFilters.status } : {}),
        ...((overrides.type ?? transactionFilters.type) ? { type: overrides.type ?? transactionFilters.type } : {}),
        ...((overrides.startDate ?? transactionFilters.startDate) ? { startDate: overrides.startDate ?? transactionFilters.startDate } : {}),
        ...((overrides.endDate ?? transactionFilters.endDate) ? { endDate: overrides.endDate ?? transactionFilters.endDate } : {}),
      }
      const [data, customerData, vendorData, inventoryData, mappingData, accountData, currencyData] = await Promise.all([
        erpAccountingAPI.getTransactions(token, params),
        canViewCustomers ? erpAccountingAPI.getCustomers(token) : Promise.resolve(null),
        canAccessVendors ? loadAllVendors({ includeInactive: true }) : Promise.resolve(null),
        canAccessInventory ? erpAccountingAPI.getInventoryProducts(token) : Promise.resolve(null),
        canViewAccounts ? erpAccountingAPI.getMappings(token) : Promise.resolve(null),
        canViewAccounts ? erpAccountingAPI.getAccounts(token) : Promise.resolve(null),
        canViewAccounts ? erpAccountingAPI.getCurrencies(token) : Promise.resolve(null),
      ])

      setTransactions(data.transactions || [])
      setTransactionSummary(data.summary || { totalCount: 0, totalAmount: 0, draft: 0, submitted: 0, approved: 0, posted: 0, returned: 0, rejected: 0 })
      setTransactionMeta((prev) => ({ ...prev, page: data.page || params.page || prev.page, limit: data.limit || params.limit || prev.limit, total: data.total || 0 }))
      if (customerData) setCustomers(customerData.customers || [])
      if (vendorData) setVendors(vendorData.vendors || [])
      if (inventoryData) setInventoryProducts(inventoryData.products || [])
      if (mappingData) setMappings(mappingData.mappings || [])
      if (accountData) setAccounts(accountData.accounts || [])
      if (currencyData) setCurrencies(currencyData.currencies || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load transactions')
    }
    setLoading(false)
  }

  const resetTransactionComposer = () => {
    setEditingTransactionId('')
    setTransactionForm(createTransactionForm())
  }

  const toggleTransactionSelection = (id) => {
    setSelectedTransactionIds((prev) => prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id])
  }

  const toggleVisibleTransactionSelection = () => {
    setSelectedTransactionIds((prev) => {
      if (allVisibleTransactionsSelected) {
        return prev.filter((id) => !transactions.some((tx) => tx._id === id))
      }
      return Array.from(new Set([...prev, ...transactions.map((tx) => tx._id)]))
    })
  }

  const populateTransactionForm = (tx) => {
    setEditingTransactionId(tx._id)
    setSelectedTransactionId(tx._id)
    setTransactionForm({
      type: tx.type || 'expense',
      metalFixStatus: String(tx.voucherMeta?.fixingType || '').toLowerCase().includes('non') ? 'unfixed' : 'fixed',
      amount: String(tx.amount ?? ''),
      date: tx.date ? new Date(tx.date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      currency: tx.currency || 'USD',
      exchangeRate: String(tx.exchangeRate ?? 1),
      description: tx.description || '',
      customerId: tx.customerId?._id || tx.customerId || '',
      vendorId: tx.vendorId?._id || tx.vendorId || '',
      inventoryItemId: tx.inventoryItemId?._id || tx.inventoryItemId || '',
      mappingId: tx.mappingId?._id || tx.mappingId || '',
      debitAccountId: tx.debitAccountId?._id || tx.debitAccountId || '',
      creditAccountId: tx.creditAccountId?._id || tx.creditAccountId || '',
    })
  }

  const getTransactionValidationMessage = () => {
    if (!transactionForm.type || !transactionForm.amount) return 'Transaction type and amount are required'
    if (Number(transactionForm.amount) <= 0) return 'Amount must be greater than zero'
    if (['sale', 'receipt'].includes(transactionForm.type) && !transactionForm.customerId) return 'Customer is required for sales and receipts'
    if (['purchase', 'payment'].includes(transactionForm.type) && !transactionForm.vendorId) return 'Vendor is required for purchases and payments'
    return ''
  }

  const loadVendors = async (filters = vendorFilters) => {
    if (!canAccessVendors) return
    setLoading(true)
    try {
      const data = await loadAllVendors(filters)
      setVendors(data.vendors || [])
      setVendorSummary(data.summary || { totalVendors: 0, totalOutstanding: 0, overLimit: 0, blacklisted: 0, onHold: 0, nonCompliant: 0 })
      setVendorPermissions(data.permissions || { canManage: false, canUpdateOperational: false })
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendors')
    }
    setLoading(false)
  }

  const loadVendorDetails = async (id) => {
    if (!id) {
      setSelectedVendorDetails(null)
      return
    }
    try {
      const data = await erpAccountingAPI.getVendorDetails(token, id)
      setSelectedVendorDetails(data)
      if (data.permissions) setVendorPermissions(data.permissions)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor details')
    }
  }

  const loadVendorPaymentCalendar = async () => {
    try {
      const data = await erpAccountingAPI.getVendorPaymentCalendar(token, { horizonDays: 45 })
      setVendorPaymentCalendar({ rows: data.rows || [], alerts: data.alerts || { overdue: 0, due_soon: 0, upcoming: 0, later: 0, totalDue: 0 } })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor payment calendar')
    }
  }

  const loadVendorComplianceSummary = async () => {
    try {
      const data = await erpAccountingAPI.getVendorComplianceSummary(token)
      setVendorComplianceSummary({
        summary: data.summary || { total: 0, nonCompliant: 0, avgComplianceScore: 0 },
        expiryBuckets: data.expiryBuckets || { expired: 0, warning30: 0, warning60: 0, warning90: 0 },
        atRisk: data.atRisk || [],
      })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vendor compliance summary')
    }
  }

  const loadVendorOverdueQueue = async () => {
    try {
      const data = await erpAccountingAPI.getVendorOverdueAlertQueue(token, { horizonDays: 120 })
      setVendorOverdueQueue({
        summary: data.summary || { total: 0, withRecipient: 0, critical: 0, totalAmountDue: 0 },
        queue: data.queue || [],
      })
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load overdue alert queue')
    }
  }

  const loadInventory = async () => {
    if (!canAccessInventory) return
    setLoading(true)
    try {
      const productsData = await erpAccountingAPI.getInventoryProducts(token)
      setInventoryProducts(productsData.products || [])
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load inventory')
    }
    setLoading(false)
  }

  const loadStockLedger = async () => {
    if (!canAccessInventory) return
    setStockMovementsLoading(true)
    try {
      const data = await erpAccountingAPI.getStockLedger(token)
      setStockMovements(data.movements || [])
    } catch {
      setStockMovements([])
    } finally {
      setStockMovementsLoading(false)
    }
  }

  const loadReports = async () => {
    if (!canAccessReports) return
    setLoading(true)
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      let startDate = ''
      let endDate = ''

      if (reportFilters.period === 'today') {
        startDate = now.toISOString().slice(0, 10)
        endDate = startDate
      } else if (reportFilters.period === 'month') {
        startDate = startOfMonth.toISOString().slice(0, 10)
        endDate = endOfMonth.toISOString().slice(0, 10)
      } else if (reportFilters.period === 'ytd') {
        startDate = startOfYear.toISOString().slice(0, 10)
        endDate = now.toISOString().slice(0, 10)
      } else if (reportFilters.period === 'custom') {
        startDate = reportFilters.startDate || ''
        endDate = reportFilters.endDate || ''
      }

      const commonRange = {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      }

      const [trial, pnl, bs, dayBook, custOut, venOut, forex] = await Promise.all([
        erpAccountingAPI.getTrialBalance(token, {
          ...commonRange,
          ...(reportFilters.accountType ? { accountType: reportFilters.accountType } : {}),
          includeZero: reportFilters.includeZeroAccounts,
          sortBy: reportFilters.sortBy,
          sortDir: reportFilters.sortDir,
        }),
        erpAccountingAPI.getProfitLossReport(token, {
          ...commonRange,
          comparePrevious: reportFilters.comparePrevious,
        }),
        erpAccountingAPI.getBalanceSheetReport(token, {
          ...(endDate ? { endDate } : {}),
        }),
        erpAccountingAPI.getDayBookReport(token, {
          ...commonRange,
          ...(reportFilters.referenceType ? { referenceType: reportFilters.referenceType } : {}),
          ...(reportFilters.minAmount ? { minAmount: reportFilters.minAmount } : {}),
        }),
        erpAccountingAPI.getCustomerOutstandingReport(token),
        erpAccountingAPI.getVendorOutstandingReport(token),
        erpAccountingAPI.getForexGainLossReport(token, commonRange),
      ])
      setReports({
        trialBalance: trial,
        profitLoss: pnl,
        balanceSheet: bs,
        dayBook,
        customerOutstanding: custOut,
        vendorOutstanding: venOut,
        forex,
      })
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load reports')
    }
    setLoading(false)
  }

  const loadLedgerReport = async (accountId) => {
    if (!accountId) {
      setLedgerReportRows([])
      return
    }
    try {
      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
      let startDate = ''
      let endDate = ''

      if (reportFilters.period === 'today') {
        startDate = now.toISOString().slice(0, 10)
        endDate = startDate
      } else if (reportFilters.period === 'month') {
        startDate = startOfMonth.toISOString().slice(0, 10)
        endDate = endOfMonth.toISOString().slice(0, 10)
      } else if (reportFilters.period === 'ytd') {
        startDate = new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10)
        endDate = now.toISOString().slice(0, 10)
      } else if (reportFilters.period === 'custom') {
        startDate = reportFilters.startDate || ''
        endDate = reportFilters.endDate || ''
      }

      const data = await erpAccountingAPI.getLedgerReport(token, {
        accountId,
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
      })
      setLedgerReportRows(data.report || [])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load ledger report')
    }
  }

  const handleCreateTransaction = async (e) => {
    e.preventDefault()
    const validationMessage = getTransactionValidationMessage()
    if (validationMessage) {
      setError(validationMessage)
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...transactionForm,
        amount: Number(transactionForm.amount),
        exchangeRate: Number(transactionForm.exchangeRate || 1),
        ...(['sale', 'purchase'].includes(String(transactionForm.type || '').toLowerCase()) ? { metalFixStatus: transactionForm.metalFixStatus || 'fixed' } : {}),
      }

      const response = isTransactionEditMode
        ? await erpAccountingAPI.updateTransaction(token, editingTransactionId, payload)
        : await erpAccountingAPI.createTransaction(token, payload)

      resetTransactionComposer()
      setSelectedTransactionId(response.transaction?._id || '')
      await loadTransactions({ page: 1 })
      showNotification(isTransactionEditMode ? '✅ Transaction updated' : '✅ Transaction created as draft')
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${isTransactionEditMode ? 'update' : 'create'} transaction`)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTransaction = async (id) => {
    if (typeof window !== 'undefined' && !window.confirm('Delete this transaction?')) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteTransaction(token, id)
      if (selectedTransactionId === id) setSelectedTransactionId('')
      if (editingTransactionId === id) resetTransactionComposer()
      setSelectedTransactionIds((prev) => prev.filter((item) => item !== id))
      await loadTransactions()
      showNotification('✅ Transaction deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete transaction')
    } finally {
      setSaving(false)
    }
  }

  const handleTransactionAction = async (action, id) => {
    try {
      setSaving(true)
      if ((action === 'return' || action === 'reject') && !transactionWorkflowNote.trim()) {
        setError(action === 'return' ? 'Return reason is required' : 'Rejection reason is required')
        setSaving(false)
        return
      }
      const payload = {
        comment: transactionWorkflowNote,
        ...(transactionForm.debitAccountId ? { debitAccountId: transactionForm.debitAccountId } : {}),
        ...(transactionForm.creditAccountId ? { creditAccountId: transactionForm.creditAccountId } : {}),
      }
      if (action === 'submit') await erpAccountingAPI.submitTransaction(token, id, payload)
      if (action === 'approve') await erpAccountingAPI.approveTransaction(token, id, payload)
      if (action === 'return') await erpAccountingAPI.returnTransaction(token, id, payload)
      if (action === 'reject') await erpAccountingAPI.rejectTransaction(token, id, payload)
      if (action === 'post') await erpAccountingAPI.postTransaction(token, id, payload)
      await Promise.all([loadTransactions(), loadDashboard()])
      setTransactionWorkflowNote('')
      showNotification(`✅ Transaction ${action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : action === 'return' ? 'returned for edit' : action === 'reject' ? 'rejected' : 'posted'}`)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} transaction`)
    } finally {
      setSaving(false)
    }
  }

  const handleAddTransactionComment = async () => {
    if (!selectedTransactionId) {
      setError('Select a transaction first')
      return
    }
    if (!transactionCommentDraft.trim()) {
      setError('Enter a comment first')
      return
    }
    try {
      setSaving(true)
      await erpAccountingAPI.addTransactionComment(token, selectedTransactionId, { message: transactionCommentDraft })
      await loadTransactions()
      setTransactionCommentDraft('')
      showNotification('✅ Transaction comment added')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to add transaction comment')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadTransactionAttachment = async (file) => {
    if (!selectedTransactionId) {
      setError('Select a transaction first')
      return
    }
    if (!file) return

    try {
      setSaving(true)
      await erpAccountingAPI.uploadTransactionAttachment(token, selectedTransactionId, file)
      await loadTransactions()
      setTransactionAttachmentInputKey((prev) => prev + 1)
      showNotification('✅ Attachment uploaded')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to upload attachment')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteTransactionAttachment = async (attachmentId) => {
    if (!selectedTransactionId || !attachmentId) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteTransactionAttachment(token, selectedTransactionId, attachmentId)
      await loadTransactions()
      showNotification('✅ Attachment deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete attachment')
    } finally {
      setSaving(false)
    }
  }

  const handleBulkTransactionAction = async (action) => {
    if (!selectedTransactionIds.length) {
      setError('Select at least one transaction')
      return
    }
    try {
      setSaving(true)
      const response = await erpAccountingAPI.bulkTransactionAction(token, {
        ids: selectedTransactionIds,
        action,
        comment: transactionWorkflowNote,
        mappingOverride: {
          ...(transactionForm.debitAccountId ? { debitAccountId: transactionForm.debitAccountId } : {}),
          ...(transactionForm.creditAccountId ? { creditAccountId: transactionForm.creditAccountId } : {}),
        },
      })
      await Promise.all([loadTransactions(), loadDashboard()])
      setTransactionWorkflowNote('')
      setSelectedTransactionIds([])
      if (!response.failureCount) {
        const label = action === 'submit' ? 'submitted' : action === 'approve' ? 'approved' : 'posted'
        showNotification(`✅ ${response.successCount} transactions ${label}`)
      } else {
        setError(`${response.successCount} succeeded, ${response.failureCount} failed`)
      }
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} selected transactions`)
    } finally {
      setSaving(false)
    }
  }

  const handleCreateVendor = async (e) => {
    e.preventDefault()
    if (!canManageVendors && !editingVendorId) {
      setError('Only Admin/Finance can create vendors')
      return
    }
    if (!vendorForm.name) {
      setError('Vendor name is required')
      return
    }
    try {
      setSaving(true)
      const payload = {
        ...vendorForm,
        openingBalance: Number(vendorForm.openingBalance || 0),
        paymentTermsDays: Number(vendorForm.paymentTermsDays || 30),
        creditLimit: Number(vendorForm.creditLimit || 0),
        rating: Number(vendorForm.rating || 3),
        tags: String(vendorForm.tags || '').split(',').map((tag) => tag.trim()).filter(Boolean),
      }

      if (editingVendorId) {
        await erpAccountingAPI.updateVendor(token, editingVendorId, payload)
        showNotification('✅ Vendor updated')
      } else {
        await erpAccountingAPI.createVendor(token, payload)
        showNotification('✅ Vendor created')
      }

      setVendorForm({
        vendorCode: '',
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        city: '',
        country: '',
        postalCode: '',
        gstVat: '',
        taxRegistrationNo: '',
        openingBalance: '',
        paymentTermsDays: '30',
        creditLimit: '',
        category: 'general',
        rating: '3',
        riskLevel: 'medium',
        status: 'active',
        notes: '',
        tags: '',
        preferredCurrency: 'USD',
        bankName: '',
        bankAccountNumber: '',
        iban: '',
        swiftCode: '',
        currency: 'USD',
      })
      setShowVendorForm(false)
      setEditingVendorId('')
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorComplianceSummary(),
      ])
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save vendor')
    } finally {
      setSaving(false)
    }
  }

  const handleVendorFilterSearch = async () => {
    await loadVendors(vendorFilters)
  }

  const handleVendorSelect = async (vendorId) => {
    setSelectedVendorId(vendorId)
    await loadVendorDetails(vendorId)
  }

  const handleEditVendor = (vendor) => {
    if (!vendorPermissions.canUpdateOperational) {
      setError('You are not allowed to edit vendors')
      return
    }

    setEditingVendorId(vendor._id)
    setShowVendorForm(true)
    setVendorForm({
      vendorCode: vendor.vendorCode || '',
      name: vendor.name || '',
      contactPerson: vendor.contactPerson || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      address: vendor.address || '',
      city: vendor.city || '',
      country: vendor.country || '',
      postalCode: vendor.postalCode || '',
      gstVat: vendor.gstVat || '',
      taxRegistrationNo: vendor.taxRegistrationNo || '',
      openingBalance: String(vendor.openingBalance || ''),
      paymentTermsDays: String(vendor.paymentTermsDays || 30),
      creditLimit: String(vendor.creditLimit || ''),
      category: vendor.category || 'general',
      rating: String(vendor.rating || 3),
      riskLevel: vendor.riskLevel || 'medium',
      status: vendor.status || 'active',
      notes: vendor.notes || '',
      tags: Array.isArray(vendor.tags) ? vendor.tags.join(', ') : '',
      preferredCurrency: vendor.preferredCurrency || vendor.currency || 'USD',
      bankName: vendor.bankName || '',
      bankAccountNumber: vendor.bankAccountNumber || '',
      iban: vendor.iban || '',
      swiftCode: vendor.swiftCode || '',
      currency: vendor.currency || 'USD',
    })
  }

  const handleDeleteVendor = async (vendor) => {
    if (!vendorPermissions.canManage) {
      setError('Only Admin/Finance can deactivate vendors')
      return
    }
    if (!window.confirm(`Deactivate vendor ${vendor.name}?`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteVendor(token, vendor._id)
      if (selectedVendorId === vendor._id) {
        setSelectedVendorId('')
        setSelectedVendorDetails(null)
      }
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorComplianceSummary(),
        loadVendorOverdueQueue(),
      ])
      showNotification('✅ Vendor deactivated')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to deactivate vendor')
    } finally {
      setSaving(false)
    }
  }

  const handleVendorWorkflowStatus = async (status) => {
    if (!selectedVendorId) return
    try {
      setSaving(true)
      await erpAccountingAPI.updateVendorWorkflow(token, selectedVendorId, {
        status,
        reason: vendorWorkflowReason,
      })
      setVendorWorkflowReason('')
      await Promise.all([
        loadVendors(vendorFilters),
        loadVendorDetails(selectedVendorId),
        loadVendorPaymentCalendar(),
        loadVendorComplianceSummary(),
        loadVendorOverdueQueue(),
      ])
      showNotification(`✅ Vendor moved to ${status}`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update vendor workflow')
    } finally {
      setSaving(false)
    }
  }

  const handleAddVendorDocument = async (e) => {
    e.preventDefault()
    if (!selectedVendorId) {
      setError('Select a vendor first')
      return
    }
    if (!vendorDocumentForm.title) {
      setError('Document title is required')
      return
    }
    try {
      setSaving(true)
      await erpAccountingAPI.addVendorDocument(token, selectedVendorId, vendorDocumentForm)
      setVendorDocumentForm({ docType: 'contract', title: '', documentNo: '', fileUrl: '', issueDate: '', expiryDate: '', status: 'active', verified: false, notes: '' })
      await Promise.all([
        loadVendorDetails(selectedVendorId),
        loadVendorComplianceSummary(),
      ])
      showNotification('✅ Vendor document added')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to add vendor document')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteVendorDocument = async (documentId) => {
    if (!selectedVendorId) return
    if (!window.confirm('Delete this vendor document?')) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteVendorDocument(token, selectedVendorId, documentId)
      await Promise.all([
        loadVendorDetails(selectedVendorId),
        loadVendorComplianceSummary(),
      ])
      showNotification('✅ Vendor document deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete vendor document')
    } finally {
      setSaving(false)
    }
  }

  const resetInventoryMappingForm = () => {
    setEditingProductId('')
    setInventoryMappingForm(createInventoryMappingForm())
    setInventoryStockCodeManualOverride(false)
    setInventoryModalOffset({ x: 0, y: 0 })
    setInventoryModalDragging(false)
    setShowInventoryMappingModal(false)
  }

  const resetInventoryProductForm = () => {
    setEditingInventoryProductId('')
    setInventoryProductForm(createInventoryProductForm())
    setInventoryProductModalOffset({ x: 0, y: 0 })
    setInventoryProductModalDragging(false)
    setShowInventoryProductModal(false)
  }

  const stopInventoryModalDrag = () => {
    const { moveHandler, upHandler } = inventoryModalDragRef.current
    if (moveHandler) {
      window.removeEventListener('mousemove', moveHandler)
    }
    if (upHandler) {
      window.removeEventListener('mouseup', upHandler)
    }
    inventoryModalDragRef.current = { moveHandler: null, upHandler: null }
    setInventoryModalDragging(false)
  }

  const handleInventoryModalDragStart = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const originX = inventoryModalOffset.x
    const originY = inventoryModalOffset.y

    const moveHandler = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      setInventoryModalOffset({ x: originX + deltaX, y: originY + deltaY })
    }

    const upHandler = () => {
      stopInventoryModalDrag()
    }

    stopInventoryModalDrag()
    setInventoryModalDragging(true)
    inventoryModalDragRef.current = { moveHandler, upHandler }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', upHandler)
  }

  const stopInventoryProductModalDrag = () => {
    const { moveHandler, upHandler } = inventoryProductModalDragRef.current
    if (moveHandler) {
      window.removeEventListener('mousemove', moveHandler)
    }
    if (upHandler) {
      window.removeEventListener('mouseup', upHandler)
    }
    inventoryProductModalDragRef.current = { moveHandler: null, upHandler: null }
    setInventoryProductModalDragging(false)
  }

  const handleInventoryProductModalDragStart = (event) => {
    if (event.button !== 0) return
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const originX = inventoryProductModalOffset.x
    const originY = inventoryProductModalOffset.y

    const moveHandler = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      setInventoryProductModalOffset({ x: originX + deltaX, y: originY + deltaY })
    }

    const upHandler = () => {
      stopInventoryProductModalDrag()
    }

    stopInventoryProductModalDrag()
    setInventoryProductModalDragging(true)
    inventoryProductModalDragRef.current = { moveHandler, upHandler }
    window.addEventListener('mousemove', moveHandler)
    window.addEventListener('mouseup', upHandler)
  }

  useEffect(() => () => {
    stopInventoryModalDrag()
    stopInventoryProductModalDrag()
  }, [])

  useEffect(() => {
    if (isSuperAdmin && inventoryStockCodeManualOverride) return
    const baseCode = buildAutoStockCode(inventoryMappingForm, inventoryStockCodeSettings)
    const nextCode = buildUniqueStockCode(baseCode, inventoryMappingProducts, editingProductId)
    setInventoryMappingForm((prev) => (prev.stockCode === nextCode ? prev : { ...prev, stockCode: nextCode }))
  }, [inventoryMappingForm.mainStock, inventoryMappingForm.customMainStock, inventoryMappingForm.metalType, inventoryMappingProducts, editingProductId, inventoryStockCodeSettings, isSuperAdmin, inventoryStockCodeManualOverride])

  const buildInventoryPayloadFromForm = (form, includeOpeningQty = true) => {
    const mainStockValue = resolveMainStockValueFromForm(form)
    const normalizedMetalType = String(form.metalType || '').trim().toLowerCase()
    const categoryMeta = encodeInventoryCategoryMeta({
      mainStock: mainStockValue,
      metalType: normalizedMetalType,
      priceUnit: form.priceUnit || 'OZ',
      priceCurrency: form.priceCurrency || 'USD',
    })
    const label = titleCaseWords(mainStockValue || normalizedMetalType || 'Main Stock')

    const autoSku = buildUniqueStockCode(buildAutoStockCode(form, inventoryStockCodeSettings), inventoryMappingProducts, editingProductId)
    const resolvedSku = isSuperAdmin
      ? (String(form.stockCode || '').trim().toUpperCase() || autoSku)
      : autoSku

    const priceValue = parseFloat(form.currentPrice) || 0
    const payload = {
      sku: resolvedSku,
      name: `${label} Main Stock`,
      category: categoryMeta,
      unit: 'grams',
      unitCost: priceValue,
      sellingPrice: priceValue,
      currency: form.priceCurrency || 'USD',
      description: priceValue > 0 ? `${priceValue} ${form.priceCurrency || 'USD'}/${form.priceUnit || 'OZ'}` : undefined,
    }

    if (includeOpeningQty) {
      payload.quantity = Number(form.openingQty || 0)
    }

    return payload
  }

  const handleCreateProduct = async (e) => {
    e.preventDefault()
    const mainStockValue = resolveMainStockValueFromForm(inventoryMappingForm)
    if (!mainStockValue) {
      setError('Main stock is required')
      return
    }
    if (!inventoryMappingForm.stockCode.trim()) {
      setError('Stock code is required')
      return
    }
    const duplicateStockCode = inventoryMappingProducts.find((item) => (
      String(item.sku || '').trim().toLowerCase() === String(inventoryMappingForm.stockCode || '').trim().toLowerCase()
      && item._id !== editingProductId
    ))
    if (duplicateStockCode) {
      setError('Stock code already exists. Use a unique stock code.')
      return
    }
    try {
      setSaving(true)
      const payload = buildInventoryPayloadFromForm(inventoryMappingForm, !editingProductId)
      if (editingProductId) {
        await erpAccountingAPI.updateInventoryProduct(token, editingProductId, payload)
        showNotification('✅ Stock mapping updated')
      } else {
        await erpAccountingAPI.createInventoryProduct(token, payload)
        showNotification('✅ Stock mapping created')
      }
      resetInventoryMappingForm()
      await loadInventory()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save stock mapping')
    } finally {
      setSaving(false)
    }
  }

  const handleEditProduct = (p) => {
    const meta = decodeInventoryCategoryMeta(p.category)
    const resolvedMainStock = meta.mainStock || meta.metalType || ''
    const priceValue = Number(p.unitCost || p.sellingPrice || 0)
    setEditingProductId(p._id)
    setInventoryMappingForm({
      mainStock: resolvedMainStock || 'gold',
      customMainStock: '',
      metalType: meta.metalType || resolvedMainStock || 'gold',
      stockCode: p.sku || '',
      unit: 'grams',
      currency: p.currency || 'USD',
      currentPrice: priceValue > 0 ? String(priceValue) : '',
      priceUnit: meta.priceUnit || 'OZ',
      priceCurrency: meta.priceCurrency || p.currency || 'USD',
    })
    setInventoryStockCodeManualOverride(false)
    setInventoryModalOffset({ x: 0, y: 0 })
    setShowInventoryMappingModal(true)
  }

  const handleDeleteProduct = async (p) => {
    if (!window.confirm(`Delete product "${p.name}"? This cannot be undone.`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteInventoryProduct(token, p._id)
      await loadInventory()
      showNotification('✅ Stock mapping deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete stock mapping')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateInventoryCatalogProduct = async (e) => {
    e.preventDefault()
    if (!inventoryProductForm.name.trim()) {
      setError('Product name is required')
      return
    }

    // For new products, stock type is required. For editing, allow if category is already set
    if (!inventoryProductForm.stockTypeId && !editingInventoryProductId) {
      setError('Product category is required')
      return
    }

    const selectedStockType = inventoryMappingProducts.find((item) => item._id === inventoryProductForm.stockTypeId)
    // For new products, selectedStockType is required. For editing, use existing or matched
    if (!selectedStockType && !editingInventoryProductId) {
      setError('Product category is required')
      return
    }

    // For editing, extract baseCategory from existing product if selectedStockType not found
    let baseCategory = ''
    if (selectedStockType) {
      baseCategory = String(selectedStockType.category || '').replace(/;?recordType=product/gi, '')
    } else if (editingInventoryProductId) {
      // Extract from existing product's category string
      const existingProduct = inventoryCatalogProducts.find((p) => p._id === editingInventoryProductId)
      if (existingProduct) {
        baseCategory = String(existingProduct.category || '').replace(/;recordType=product.*$/gi, '')
      }
    }

    const sanitizeMetaText = (value) => String(value || '').replace(/[;\n\r]/g, ' ').trim()
    const categoryName = sanitizeMetaText(inventoryProductForm.categoryName || selectedInventoryStockType?.mainStock || '')
    const productDescription = sanitizeMetaText(inventoryProductForm.description)
    const productWeight = Number(inventoryProductForm.weight || 0)
    const productGrossWeight = Number(inventoryProductForm.grossWeight || inventoryProductForm.weight || 0)
    const productPurity = String(inventoryProductForm.purity || '').trim()
    const productTaxType = sanitizeMetaText(inventoryProductForm.taxType || 'VAT')
    const vatPercentRaw = Number(inventoryProductForm.vatPercent || 0)
    const productVatPercent = Number.isFinite(vatPercentRaw) && vatPercentRaw >= 0
      ? Number(vatPercentRaw.toFixed(2))
      : 0
    const productPurityWeight = Number(inventoryProductPurityWeight || 0)

    try {
      setSaving(true)
      const payload = {
        name: inventoryProductForm.name.trim(),
        category: `${baseCategory};recordType=product;productCategory=${categoryName};productDescription=${productDescription};weight=${productWeight};grossWeight=${productGrossWeight};productPurity=${productPurity};taxType=${productTaxType};vatPercent=${productVatPercent};purityWeight=${productPurityWeight}`,
        unit: 'grams',
        quantity: productWeight,
        unitCost: 0,
        sellingPrice: 0,
        currency: 'USD',
      }

      if (editingInventoryProductId) {
        await erpAccountingAPI.updateInventoryProduct(token, editingInventoryProductId, payload)
        showNotification('✅ Product updated')
      } else {
        await erpAccountingAPI.createInventoryProduct(token, payload)
        showNotification('✅ Product created')
      }
      resetInventoryProductForm()
      await loadInventory()
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${editingInventoryProductId ? 'update' : 'create'} product`)
    } finally {
      setSaving(false)
    }
  }

  const handleEditInventoryCatalogProduct = (productItem, productMeta) => {
    // Try to match stock type - first by category string, then by product metadata
    let matchedStockType = inventoryMappingProducts.find((stockTypeItem) => String(productItem.category || '').startsWith(`${String(stockTypeItem.category || '')};recordType=product`))
    
    // Fallback: try matching by main stock name from product metadata
    if (!matchedStockType && productMeta?.mainStock) {
      const mainStockLower = String(productMeta.mainStock).toLowerCase().trim()
      matchedStockType = inventoryMappingProducts.find((stockTypeItem) => {
        const stockName = String(stockTypeItem.name || '').toLowerCase().trim()
        const stockMeta = decodeInventoryCategoryMeta(stockTypeItem.category)
        const stockMainLower = String(stockMeta.mainStock || stockMeta.metalType || '').toLowerCase().trim()
        return stockName === mainStockLower || stockMainLower === mainStockLower
      })
    }

    setEditingInventoryProductId(productItem._id)
    setInventoryProductForm({
      stockTypeId: matchedStockType?._id || '',
      categoryName: productMeta?.productCategory || titleCaseWords(productMeta?.mainStock || productMeta?.metalType || matchedStockType?.name || ''),
      name: productItem.name || '',
      description: productMeta?.productDescription || '',
      weight: String(productMeta?.weight ?? productItem.quantity ?? ''),
      grossWeight: String(productMeta?.grossWeight ?? productMeta?.weight ?? productItem.quantity ?? ''),
      purity: productMeta?.productPurity || productMeta?.purity || '',
      taxType: productMeta?.taxType || 'VAT',
      vatPercent: String(productMeta?.vatPercent ?? ''),
    })
    setInventoryProductModalOffset({ x: 0, y: 0 })
    setShowInventoryProductModal(true)
  }

  const handleDeleteInventoryCatalogProduct = async (productItem) => {
    if (!window.confirm(`Delete product "${productItem?.name || 'Unnamed'}"? This cannot be undone.`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteInventoryProduct(token, productItem._id)
      if (editingInventoryProductId && String(editingInventoryProductId) === String(productItem._id)) {
        resetInventoryProductForm()
      }
      await loadInventory()
      showNotification('✅ Product deleted')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete product')
    } finally {
      setSaving(false)
    }
  }

  const loadEnquiryHistory = () => {
    try {
      const raw = localStorage.getItem(ENQUIRY_HISTORY_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        setEnquiryHistory(parsed.slice(0, 10))
      }
    } catch {
      setEnquiryHistory([])
    }
  }

  const persistEnquiryHistory = (nextHistory) => {
    setEnquiryHistory(nextHistory)
    localStorage.setItem(ENQUIRY_HISTORY_STORAGE_KEY, JSON.stringify(nextHistory))
  }

  const pushEnquiryHistory = (account) => {
    if (!account?.accountCode) return
    const nextItem = {
      accountCode: account.accountCode,
      accountName: account.accountName || '',
      searchedAt: new Date().toISOString(),
    }
    const deduped = enquiryHistory.filter((item) => item.accountCode !== nextItem.accountCode)
    const nextHistory = [nextItem, ...deduped].slice(0, 10)
    persistEnquiryHistory(nextHistory)
  }

  const fetchAccountEnquiryByCode = async (accountCode, options = {}) => {
    const cleanCode = String(accountCode || '').trim()
    const shouldOpenModal = Boolean(options.openModal)
    if (!cleanCode) {
      setError('Please enter account number')
      setEnquiryStatus({ type: 'error', message: 'Please enter account number' })
      return
    }

    try {
      if (shouldOpenModal) setShowEnquiryModal(true)
      setEnquiryLoading(true)
      setEnquiryStatus({ type: '', message: '' })
      const data = await erpAccountingAPI.getAccountEnquiry(token, cleanCode)
      setAccountEnquiryCode(cleanCode)
      setAccountEnquiryData(data)
      setAccountSummaryView('position')
      setStatementFilters({ startDate: '', endDate: '', referenceType: '', department: '', fixStatus: '' })
      pushEnquiryHistory(data.account)
      setError('')
      setEnquiryStatus({ type: 'success', message: `Account ${data.account.accountCode} summary loaded successfully` })
      showNotification('✅ Account summary loaded')
    } catch (e) {
      setAccountEnquiryData(null)
      const msg = e.response?.data?.message || 'Failed to fetch account summary'
      setError(msg)
      setEnquiryStatus({ type: 'error', message: msg })
    } finally {
      setEnquiryLoading(false)
    }
  }

  const handleOpenAccountSummaryFromTree = async (account) => {
    if (!account?.accountCode) return
    setActiveTab('enquiry')
    setAccountEnquiryCode(account.accountCode)
    await fetchAccountEnquiryByCode(account.accountCode)
  }

  const handleAccountEnquiry = async (e) => {
    e.preventDefault()
    await fetchAccountEnquiryByCode(accountEnquiryCode, { openModal: true })
  }

  const handleUpdateMetalRates = async (e) => {
    e.preventDefault()
    if (!canUpdateMetalRates) {
      setError('You do not have permission to update rates')
      return
    }

    const payload = {
      goldPrice: Number(metalRateForm.goldPrice),
      silverPrice: Number(metalRateForm.silverPrice),
      priceCurrency: String(metalRateForm.priceCurrency || 'USD').toUpperCase(),
    }

    if (!payload.goldPrice || payload.goldPrice <= 0 || !payload.silverPrice || payload.silverPrice <= 0) {
      setError('Gold and silver rates must be greater than zero')
      return
    }

    try {
      setSaving(true)
      const data = await erpAccountingAPI.updateMetalRates(token, payload)
      const rates = data.rates || payload
      setMetalRates(rates)
      setMetalRateForm({
        goldPrice: String(rates.goldPrice),
        silverPrice: String(rates.silverPrice),
        priceCurrency: rates.priceCurrency,
      })
      setError('')
      showNotification('✅ Gold/Silver rates updated')

      if (accountEnquiryData?.account?.accountCode) {
        const refreshed = await erpAccountingAPI.getAccountEnquiry(token, accountEnquiryData.account.accountCode)
        setAccountEnquiryData(refreshed)
        pushEnquiryHistory(refreshed.account)
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update metal rates')
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    loadEnquiryHistory()
  }, [])

  useEffect(() => {
    setSelectedTransactionIds((prev) => {
      const next = prev.filter((id) => transactions.some((tx) => tx._id === id))
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) {
        return prev
      }
      return next
    })
    if (selectedTransactionId && !transactions.some((tx) => tx._id === selectedTransactionId)) {
      setSelectedTransactionId('')
    }
  }, [transactions, selectedTransactionId])

  useEffect(() => {
    let cancelled = false

    const updatePreviewLogo = async () => {
      if (!brandingForm.logoUrl) {
        setBrandingPreviewLogo('')
        return
      }

      const nextLogo = await createLogoRenderAsset(
        brandingForm.logoUrl,
        brandingForm.logoWidth,
        brandingForm.logoHeight,
        brandingForm.logoFit
      )

      if (!cancelled) {
        setBrandingPreviewLogo(nextLogo)
      }
    }

    updatePreviewLogo()

    return () => {
      cancelled = true
    }
  }, [brandingForm.logoFit, brandingForm.logoHeight, brandingForm.logoUrl, brandingForm.logoWidth])

  useEffect(() => {
    if (activeTab !== 'transactions' || !selectedTransactionId || !transactions.length) return
    const target = document.getElementById(`erp-transaction-row-${selectedTransactionId}`)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [activeTab, selectedTransactionId, transactions])

  useEffect(() => {
    if (activeTab !== 'vendors' || !selectedVendorId) return
    loadVendorDetails(selectedVendorId)
  }, [activeTab, selectedVendorId])

  useEffect(() => {
    // Prevent stale error banners from one ERP section leaking into another.
    setError('')
  }, [activeTab])

  useEffect(() => {
    if (!customerMarginContextMenu.open) return undefined

    const closeMenu = () => {
      setCustomerMarginContextMenu((prev) => (prev.open ? { open: false, x: 0, y: 0, row: null } : prev))
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') closeMenu()
    }

    window.addEventListener('click', closeMenu)
    window.addEventListener('resize', closeMenu)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('click', closeMenu)
      window.removeEventListener('resize', closeMenu)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [customerMarginContextMenu.open])

  useEffect(() => {
    if (!canAccessERP || !token) {
      setError('You do not have access to the ERP Accounting module.')
      return
    }

    if (activeTab === 'dashboard') loadDashboard()
    else if (activeTab === 'accounts') loadAccounts()
    else if (activeTab === 'customers' || activeTab === 'customer-margin') loadCustomers()
    else if (activeTab === 'ledger') {
      loadLedger()
      loadAccounts({ scope: 'summary' })
    }
    else if (activeTab === 'mappings') loadMappings(mappingFilters)
    else if (activeTab === 'transactions') loadTransactions()
    else if (activeTab === 'reports') {
      loadReportBranding()
      loadReports()
      if (!accounts.length) loadAccounts()
      if (selectedReportAccountId) {
        loadLedgerReport(selectedReportAccountId)
      }
    }
    else if (activeTab === 'vendors') {
      loadVendors()
      loadVendorPaymentCalendar()
      loadVendorComplianceSummary()
      loadVendorOverdueQueue()
    }
    else if (activeTab === 'inventory') {
      loadInventory()
      loadStockLedger()
      loadVendors()
    }
    else if (activeTab === 'settings') {
      loadCurrencies()
      loadReportBranding()
    }
    else if (activeTab === 'currencies') {
      loadCurrencies()
      if (!accounts.length) loadAccounts()
    }
    else if (activeTab === 'enquiry') loadAccounts({ scope: 'summary' })
  }, [
    activeTab,
    token,
    ledgerFilters.startDate,
    ledgerFilters.endDate,
    ledgerFilters.department,
    ledgerFilters.referenceType,
    ledgerFilters.accountId,
    reportFilters.period,
    reportFilters.startDate,
    reportFilters.endDate,
    mappingFilters.department,
    reportFilters.accountType,
    reportFilters.includeZeroAccounts,
    reportFilters.sortBy,
    reportFilters.sortDir,
    reportFilters.comparePrevious,
    reportFilters.referenceType,
    reportFilters.minAmount,
    selectedReportAccountId,
  ])

  // Re-load dashboard when date range changes
  useEffect(() => {
    if (activeTab === 'dashboard' && canViewAccounts && token) loadDashboard()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashDateFrom, dashDateTo])

  // Auto-refresh every 30 seconds when enabled and on dashboard tab
  useEffect(() => {
    if (!dashAutoRefresh || activeTab !== 'dashboard') return
    const interval = setInterval(() => {
      if (canViewAccounts && token) loadDashboard()
    }, 30000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashAutoRefresh, activeTab])

  useEffect(() => {
    if (activeTab !== 'vouchers' || !token) return
    if (!customers.length) loadCustomers({ limit: 200 })
    if (!vendors.length) loadVendors()
    if (!currencies.length) loadCurrencies()
    if (!accounts.length) loadAccounts()
  }, [activeTab, token, customers.length, vendors.length, currencies.length, accounts.length])

  useEffect(() => {
    if (activeTab !== 'direct-deals' || !token) return
    if (!customers.length) loadCustomers({ limit: 200 })
    if (!currencies.length) loadCurrencies()
  }, [activeTab, token, customers.length, currencies.length])

  useEffect(() => {
    if (activeTab !== 'fixing-register' || !token) return
    if (!customers.length) loadCustomers({ limit: 200 })
    if (!inventoryProducts.length) loadInventory()
  }, [activeTab, token, customers.length, inventoryProducts.length])

  useEffect(() => {
    if (!fixingRegisterStockTypeOptions.length) return
    const hasSelected = fixingRegisterStockTypeOptions.some((option) => option.value === fixingRegFilter.metalType)
    if (!hasSelected) {
      setFixingRegFilter((prev) => ({ ...prev, metalType: fixingRegisterStockTypeOptions[0].value }))
    }
  }, [fixingRegisterStockTypeOptions, fixingRegFilter.metalType])

  const convertMetalBalanceByUnit = (valueInGram) => {
    const factor = METAL_UNIT_FACTORS[metalUnit] || 1
    return Number(valueInGram || 0) / factor
  }

  const formatMoney = (value) => Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })
  const normalizeBalanceDirection = (direction) => {
    const raw = String(direction || '').trim().toLowerCase()
    if (raw === 'debit' || raw === 'dr') return 'Dr'
    if (raw === 'credit' || raw === 'cr') return 'Cr'
    return ''
  }
  const formatDirectionalBalance = (value, options = {}) => {
    const amount = Number(value || 0)
    const preferredDirection = normalizeBalanceDirection(options.preferredDirection)
    const direction = preferredDirection || (amount < 0 ? 'Cr' : 'Dr')
    const absAmount = Math.abs(amount)
    const formatted = absAmount.toLocaleString(undefined, {
      minimumFractionDigits: options.minDigits ?? 2,
      maximumFractionDigits: options.maxDigits ?? 2,
    })
    if (absAmount === 0) return formatted
    return `${formatted} ${direction}`
  }
  const customerMarginRows = useMemo(() => {
    const query = String(customerMarginSearch || '').trim().toLowerCase()
    const rows = (customers || [])
      .map((customer) => {
        const outstanding = Number(customer?.outstandingBalance || 0)
        const opening = Number(customer?.openingBalance || 0)
        const creditLimit = Number(customer?.creditLimit || 0)
        const status = outstanding > 0 ? 'POSITIVE' : outstanding < 0 ? 'NEGATIVE' : 'NEUTRAL'
        const base = creditLimit > 0 ? creditLimit : (Math.abs(opening) > 0 ? Math.abs(opening) : 0)
        const marginPercent = base > 0 ? (Math.abs(outstanding) / base) * 100 : null
        return {
          id: customer?._id,
          customerName: String(customer?.name || '-'),
          balanceAbs: Math.abs(outstanding),
          equity: outstanding,
          rawOutstanding: outstanding,
          status,
          marginPercent,
          accountCode: String(customer?.ledgerAccountId?.accountCode || ''),
          description: String(customer?.ledgerAccountId?.accountName || `${String(customer?.name || '').trim()} customer`),
        }
      })
      .filter((row) => (!query ? true : row.customerName.toLowerCase().includes(query)))

    if (customerMarginSort === 'margin-asc') {
      rows.sort((a, b) => {
        const av = Number.isFinite(a.marginPercent) ? Number(a.marginPercent) : -1
        const bv = Number.isFinite(b.marginPercent) ? Number(b.marginPercent) : -1
        return av - bv
      })
    } else if (customerMarginSort === 'name-asc') {
      rows.sort((a, b) => a.customerName.localeCompare(b.customerName))
    } else {
      rows.sort((a, b) => {
        const av = Number.isFinite(a.marginPercent) ? Number(a.marginPercent) : -1
        const bv = Number.isFinite(b.marginPercent) ? Number(b.marginPercent) : -1
        return bv - av
      })
    }

    return rows
  }, [customers, customerMarginSearch, customerMarginSort])

  const formatCustomerMarginEquity = (row) => {
    const amount = Number(Math.abs(row?.equity || 0)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (Number(row?.equity || 0) > 0) return `+${amount}`
    if (Number(row?.equity || 0) < 0) return `-${amount}`
    return amount
  }

  const formatCustomerMarginPercent = (value) => {
    if (!Number.isFinite(Number(value))) return '-'
    return `${Number(value).toFixed(2)} %`
  }

  const formatCustomerMarginExcessShort = (row) => {
    const amount = Number(row?.balanceAbs || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
    if (Number(row?.rawOutstanding || 0) > 0) return `Excess ${amount}`
    if (Number(row?.rawOutstanding || 0) < 0) return `Short ${amount}`
    return '-'
  }

  const handleCustomerMarginRowContextMenu = (event, row) => {
    event.preventDefault()
    const menuWidth = 292
    const menuHeight = 172
    const viewportPad = 8
    let x = event.clientX + 6
    let y = event.clientY + 6

    if (x + menuWidth > window.innerWidth - viewportPad) {
      x = Math.max(viewportPad, window.innerWidth - menuWidth - viewportPad)
    }
    if (y + menuHeight > window.innerHeight - viewportPad) {
      y = Math.max(viewportPad, window.innerHeight - menuHeight - viewportPad)
    }

    setCustomerMarginContextMenu({ open: true, x, y, row })
  }

  const FIXING_REG_UNIT_PER_OZ = { GOZ: 1, GRAM: 31.1034768, KG: 0.0311034768, TOLA: 2.66667 }
  const fixingRegNormalizeUnit = (unit) => {
    const normalized = String(unit || 'GOZ').trim().toUpperCase()
    if (normalized === 'OZ' || normalized === 'OUNCE' || normalized === 'OUNCES') return 'GOZ'
    return normalized
  }
  const fixingRegConvertQty = (oz, unit) => oz * (FIXING_REG_UNIT_PER_OZ[fixingRegNormalizeUnit(unit)] || 1)
  const fixingRegConvertRate = (pricePerOz, unit) => pricePerOz / (FIXING_REG_UNIT_PER_OZ[fixingRegNormalizeUnit(unit)] || 1)
  const fixingRegConvertToOz = (qty, unit) => {
    const normalizedUnit = fixingRegNormalizeUnit(unit)
    const factor = FIXING_REG_UNIT_PER_OZ[normalizedUnit] || 1
    return Number(qty || 0) / factor
  }
  const fixingRegFmtQty = (oz, unit) => fixingRegConvertQty(oz, unit).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 4 })
  const fixingRegFmtRate = (p, unit) => fixingRegConvertRate(p, unit).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })
  const fixingRegFmtAmt = (v) => Number(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  const handleFixingRegProceed = async () => {
    setFixingRegError('')
    setFixingRegLoading(true)
    setFixingRegShown(false)
    try {
      const today = new Date(); today.setHours(23, 59, 59, 999)
      const fromDate = fixingRegFilter.fromDate ? new Date(`${fixingRegFilter.fromDate}T00:00:00`) : null
      const openingEndDate = fromDate ? new Date(fromDate.getTime() - 86400000) : null
      const selectedMetalCode = String(fixingRegFilter.metalType || '').split('::')[0].toUpperCase()
      const primaryMetalCodes = new Set(['XAU', 'XAG', 'XPT', 'XPD'])
      const isAllMetalSelection = !selectedMetalCode || selectedMetalCode === 'ALL'
      const isOtherMetalSelection = selectedMetalCode === 'OTHER'
      const matchesSelectedMetal = (metalCodeRaw) => {
        const metalCode = String(metalCodeRaw || '').toUpperCase()
        if (isAllMetalSelection) return true
        if (isOtherMetalSelection) return metalCode && !primaryMetalCodes.has(metalCode)
        return metalCode === selectedMetalCode
      }
      const fetchAllPages = async (fetchFn, key, limit = 200) => {
        const allRows = []
        let page = 1
        let total = 0
        do {
          const data = await fetchFn({ page, limit })
          const chunk = Array.isArray(data?.[key]) ? data[key] : []
          allRows.push(...chunk)
          total = Number(data?.total || chunk.length)
          if (!chunk.length) break
          page += 1
        } while (allRows.length < total)
        return allRows
      }

      const baseTxParams = {
        startDate: fixingRegFilter.fromDate,
        endDate: fixingRegFilter.toDate,
      }
      const openingTxParams = openingEndDate ? {
        endDate: openingEndDate.toISOString().slice(0, 10),
      } : null
      if (fixingRegFilter.status === 'final') baseTxParams.status = 'posted'
      if (openingTxParams && fixingRegFilter.status === 'final') openingTxParams.status = 'posted'

      const [saleTxs, purchaseTxs, deals, openingSaleTxs, openingPurchaseTxs, openingDeals] = await Promise.all([
        fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...baseTxParams, ...p, type: 'sale' }), 'transactions', 200),
        fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...baseTxParams, ...p, type: 'purchase' }), 'transactions', 200),
        fetchAllPages((p) => erpAccountingAPI.getDirectDeals(token, {
          ...p,
          startDate: fixingRegFilter.fromDate,
          endDate: fixingRegFilter.toDate,
          ...(fixingRegFilter.status === 'final' ? { status: 'confirmed' } : {}),
        }), 'deals', 100),
        openingTxParams
          ? fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...openingTxParams, ...p, type: 'sale' }), 'transactions', 200)
          : Promise.resolve([]),
        openingTxParams
          ? fetchAllPages((p) => erpAccountingAPI.getTransactions(token, { ...openingTxParams, ...p, type: 'purchase' }), 'transactions', 200)
          : Promise.resolve([]),
        openingTxParams
          ? fetchAllPages((p) => erpAccountingAPI.getDirectDeals(token, {
            ...p,
            endDate: openingEndDate.toISOString().slice(0, 10),
            ...(fixingRegFilter.status === 'final' ? { status: 'confirmed' } : {}),
          }), 'deals', 100)
          : Promise.resolve([]),
      ])

      const buildRows = ({ txSales = [], txPurchases = [], directDeals = [] }) => {
        const rows = []

        const toValidNumber = (value) => {
          if (value === null || value === undefined || value === '') return null
          const parsed = Number(value)
          return Number.isFinite(parsed) ? parsed : null
        }

        const resolveUnfixAmount = (line = {}) => {
          const premium = toValidNumber(line.premiumAmount)
            ?? toValidNumber(line.premiumAmt)
            ?? toValidNumber(line.premium)
            ?? toValidNumber(line.premiumValueAmount)
          if (premium !== null) return premium

          const total = toValidNumber(line.totalAmount) ?? toValidNumber(line.amountLC)
          const metal = toValidNumber(line.metalAmount)
          if (total !== null && metal !== null) return total - metal
          return 0
        }

        const txRows = [...txSales, ...txPurchases]
        for (const tx of txRows) {
          const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
          const txFixingTypeRaw = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || '').trim().toLowerCase()
          const txFixingMode = ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(txFixingTypeRaw) ? 'Unfixing' : 'Fixing'
          const voucherNo = String(tx?.voucherMeta?.vocNo || tx?.voucherMeta?.refNo || tx?._id || '').trim()
          const branch = tx?.voucherMeta?.branch || 'HO'
          const partyName = tx?.customerId?.name || tx?.vendorId?.name || tx?.voucherMeta?.partyName || '—'
          const docDate = tx?.voucherMeta?.docDate || tx?.date || null
          const valueDate = tx?.voucherMeta?.valueDate || tx?.date || null

          if (fixingRegFilter.excludeFutures && valueDate && new Date(valueDate) > today) continue
          if (fixingRegFilter.partyFilter === 'selected' && fixingRegFilter.partySearch.trim()) {
            if (!partyName.toLowerCase().includes(fixingRegFilter.partySearch.trim().toLowerCase())) continue
          }

          if (!lines.length) {
            if (!isAllMetalSelection) continue
            if (fixingRegFilter.excludeOpeningBalance && /opening/i.test(String(tx?.description || ''))) continue
            rows.push({
              rowId: `${tx._id}-0`,
              sourceType: 'Voucher',
              voucherNo,
              docDate,
              valueDate,
              branch,
              customerName: partyName,
              direction: tx.type === 'purchase' ? 'buy' : 'sell',
              metal: '',
              qty: 0,
              price: Number(tx?.voucherMeta?.metalRate || 0),
              amount: Number(tx?.amount || 0),
              dealStatus: tx?.status || 'draft',
              remarks: tx?.description || '',
              fixingMode: txFixingMode,
              groupKey: fixingRegFilter.groupBy === 'customer' ? partyName : fixingRegFilter.groupBy === 'branch' ? branch : fixingRegFilter.groupBy === 'valuedate' ? new Date(valueDate || docDate || Date.now()).toISOString().slice(0, 10) : 'All',
            })
            continue
          }

          lines.forEach((line, idx) => {
            const lineMetal = resolveVoucherLineMetalCode(line)
            if (!matchesSelectedMetal(lineMetal)) return
            const narration = String(line.narration || tx?.description || '')
            const pureWeightGram = Number(line.pureWeight || line.grossWeight || 0)
            const qtyOz = pureWeightGram > 0 ? (pureWeightGram / 31.1034768) : 0
            if (fixingRegFilter.excludeOpeningBalance && /opening/i.test(narration)) return
            rows.push({
              rowId: `${tx._id}-${idx}`,
              sourceType: 'Voucher',
              voucherNo,
              docDate,
              valueDate,
              branch,
              customerName: partyName,
              direction: tx.type === 'purchase' ? 'buy' : 'sell',
              metal: lineMetal || '',
              qty: qtyOz,
              price: Number(line.metalRate || tx?.voucherMeta?.metalRate || 0),
              amount: txFixingMode === 'Unfixing'
                ? resolveUnfixAmount(line)
                : Number(line.totalAmount || line.amountLC || tx?.amount || 0),
              dealStatus: tx?.status || 'draft',
              remarks: narration,
              fixingMode: txFixingMode,
              groupKey: fixingRegFilter.groupBy === 'customer' ? partyName : fixingRegFilter.groupBy === 'branch' ? branch : fixingRegFilter.groupBy === 'valuedate' ? new Date(valueDate || docDate || Date.now()).toISOString().slice(0, 10) : 'All',
            })
          })
        }

        for (const deal of directDeals) {
          if (deal.isDeleted) continue
          if (fixingRegFilter.status === 'final' && deal.status !== 'confirmed') continue
          const dealEntryType = String(deal.entryType || 'fixing').trim().toLowerCase()
          const dealFixingMode = ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfixing'].includes(dealEntryType) ? 'Unfixing' : 'Fixing'
          const dealDocDate = new Date(deal.docDate)
          const dealValueDate = new Date(deal.valueDate)
          if (fixingRegFilter.excludeOpeningBalance && /opening/i.test(deal.remarks || '')) continue
          if (fixingRegFilter.excludeFutures && dealValueDate > today) continue
          for (const line of deal.lineItems || []) {
            const lineMetal = resolveDirectDealMetalCode(line.metal || 'XAU')
            if (!matchesSelectedMetal(lineMetal)) continue
            const qtyOz = fixingRegConvertToOz(Number(line.qty || 0), line.stockCode || 'OZ')
            const partyName = line.customerName || '—'
            if (fixingRegFilter.partyFilter === 'selected' && fixingRegFilter.partySearch.trim()) {
              if (!partyName.toLowerCase().includes(fixingRegFilter.partySearch.trim().toLowerCase())) continue
            }
            const groupKey =
              fixingRegFilter.groupBy === 'customer' ? (partyName)
              : fixingRegFilter.groupBy === 'branch' ? (deal.branch || 'HO')
              : fixingRegFilter.groupBy === 'valuedate' ? new Date(deal.valueDate).toISOString().slice(0, 10)
              : 'All'
            rows.push({
              rowId: `${deal._id}-${line._id || Math.random().toString(36).slice(2, 8)}`,
              sourceType: 'Direct Deal',
              voucherNo: deal.docNo,
              docDate: dealDocDate,
              valueDate: dealValueDate,
              branch: deal.branch || 'HO',
              dealStatus: deal.status,
              remarks: deal.remarks || '',
              direction: line.direction,
              metal: lineMetal || 'XAU',
              qty: qtyOz,
              eqOz: Number(line.eqOz || 0),
              stockCode: (line.stockCode || 'OZ').toUpperCase(),
              price: Number(line.price || 0),
              amount: Number(line.amount || 0),
              customerName: partyName,
              customerCode: line.customerCode || '',
              fixingMode: dealFixingMode,
              groupKey,
            })
          }
        }

        rows.sort((a, b) => {
          const aVoucher = String(a.voucherNo || '')
          const bVoucher = String(b.voucherNo || '')
          const voucherCompare = aVoucher.localeCompare(bVoucher, undefined, { numeric: true, sensitivity: 'base' })
          if (voucherCompare !== 0) return voucherCompare
          return new Date(a.docDate || 0) - new Date(b.docDate || 0)
        })

        return rows
      }

      const resolveVoucherLineMetalCode = (line = {}) => {
        const raw = String(line.stockCode || line.productType || line.narration || '').trim().toUpperCase()
        if (!raw) return ''
        if (raw.includes('XAU') || raw.includes('GOLD')) return 'XAU'
        if (raw.includes('XAG') || raw.includes('SILVER')) return 'XAG'
        if (raw.includes('XPT') || raw.includes('PLATINUM')) return 'XPT'
        if (raw.includes('XPD') || raw.includes('PALLADIUM')) return 'XPD'
        return ''
      }

      const resolveDirectDealMetalCode = (value) => {
        const raw = String(value || '').trim().toUpperCase()
        if (!raw) return ''
        if (raw === 'XAU' || raw.includes('GOLD')) return 'XAU'
        if (raw === 'XAG' || raw.includes('SILV')) return 'XAG'
        if (raw === 'XPT' || raw.includes('PLAT')) return 'XPT'
        if (raw === 'XPD' || raw.includes('PALL')) return 'XPD'
        return raw
      }

      const openingRows = fixingRegFilter.excludeOpeningBalance
        ? []
        : buildRows({ txSales: openingSaleTxs, txPurchases: openingPurchaseTxs, directDeals: openingDeals })
      const rows = buildRows({ txSales: saleTxs, txPurchases: purchaseTxs, directDeals: deals })

      const openingQtyOz = openingRows.reduce((sum, row) => {
        const mode = String(row?.fixingMode || '').trim().toLowerCase()
        if (mode === 'unfixing') return sum
        const qty = Number(row.qty || 0)
        const sign = String(row.direction || '').toLowerCase() === 'buy' ? 1 : -1
        return sum + (sign * qty)
      }, 0)
      const getRowSignedAmount = (row) => {
        const amount = Number(row?.amount || 0)
        const mode = String(row?.fixingMode || '').trim().toLowerCase()
        if (mode === 'unfixing') return amount
        const sign = String(row?.direction || '').toLowerCase() === 'buy' ? 1 : -1
        return sign * amount
      }
      const openingValue = openingRows.reduce((sum, row) => {
        return sum + getRowSignedAmount(row)
      }, 0)

      setFixingRegOpening({ qtyOz: openingQtyOz, value: openingValue })
      setFixingRegResults(rows)
      setFixingRegShown(true)
    } catch (err) {
      setFixingRegError(err?.response?.data?.message || err.message || 'Failed to load fixing register data.')
    } finally {
      setFixingRegLoading(false)
    }
  }
  const getDepartmentBadgeStyle = (department) => {
    const deptValue = String(department || '').trim().toLowerCase()
    if (deptValue === 'finance') return { background: '#DBEAFE', color: '#1D4ED8' }
    if (deptValue === 'sales') return { background: '#FCE7F3', color: '#BE185D' }
    if (deptValue === 'operations') return { background: '#DCFCE7', color: '#166534' }
    if (deptValue === 'production') return { background: '#FEF3C7', color: '#92400E' }
    if (deptValue === 'hr') return { background: '#EDE9FE', color: '#6D28D9' }
    return { background: '#E5E7EB', color: '#374151' }
  }
  const branding = { ...DEFAULT_BRANDING, ...reportBranding }
  const brandingPreview = { ...DEFAULT_BRANDING, ...brandingForm }

  const buildBrandingLogoTag = async (brandingConfig, extraStyle = '') => {
    const logoAsset = await createLogoRenderAsset(
      brandingConfig.logoUrl,
      brandingConfig.logoWidth,
      brandingConfig.logoHeight,
      brandingConfig.logoFit
    )

    if (!logoAsset) return ''

    const width = clampBrandingDimension(brandingConfig.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
    const height = clampBrandingDimension(brandingConfig.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)
    return `<img src="${logoAsset}" alt="Company Logo" style="width:${width}px;height:${height}px;object-fit:fill;display:block;${extraStyle}" />`
  }

  const openPrintWindow = (title, bodyHtml) => {
    const w = window.open('', '_blank')
    if (!w) {
      setError('Popup blocked. Please allow popups for statement printing')
      return
    }

    w.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <style>
            body { font-family: Georgia, 'Times New Roman', serif; color: #111827; margin: 0; padding: 32px; }
            .sheet { max-width: 980px; margin: 0 auto; }
            .brandbar { height: 10px; background: var(--grad-brand); border-radius: 999px; margin-bottom: 14px; }
            .head { border-bottom: 2px solid #111827; padding-bottom: 12px; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: 700; margin: 0 0 4px; }
            .subtitle { color: #065F46; font-size: 12px; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin: 0 0 8px; }
            .meta { color: #4B5563; font-size: 12px; margin: 2px 0; }
            .section { margin-bottom: 20px; }
            .section-title { font-size: 16px; font-weight: 700; margin: 0 0 8px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #D1D5DB; padding: 7px 8px; text-align: left; }
            th { background: #F3F4F6; }
            .num { text-align: right; }
            .summary { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
            .card { border: 1px solid #D1D5DB; padding: 10px; }
            .card-label { color: #334155; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
            .card-value { font-size: 18px; font-weight: 700; margin-top: 4px; }
            .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; margin-top: 36px; }
            .sign-box { padding-top: 18px; border-top: 1px solid #475569; font-size: 12px; color: #374151; }
            .footer { margin-top: 18px; font-size: 11px; color: #334155; display: flex; justify-content: space-between; }
            @media print { body { padding: 0; } .sheet { max-width: none; } }
          </style>
        </head>
        <body>
          <div class="sheet">${bodyHtml}</div>
        </body>
      </html>
    `)
    w.document.close()
    w.focus()
    w.print()
  }

  const handleBrandingLogoFile = async (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setBrandingForm((prev) => ({ ...prev, logoUrl: String(reader.result || '') }))
    }
    reader.readAsDataURL(file)
  }

  const handleSaveBranding = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      const payload = {
        ...brandingForm,
        key: normalizeBrandingKey(brandingForm.key || selectedBrandingKey || DEFAULT_BRANDING.key),
        logoWidth: clampBrandingDimension(brandingForm.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260),
        logoHeight: clampBrandingDimension(brandingForm.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120),
      }
      const data = await erpAccountingAPI.updateReportBranding(token, payload)
      const nextBranding = { ...DEFAULT_BRANDING, ...(data.branding || {}) }
      setBrandingProfiles(data.profiles?.length ? data.profiles : DEFAULT_BRANDING_PROFILES)
      setSelectedBrandingKey(data.selectedKey || nextBranding.key || DEFAULT_BRANDING.key)
      setReportBranding(nextBranding)
      setBrandingForm(nextBranding)
      setError('')
      showNotification('✅ Report branding saved')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save report branding')
    } finally {
      setSaving(false)
    }
  }

  const handleSelectBrandingProfile = async (key) => {
    const nextKey = normalizeBrandingKey(key)
    setSelectedBrandingKey(nextKey)
    await loadReportBranding(nextKey)
  }

  const handleCreateBrandingDraft = () => {
    const timestamp = Date.now().toString().slice(-6)
    const nextDraft = {
      ...DEFAULT_BRANDING,
      key: `entity-${timestamp}`,
      entityName: 'New Entity',
      branchName: '',
      isDefault: false,
    }
    setBrandingProfiles((prev) => [
      ...prev.filter((profile) => profile.key !== nextDraft.key),
      { key: nextDraft.key, entityName: nextDraft.entityName, branchName: nextDraft.branchName, companyName: nextDraft.companyName, isDefault: false },
    ])
    setSelectedBrandingKey(nextDraft.key)
    setBrandingForm(nextDraft)
  }

  const buildEnquiryExportRows = () => {
    if (!accountEnquiryData) return []

    const now = new Date().toLocaleString()
    return [
      ['Generated At', now],
      ['Account Code', accountEnquiryData.account.accountCode || ''],
      ['Account Name', accountEnquiryData.account.accountName || ''],
      ['Account Type', accountEnquiryData.account.accountType || ''],
      ['Account Currency', accountEnquiryData.account.currency || ''],
      ['Debit Total', Number(accountEnquiryData.balances.debitTotal || 0).toFixed(2)],
      ['Credit Total', Number(accountEnquiryData.balances.creditTotal || 0).toFixed(2)],
      ['Net Direction', accountEnquiryData.balances.netDirection || ''],
      ['Net Balance', Number(accountEnquiryData.balances.absoluteNetBalance || 0).toFixed(2)],
      ['Rate Currency', accountEnquiryData.balances.rateCurrency || ''],
      ['Rate Currency Balance', Number(accountEnquiryData.balances.rateCurrencyBalance || 0).toFixed(2)],
      ['Gold Price', Number(accountEnquiryData.metals.goldPrice || 0).toFixed(4)],
      ['Silver Price', Number(accountEnquiryData.metals.silverPrice || 0).toFixed(4)],
      ['Selected Metal Unit', metalUnit],
      ['Gold Balance', Number(convertMetalBalanceByUnit(accountEnquiryData.metals.goldBalance || 0)).toFixed(6)],
      ['Silver Balance', Number(convertMetalBalanceByUnit(accountEnquiryData.metals.silverBalance || 0)).toFixed(6)],
    ]
  }

  const handleExportEnquiryExcel = () => {
    if (!accountEnquiryData) {
      setError('Load an account summary first to export')
      return
    }

    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`
    const rows = buildEnquiryExportRows()
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    link.href = url
    link.download = `account-summary-${accountEnquiryData.account.accountCode}-${stamp}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showNotification('✅ Excel file exported')
  }

  const handleExportEnquiryPdf = () => {
    if (!accountEnquiryData) {
      setError('Load an account summary first to export')
      return
    }

    const rows = buildEnquiryExportRows()
    const htmlRows = rows
      .map((row) => `<tr><td style=\"padding:8px;border:1px solid #D1D5DB;font-weight:600;\">${row[0]}</td><td style=\"padding:8px;border:1px solid #D1D5DB;\">${row[1]}</td></tr>`)
      .join('')

    const w = window.open('', '_blank')
    if (!w) {
      setError('Popup blocked. Please allow popups to export PDF')
      return
    }

    w.document.write(`
      <html>
        <head>
          <title>Account Summary ${accountEnquiryData.account.accountCode}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; color: #111827; }
            h1 { margin: 0 0 8px 0; font-size: 20px; }
            p { margin: 0 0 16px 0; color: #374151; }
            table { width: 100%; border-collapse: collapse; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Account Summary</h1>
          <p>${accountEnquiryData.account.accountCode} - ${accountEnquiryData.account.accountName}</p>
          <table>${htmlRows}</table>
        </body>
      </html>
    `)
    w.document.close()
    w.focus()
    w.print()
    showNotification('✅ PDF export opened for printing')
  }

  const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

  const downloadCsv = (rows, fileName) => {
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const downloadXlsx = async (rows, fileName, sheetName = 'Report') => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet(sheetName)
    ;(rows || []).forEach((row) => {
      worksheet.addRow(Array.isArray(row) ? row : [row])
    })
    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const buildTransactionExportPayload = () => {
    const scope = selectedTransactionIds.length
      ? transactions.filter((tx) => selectedTransactionIds.includes(tx._id))
      : transactions

    if (!scope.length) return null

    const stamp = new Date().toISOString().slice(0, 10)
    const rows = [
      ['Ops Dashboard ERP Transactions'],
      [`Generated`, new Date().toLocaleString()],
      [`Scope`, selectedTransactionIds.length ? 'Selected transactions' : 'Current visible transactions'],
      [],
      ['Date', 'Type', 'Party', 'Amount', 'Currency', 'Status', 'Description', 'Debit Account', 'Credit Account', 'Created By', 'Approved By', 'Posted By', 'Comments', 'Audit Events'],
    ]

    scope.forEach((tx) => {
      rows.push([
        tx.date ? new Date(tx.date).toLocaleString() : '',
        TRANSACTION_TYPE_LABELS[tx.type] || tx.type,
        tx.customerId?.name || tx.vendorId?.name || tx.inventoryItemId?.sku || '',
        Number(tx.amount || 0),
        tx.currency || 'USD',
        tx.status || '',
        tx.description || '',
        tx.debitAccountId ? `${tx.debitAccountId.accountCode} - ${tx.debitAccountId.accountName}` : '',
        tx.creditAccountId ? `${tx.creditAccountId.accountCode} - ${tx.creditAccountId.accountName}` : '',
        tx.createdBy?.name || '',
        tx.approvedBy?.name || '',
        tx.postedBy?.name || '',
        Number(tx.comments?.length || 0),
        Number(tx.auditTrail?.length || 0),
      ])
    })

    return { rows, fileBase: `transactions-${stamp}`, sheetName: 'Transactions' }
  }

  const handleExportTransactionsCsv = () => {
    const payload = buildTransactionExportPayload()
    if (!payload) {
      setError('No transactions available to export')
      return
    }
    downloadCsv(payload.rows, `${payload.fileBase}.csv`)
    showNotification('✅ Transactions CSV exported')
  }

  const handleExportTransactionsXlsx = async () => {
    const payload = buildTransactionExportPayload()
    if (!payload) {
      setError('No transactions available to export')
      return
    }
    await downloadXlsx(payload.rows, `${payload.fileBase}.xlsx`, payload.sheetName)
    showNotification('✅ Transactions XLSX exported')
  }

  const handleExportTransactionsPdf = () => {
    const scope = selectedTransactionIds.length
      ? transactions.filter((tx) => selectedTransactionIds.includes(tx._id))
      : transactions

    if (!scope.length) {
      setError('No transactions available to export')
      return
    }

    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.text('ERP Transactions Register', 36, 36)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 36, 54)
    doc.text(`Scope: ${selectedTransactionIds.length ? 'Selected transactions' : 'Current visible transactions'}`, 36, 68)

    autoTable(doc, {
      head: [['Date', 'Type', 'Party', 'Amount', 'Status', 'Description', 'Comments', 'Audit']],
      body: scope.map((tx) => [
        tx.date ? new Date(tx.date).toLocaleDateString() : '',
        TRANSACTION_TYPE_LABELS[tx.type] || tx.type,
        tx.customerId?.name || tx.vendorId?.name || tx.inventoryItemId?.sku || '',
        `${tx.currency || 'USD'} ${Number(tx.amount || 0).toLocaleString()}`,
        tx.status || '',
        tx.description || '',
        String(tx.comments?.length || 0),
        String(tx.auditTrail?.length || 0),
      ]),
      startY: 84,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [17, 24, 39] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 24, right: 24 },
    })

    doc.save(`transactions-${new Date().toISOString().slice(0, 10)}.pdf`)
    showNotification('✅ Transactions PDF exported')
  }

  const buildReportExportPayload = () => {
    if (!reports.trialBalance) return null
    const stamp = new Date().toISOString().slice(0, 10)
    const brandingRows = [
      [branding.entityName || DEFAULT_BRANDING.entityName, branding.branchName || ''],
      [branding.companyName || DEFAULT_BRANDING.companyName],
      [branding.legalName || ''],
      [branding.reportSubtitle || DEFAULT_BRANDING.reportSubtitle],
      [branding.reportFooter || DEFAULT_BRANDING.reportFooter],
      [],
    ]

    if (reportView === 'trial' || reportView === 'summary') {
      const rows = [...brandingRows, ['Account Code', 'Account Name', 'Type', 'Debit', 'Credit', 'Net']]
      ;(reports.trialBalance?.trialBalance || []).forEach((row) => {
        rows.push([row.accountCode, row.accountName, row.accountType, row.debit, row.credit, row.net])
      })
      return { rows, fileBase: `trial-balance-${stamp}`, sheetName: 'Trial Balance', successLabel: 'Trial balance' }
    }

    if (reportView === 'pnl') {
      const rows = [...brandingRows, ['Section', 'Account Code', 'Account Name', 'Amount']]
      ;(reports.profitLoss?.incomeBreakdown || []).forEach((row) => rows.push(['Income', row.accountCode, row.accountName, row.amount]))
      ;(reports.profitLoss?.expenseBreakdown || []).forEach((row) => rows.push(['Expense', row.accountCode, row.accountName, row.amount]))
      ;(reports.profitLoss?.monthlyComparison || []).forEach((row) => rows.push(['Monthly', row.label, 'Net Profit', row.netProfit]))
      return { rows, fileBase: `profit-loss-${stamp}`, sheetName: 'Profit Loss', successLabel: 'Profit & loss' }
    }

    if (reportView === 'balanceSheet') {
      const rows = [...brandingRows, ['Section', 'Account Code', 'Account Name', 'Balance']]
      ;(reports.balanceSheet?.assets || []).forEach((row) => rows.push(['Asset', row.accountCode, row.accountName, row.balance]))
      ;(reports.balanceSheet?.liabilities || []).forEach((row) => rows.push(['Liability', row.accountCode, row.accountName, row.balance]))
      ;(reports.balanceSheet?.equity || []).forEach((row) => rows.push(['Equity', row.accountCode, row.accountName, row.balance]))
      ;(reports.balanceSheet?.monthlyComparison || []).forEach((row) => rows.push(['Monthly', row.label, 'Working Capital', row.workingCapital]))
      return { rows, fileBase: `balance-sheet-${stamp}`, sheetName: 'Balance Sheet', successLabel: 'Balance sheet' }
    }

    if (reportView === 'dayBook') {
      const rows = [...brandingRows, ['Date', 'Type', 'Description', 'Debit Account', 'Credit Account', 'Amount', 'Currency']]
      ;(reports.dayBook?.entries || []).forEach((row) => {
        rows.push([
          new Date(row.date).toLocaleString(),
          row.referenceType,
          row.description || '',
          row.debitAccountId?.accountCode || '',
          row.creditAccountId?.accountCode || '',
          row.amount,
          row.currency || 'USD',
        ])
      })
      return { rows, fileBase: `day-book-${stamp}`, sheetName: 'Day Book', successLabel: 'Day book' }
    }

    if (reportView === 'outstanding') {
      const rows = [...brandingRows, ['Category', 'Name', 'Ledger Code', 'Outstanding', '0-30', '31-60', '61-90', '90+', 'Limit Exceeded']]
      ;(reports.customerOutstanding?.rows || []).forEach((row) => {
        rows.push(['Customer', row.customerName, row.ledgerAccount?.accountCode || '', row.outstanding, row.aging?.bucket0to30 || 0, row.aging?.bucket31to60 || 0, row.aging?.bucket61to90 || 0, row.aging?.bucket90Plus || 0, row.limitExceeded ? 'Yes' : 'No'])
      })
      ;(reports.vendorOutstanding?.rows || []).forEach((row) => {
        rows.push(['Vendor', row.vendorName, row.ledgerAccount?.accountCode || '', row.outstanding, '', '', '', '', row.outstandingType || ''])
      })
      return { rows, fileBase: `outstanding-${stamp}`, sheetName: 'Outstanding', successLabel: 'Outstanding' }
    }

    if (reportView === 'ledger') {
      const rows = [...brandingRows, ['Voucher', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Running Balance']]
      ledgerReportRows.forEach((row) => {
        rows.push([String(row.entryId || '').slice(-6).toUpperCase(), new Date(row.date).toLocaleString(), row.referenceType, row.description || '', row.debit || 0, row.credit || 0, row.runningBalance || 0])
      })
      return { rows, fileBase: `account-ledger-${stamp}`, sheetName: 'Ledger', successLabel: 'Ledger drilldown' }
    }

    if (reportView === 'forex') {
      const rows = [...brandingRows, ['Currency', 'Entries', 'Impact']]
      Object.entries(reports.forex?.byCurrency || {}).forEach(([currency, row]) => rows.push([currency, row.count || 0, row.impact || 0]))
      return { rows, fileBase: `forex-impact-${stamp}`, sheetName: 'Forex', successLabel: 'Forex report' }
    }

    return null
  }

  const handleExportReportCsv = () => {
    const payload = buildReportExportPayload()
    if (!payload) {
      setError('Load reports first before exporting')
      return
    }
    downloadCsv(payload.rows, `${payload.fileBase}.csv`)
    showNotification(`✅ ${payload.successLabel} CSV exported`)
  }

  const handleExportReportXlsx = async () => {
    const payload = buildReportExportPayload()
    if (!payload) {
      setError('Load reports first before exporting')
      return
    }
    await downloadXlsx(payload.rows, `${payload.fileBase}.xlsx`, payload.sheetName)
    showNotification(`✅ ${payload.successLabel} XLSX exported`)
  }

  const handlePrintCurrentReport = async () => {
    if (!reports.trialBalance) {
      setError('Load reports first before printing')
      return
    }

    const periodText = reports.trialBalance?.period?.startDate
      ? `${reports.trialBalance.period.startDate} to ${reports.trialBalance.period.endDate || reports.trialBalance.period.startDate}`
      : `As on ${new Date().toLocaleDateString()}`

    const logoMarkup = await buildBrandingLogoTag(branding, 'margin-bottom:10px;')

    const head = `
      <div class="brandbar"></div>
      <div class="head">
        ${logoMarkup}
        <p class="subtitle">${branding.companyName || DEFAULT_BRANDING.companyName}</p>
        <p class="title">ERP Financial Statement</p>
        <p class="meta">${branding.entityName || DEFAULT_BRANDING.entityName}${branding.branchName ? ` / ${branding.branchName}` : ''}</p>
        ${branding.legalName ? `<p class="meta">${branding.legalName}</p>` : ''}
        <p class="meta">${branding.reportSubtitle || DEFAULT_BRANDING.reportSubtitle} | Prepared for statutory / CA-style review</p>
        <p class="meta">Period: ${periodText}</p>
        <p class="meta">Generated: ${new Date().toLocaleString()}</p>
      </div>
    `

    const signatureBlock = `
      <div class="signatures">
        <div class="sign-box">${branding.preparedByTitle || DEFAULT_BRANDING.preparedByTitle}<br />${branding.preparedByName || user?.name || DEFAULT_BRANDING.preparedByName}</div>
        <div class="sign-box">${branding.reviewedByTitle || DEFAULT_BRANDING.reviewedByTitle}<br />${branding.reviewedByName || DEFAULT_BRANDING.reviewedByName}</div>
        <div class="sign-box">${branding.approvedByTitle || DEFAULT_BRANDING.approvedByTitle}<br />${branding.approvedByName || DEFAULT_BRANDING.approvedByName}</div>
      </div>
      <div class="footer">
        <span>${branding.companyName || DEFAULT_BRANDING.companyName} Reporting Suite</span>
        <span>${branding.reportFooter || DEFAULT_BRANDING.reportFooter}</span>
      </div>
    `

    let body = ''
    if (reportView === 'pnl') {
      body = `
        ${head}
        <div class="summary">
          <div class="card"><div class="card-label">Income</div><div class="card-value">${formatMoney(reports.profitLoss?.totalIncome)}</div></div>
          <div class="card"><div class="card-label">Expense</div><div class="card-value">${formatMoney(reports.profitLoss?.totalExpense)}</div></div>
          <div class="card"><div class="card-label">Net Profit</div><div class="card-value">${formatMoney(reports.profitLoss?.netProfit)}</div></div>
        </div>
        <div class="section"><p class="section-title">Income Breakdown</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Amount</th></tr></thead><tbody>${(reports.profitLoss?.incomeBreakdown || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td class="num">${formatMoney(row.amount)}</td></tr>`).join('')}</tbody></table></div>
        <div class="section"><p class="section-title">Expense Breakdown</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Amount</th></tr></thead><tbody>${(reports.profitLoss?.expenseBreakdown || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td class="num">${formatMoney(row.amount)}</td></tr>`).join('')}</tbody></table></div>
        ${signatureBlock}
      `
    } else if (reportView === 'balanceSheet') {
      const section = (title, rows) => `<div class="section"><p class="section-title">${title}</p><table><thead><tr><th>Code</th><th>Account</th><th class="num">Balance</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td class="num">${formatMoney(row.balance)}</td></tr>`).join('')}</tbody></table></div>`
      body = `
        ${head}
        <div class="summary">
          <div class="card"><div class="card-label">Assets</div><div class="card-value">${formatMoney(reports.balanceSheet?.totalAssets)}</div></div>
          <div class="card"><div class="card-label">Liabilities + Equity</div><div class="card-value">${formatMoney(reports.balanceSheet?.liabilitiesPlusEquity)}</div></div>
          <div class="card"><div class="card-label">Working Capital</div><div class="card-value">${formatMoney(reports.balanceSheet?.workingCapital)}</div></div>
        </div>
        ${section('Assets', reports.balanceSheet?.assets || [])}
        ${section('Liabilities', reports.balanceSheet?.liabilities || [])}
        ${section('Equity', reports.balanceSheet?.equity || [])}
        ${signatureBlock}
      `
    } else {
      body = `
        ${head}
        <div class="summary">
          <div class="card"><div class="card-label">Trial Debit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalDebit)}</div></div>
          <div class="card"><div class="card-label">Trial Credit</div><div class="card-value">${formatMoney(reports.trialBalance?.totalCredit)}</div></div>
          <div class="card"><div class="card-label">Difference</div><div class="card-value">${formatMoney(reports.trialBalance?.difference)}</div></div>
        </div>
        <div class="section"><p class="section-title">Trial Balance</p><table><thead><tr><th>Code</th><th>Account</th><th>Type</th><th class="num">Debit</th><th class="num">Credit</th><th class="num">Net</th></tr></thead><tbody>${(reports.trialBalance?.trialBalance || []).map((row) => `<tr><td>${row.accountCode}</td><td>${row.accountName}</td><td>${row.accountType}</td><td class="num">${formatMoney(row.debit)}</td><td class="num">${formatMoney(row.credit)}</td><td class="num">${formatMoney(row.net)}</td></tr>`).join('')}</tbody></table></div>
        ${signatureBlock}
      `
    }

    openPrintWindow('ERP Financial Statement', body)
    showNotification('✅ Statement print layout opened')
  }

  const handleExportReportPdf = async () => {
    if (!reports.trialBalance) {
      setError('Load reports first before exporting PDF')
      return
    }

    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' })
    const titleMap = {
      summary: 'ERP Financial Summary',
      trial: 'Trial Balance',
      pnl: 'Profit & Loss Statement',
      balanceSheet: 'Balance Sheet',
      dayBook: 'Day Book',
      outstanding: 'Outstanding Statement',
      forex: 'Forex Gain/Loss',
      ledger: `Ledger Drilldown ${selectedReportAccountCode ? `- ${selectedReportAccountCode}` : ''}`,
    }
    const title = titleMap[reportView] || 'ERP Report'
    const generatedAt = new Date().toLocaleString()

    const logoWidth = clampBrandingDimension(branding.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)
    const logoHeight = clampBrandingDimension(branding.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)
    const processedLogo = await createLogoRenderAsset(branding.logoUrl, logoWidth, logoHeight, branding.logoFit)

    doc.setFillColor(0, 104, 74)
    doc.rect(28, 24, 539, 10, 'F')
    if (processedLogo && String(processedLogo).startsWith('data:image/')) {
      try {
        doc.addImage(processedLogo, 'PNG', 540 - logoWidth, 36, logoWidth, logoHeight, undefined, 'FAST')
      } catch {
        // Ignore invalid embedded image data and continue with text branding.
      }
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(6, 95, 70)
    doc.text(String(branding.companyName || DEFAULT_BRANDING.companyName).toUpperCase(), 40, 52)
    doc.setFontSize(16)
    doc.setTextColor(17, 24, 39)
    doc.text(title, 40, 42)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    if (branding.legalName) doc.text(String(branding.legalName), 40, 64)
    doc.text(`${branding.entityName || DEFAULT_BRANDING.entityName}${branding.branchName ? ` / ${branding.branchName}` : ''}`, 40, branding.legalName ? 78 : 64)
    doc.text(String(branding.reportSubtitle || DEFAULT_BRANDING.reportSubtitle), 40, branding.legalName ? 92 : 78)
    doc.text(`Generated: ${generatedAt}`, 40, branding.legalName ? 106 : 92)

    let head = []
    let body = []

    if (reportView === 'trial' || reportView === 'summary') {
      head = [['Code', 'Account', 'Type', 'Debit', 'Credit', 'Net']]
      body = (reports.trialBalance?.trialBalance || []).map((row) => [
        row.accountCode,
        row.accountName,
        row.accountType,
        formatMoney(row.debit),
        formatMoney(row.credit),
        formatMoney(row.net),
      ])
    } else if (reportView === 'pnl') {
      head = [['Section', 'Code', 'Account', 'Amount']]
      body = [
        ...(reports.profitLoss?.incomeBreakdown || []).map((row) => ['Income', row.accountCode, row.accountName, formatMoney(row.amount)]),
        ...(reports.profitLoss?.expenseBreakdown || []).map((row) => ['Expense', row.accountCode, row.accountName, formatMoney(row.amount)]),
        ['Total', 'NET', 'Net Profit', formatMoney(reports.profitLoss?.netProfit)],
      ]
    } else if (reportView === 'balanceSheet') {
      head = [['Section', 'Code', 'Account', 'Balance']]
      body = [
        ...(reports.balanceSheet?.assets || []).map((row) => ['Asset', row.accountCode, row.accountName, formatMoney(row.balance)]),
        ...(reports.balanceSheet?.liabilities || []).map((row) => ['Liability', row.accountCode, row.accountName, formatMoney(row.balance)]),
        ...(reports.balanceSheet?.equity || []).map((row) => ['Equity', row.accountCode, row.accountName, formatMoney(row.balance)]),
      ]
    } else if (reportView === 'dayBook') {
      head = [['Date', 'Type', 'Description', 'Debit A/C', 'Credit A/C', 'Amount']]
      body = (reports.dayBook?.entries || []).map((row) => [
        new Date(row.date).toLocaleString(),
        row.referenceType,
        row.description || '',
        row.debitAccountId?.accountCode || '',
        row.creditAccountId?.accountCode || '',
        formatMoney(row.amount),
      ])
    } else if (reportView === 'outstanding') {
      head = [['Party', 'Name', 'Ledger', 'Outstanding', 'Age/Type']]
      body = [
        ...(reports.customerOutstanding?.rows || []).map((row) => ['Customer', row.customerName, row.ledgerAccount?.accountCode || '', formatMoney(row.outstanding), `90+: ${formatMoney(row.aging?.bucket90Plus || 0)}`]),
        ...(reports.vendorOutstanding?.rows || []).map((row) => ['Vendor', row.vendorName, row.ledgerAccount?.accountCode || '', formatMoney(row.outstanding), row.outstandingType || '']),
      ]
    } else if (reportView === 'forex') {
      head = [['Currency', 'Entries', 'Impact']]
      body = Object.entries(reports.forex?.byCurrency || {}).map(([currency, row]) => [currency, String(row.count || 0), formatMoney(row.impact)])
    } else if (reportView === 'ledger') {
      head = [['Voucher', 'Date', 'Type', 'Description', 'Debit', 'Credit', 'Running']]
      body = (ledgerReportRows || []).map((row) => [
        String(row.entryId || '').slice(-6).toUpperCase(),
        new Date(row.date).toLocaleString(),
        row.referenceType,
        row.description || '',
        formatMoney(row.debit),
        formatMoney(row.credit),
        formatMoney(row.runningBalance),
      ])
    }

    autoTable(doc, {
      head,
      body,
      startY: branding.legalName ? 122 : 108,
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [17, 24, 39] },
      alternateRowStyles: { fillColor: [249, 250, 251] },
      margin: { left: 28, right: 28 },
    })

    const finalY = doc.lastAutoTable?.finalY || 110
    const signatureY = Math.min(Math.max(finalY + 36, 680), 740)
    doc.setDrawColor(156, 163, 175)
    doc.line(40, signatureY, 180, signatureY)
    doc.line(220, signatureY, 360, signatureY)
    doc.line(400, signatureY, 540, signatureY)
    doc.setFontSize(9)
    doc.text(String(branding.preparedByTitle || DEFAULT_BRANDING.preparedByTitle), 40, signatureY + 14)
    doc.text(String(branding.preparedByName || user?.name || DEFAULT_BRANDING.preparedByName), 40, signatureY + 28)
    doc.text(String(branding.reviewedByTitle || DEFAULT_BRANDING.reviewedByTitle), 220, signatureY + 14)
    doc.text(String(branding.reviewedByName || DEFAULT_BRANDING.reviewedByName), 220, signatureY + 28)
    doc.text(String(branding.approvedByTitle || DEFAULT_BRANDING.approvedByTitle), 400, signatureY + 14)
    doc.text(String(branding.approvedByName || DEFAULT_BRANDING.approvedByName), 400, signatureY + 28)
    doc.setFontSize(8)
    doc.setTextColor(107, 114, 128)
    doc.text(`${branding.companyName || DEFAULT_BRANDING.companyName} Reporting Suite`, 40, signatureY + 52)
    doc.text(String(branding.reportFooter || DEFAULT_BRANDING.reportFooter), 420, signatureY + 52)

    const stamp = new Date().toISOString().slice(0, 10)
    doc.save(`${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${stamp}.pdf`)
    showNotification('✅ PDF exported')
  }

  const handleTrialAccountDrilldown = async (accountCode) => {
    const match = accounts.find((acc) => acc.accountCode === accountCode)
    if (!match?._id) return
    setSelectedReportAccountId(match._id)
    setSelectedReportAccountCode(match.accountCode)
    setReportView('ledger')
    await loadLedgerReport(match._id)
  }

  const handleReportAccountDrilldown = async (accountId, accountCode) => {
    if (!accountId) return
    setSelectedReportAccountId(String(accountId))
    setSelectedReportAccountCode(accountCode || '')
    setReportView('ledger')
    await loadLedgerReport(String(accountId))
  }

  const handleOpenVoucherSource = async (ledgerId) => {
    if (!ledgerId) return
    try {
      setVoucherSourceLoading(true)
      const data = await erpAccountingAPI.getTransactionSourceByLedger(token, ledgerId)
      setVoucherSource(data)
      setError('')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load voucher source')
    } finally {
      setVoucherSourceLoading(false)
    }
  }

  const handleJumpToTransaction = async (transactionId) => {
    if (!transactionId) return
    setSelectedTransactionId(transactionId)
    setVoucherSource(null)
    setActiveTab('transactions')
    try {
      await loadTransactions()
    } catch {
      // Errors are handled by loadTransactions state updates.
    }
    showNotification('✅ Jumped to linked transaction')
  }

  if (!canAccessERP) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: C.t2 }}>
        <p>⛔ ERP access restricted for your role.</p>
      </div>
    )
  }

  const handleCreateAccount = async (e) => {
    e.preventDefault()
    if (!form.accountName || !form.accountCode || !form.accountType) {
      setError('All fields required')
      return
    }
    try {
      await erpAccountingAPI.createAccount(token, form)
      setForm({})
      setShowForm(false)
      await loadAccounts()
      showNotification('✅ Account created successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create account')
    }
  }

  const handleCreateLedgerEntry = async (e) => {
    e.preventDefault()
    if (!ledgerForm.debitAccountId || !ledgerForm.creditAccountId || !ledgerForm.amount) {
      setError('Debit account, credit account, and amount are required')
      return
    }
    setSaving(true)
    try {
      await erpAccountingAPI.createLedgerEntry(token, {
        ...ledgerForm,
        amount: Number(ledgerForm.amount),
      })
      setLedgerForm({
        date: new Date().toISOString().slice(0, 10),
        mappingId: '',
        debitAccountId: '',
        creditAccountId: '',
        amount: '',
        description: '',
        referenceType: 'journal',
        currency: currencies.find((currency) => currency.baseCurrency)?.code || 'USD',
      })
      setShowLedgerForm(false)
      await Promise.all([loadLedger(), loadDashboard()])
      showNotification('✅ Ledger entry created')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create ledger entry')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCustomer = async (e) => {
    e.preventDefault()
    if (!customerForm.name) {
      setError('Customer name is required')
      return
    }
    setSaving(true)
    try {
      await erpAccountingAPI.createCustomer(token, {
        ...customerForm,
        openingBalance: Number(customerForm.openingBalance || 0),
        creditLimit: Number(customerForm.creditLimit || 0),
        paymentTermsDays: Number(customerForm.paymentTermsDays || 0),
      })
      setCustomerForm({
        name: '',
        phone: '',
        email: '',
        address: '',
        gstVat: '',
        openingBalance: '',
        creditLimit: '',
        paymentTermsDays: '',
        currency: currencies.find((currency) => currency.baseCurrency)?.code || 'USD',
        notes: '',
      })
      setShowCustomerForm(false)
      await Promise.all([loadCustomers(), loadAccounts()])
      showNotification('✅ Customer created successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create customer')
    } finally {
      setSaving(false)
    }
  }

  const openEditModal = (type, record) => {
    let formState = {}
    if (type === 'account') {
      formState = {
        accountName: record.accountName || '',
        description: record.description || '',
        currency: record.currency || 'USD',
        department: record.department || '',
      }
    }
    if (type === 'mapping') {
      formState = {
        mappingType: record.mappingType || '',
        debitAccountId: record.debitAccountId?._id || '',
        creditAccountId: record.creditAccountId?._id || '',
        department: record.department || '',
        description: record.description || '',
      }
    }
    if (type === 'currency') {
      formState = {
        code: record.code || '',
        name: record.name || '',
        symbol: record.symbol || '',
        exchangeRate: record.exchangeRate || 1,
        baseCurrency: Boolean(record.baseCurrency),
      }
    }
    if (type === 'customer') {
      formState = {
        name: record.name || '',
        phone: record.phone || '',
        email: record.email || '',
        address: record.address || '',
        gstVat: record.gstVat || '',
        creditLimit: record.creditLimit || 0,
        paymentTermsDays: record.paymentTermsDays || 0,
        currency: record.currency || 'USD',
        notes: record.notes || '',
      }
    }
    setEditState({ type, record, form: formState })
  }

  const closeEditModal = () => {
    setEditState({ type: '', record: null, form: {} })
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (editState.type === 'ledger') {
      handleSaveEditLedger()
      return
    }
    if (!editState.record || !editState.type) return
    setSaving(true)
    try {
      if (editState.type === 'account') {
        await erpAccountingAPI.updateAccount(token, editState.record._id, editState.form)
        await loadAccounts()
      }
      if (editState.type === 'mapping') {
        await erpAccountingAPI.updateMapping(token, editState.record._id, editState.form)
        await loadMappings()
      }
      if (editState.type === 'currency') {
        await erpAccountingAPI.updateCurrency(token, editState.record._id, {
          ...editState.form,
          exchangeRate: Number(editState.form.exchangeRate || 1),
        })
        await loadCurrencies()
      }
      if (editState.type === 'customer') {
        await erpAccountingAPI.updateCustomer(token, editState.record._id, {
          ...editState.form,
          creditLimit: Number(editState.form.creditLimit || 0),
          paymentTermsDays: Number(editState.form.paymentTermsDays || 0),
        })
        await loadCustomers()
      }
      closeEditModal()
      showNotification('✅ Changes saved successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateCurrency = async (e) => {
    e.preventDefault()
    if (!currencyForm.code || !currencyForm.name || !currencyForm.symbol) {
      setError('Currency code, name, and symbol are required')
      return
    }
    setSaving(true)
    try {
      await erpAccountingAPI.createCurrency(token, {
        ...currencyForm,
        exchangeRate: Number(currencyForm.exchangeRate || 1),
      })
      setCurrencyForm({ code: '', name: '', symbol: '', exchangeRate: 1, baseCurrency: false })
      setShowCurrencyForm(false)
      await loadCurrencies()
      showNotification('✅ Currency created successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create currency')
    } finally {
      setSaving(false)
    }
  }

  const handleSyncCurrencyMaster = async () => {
    setSaving(true)
    try {
      const response = await erpAccountingAPI.seedDefaultCurrencies(token)
      await loadCurrencies()
      showNotification(`✅ Currency master synced (${response.createdCount || 0} created, ${response.normalizedCount || 0} updated)`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to sync currency master')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateMapping = async (e) => {
    e.preventDefault()
    if (!mappingForm.mappingType || !mappingForm.debitAccountId || !mappingForm.creditAccountId) {
      setError('Mapping type, debit account, and credit account are required')
      return
    }
    setSaving(true)
    try {
      await erpAccountingAPI.createMapping(token, mappingForm)
      setMappingForm({ mappingType: '', debitAccountId: '', creditAccountId: '', department: '', description: '' })
      setShowMappingForm(false)
      await loadMappings()
      showNotification('✅ Mapping created successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to create mapping')
    } finally {
      setSaving(false)
    }
  }

  const handleEditAccount = (account) => openEditModal('account', account)

  const handleDeleteAccount = async (account) => {
    if (!window.confirm(`Deactivate account ${account.accountCode} - ${account.accountName}?`)) return
    try {
      await erpAccountingAPI.deleteAccount(token, account._id)
      await loadAccounts()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete account')
    }
  }

  const handleEditMapping = (mapping) => openEditModal('mapping', mapping)

  const handleDeleteMapping = async (mapping) => {
    if (!window.confirm(`Deactivate mapping ${mapping.mappingType}?`)) return
    try {
      await erpAccountingAPI.deleteMapping(token, mapping._id)
      await loadMappings()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete mapping')
    }
  }

  const handleEditCurrency = (currency) => openEditModal('currency', currency)

  const handleLedgerMappingChange = (mappingId) => {
    const selectedMapping = mappings.find((mapping) => mapping._id === mappingId)

    if (!mappingId || !selectedMapping) {
      setLedgerForm((prev) => ({
        ...prev,
        mappingId: '',
        debitAccountId: '',
        creditAccountId: '',
      }))
      return
    }

    setLedgerForm((prev) => ({
      ...prev,
      mappingId,
      debitAccountId: selectedMapping?.debitAccountId?._id || prev.debitAccountId,
      creditAccountId: selectedMapping?.creditAccountId?._id || prev.creditAccountId,
      description: selectedMapping && !prev.description ? selectedMapping.description || prev.description : prev.description,
    }))
  }

  const handleDeleteCurrency = async (currency) => {
    if (!window.confirm(`Delete currency ${currency.code}?`)) return
    try {
      await erpAccountingAPI.deleteCurrency(token, currency._id)
      await loadCurrencies()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete currency')
    }
  }

  const handleEditCustomer = (customer) => openEditModal('customer', customer)

  const handleDeleteCustomer = async (customer) => {
    if (!window.confirm(`Deactivate customer ${customer.name}?`)) return
    try {
      await erpAccountingAPI.deleteCustomer(token, customer._id)
      await loadCustomers()
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete customer')
    }
  }

  const handleEditLedger = (entry) => {
    setEditState({
      type: 'ledger',
      record: entry,
      form: {
        date: new Date(entry.date).toISOString().slice(0, 10),
        debitAccountId: entry.debitAccountId?._id || '',
        creditAccountId: entry.creditAccountId?._id || '',
        amount: entry.amount,
        description: entry.description,
        referenceType: entry.referenceType,
        currency: entry.currency,
      },
    })
  }

  const handleReverseLedger = async (entry) => {
    if (!window.confirm(`Reverse ledger entry ${entry.referenceType} (${entry.amount})? This will create an offsetting entry.`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.deleteLedgerEntry(token, entry._id)
      await loadLedger()
      setError('')
      showNotification('✅ Entry reversed successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to reverse entry')
    } finally {
      setSaving(false)
    }
  }

  const handlePermanentDeleteLedger = async (entry) => {
    if (!window.confirm(`Delete ledger entry ${entry.referenceType} (${entry.amount}) permanently?`)) return
    try {
      setSaving(true)
      await erpAccountingAPI.permanentDeleteLedgerEntry(token, entry._id)
      await loadLedger()
      setError('')
      showNotification('✅ Entry deleted successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete entry')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEditLedger = async () => {
    if (!editState.form.debitAccountId || !editState.form.creditAccountId || !editState.form.amount) {
      setError('All fields required')
      return
    }
    if (editState.form.debitAccountId === editState.form.creditAccountId) {
      setError('Debit and Credit accounts must be different')
      return
    }
    try {
      setSaving(true)
      await erpAccountingAPI.updateLedgerEntry(token, editState.record._id, editState.form)
      await loadLedger()
      setEditState({ type: '', record: null, form: {} })
      setError('')
      showNotification('✅ Entry updated successfully')
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to update entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '1.5rem' }}>
      {/* <h2 style={{ marginBottom: '1.5rem', color: C.t1, fontSize: '1.5rem', fontWeight: '700' }}>
        📊 ERP Accounting System
      </h2> */}

      {error && <div style={{ background: C.danger, color: '#FFFFFF', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{error}</div>}
      {success && <div style={{ background: C.s1, color: '#FFFFFF', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{success}</div>}

      {/* TAB NAVIGATION */}
      {(() => {
        const visibleTabs = [
          'dashboard',
          ...(canViewAccounts ? ['accounts', 'mappings', 'settings', 'currencies'] : []),
          ...(canViewBalanceEnquiry ? ['enquiry'] : []),
          ...(canViewCustomers ? ['customers'] : []),
          ...(canViewCustomers ? ['customer-margin'] : []),
          ...(canViewLedger ? ['ledger'] : []),
          ...(canAccessTransactions ? ['transactions'] : []),
          ...(canAccessReports ? ['reports'] : []),
          ...(canAccessVendors ? ['vendors'] : []),
          ...(canAccessInventory ? ['inventory'] : []),
          ...(canAccessVouchers ? ['vouchers'] : []),
          ...(canAccessDirectDeals ? ['direct-deals'] : []),
          ...(canAccessDirectDeals ? ['fixing-register'] : []),
        ]
        const uniqueTabs = Array.from(new Set(visibleTabs))
        return (
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem', paddingBottom: '1rem', flexWrap: 'wrap' , display:"none" }}>
        {uniqueTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.625rem 1.25rem',
              background: activeTab === tab ? C.s1 : 'transparent',
              color: activeTab === tab ? '#FFFFFF' : '#1F1F1F',
              border: activeTab === tab ? 'none' : `1px solid #D1D5DB`,
              borderRadius: '0.375rem',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? '700' : '600',
              textTransform: 'capitalize',
              fontSize: '0.9rem',
              transition: 'all 0.25s ease',
              boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
              {tab === 'enquiry'
                ? t('accountSummary')
                : tab === 'transactions'
                  ? t('transactions')
                  : tab === 'reports'
                    ? t('reports')
                    : tab === 'vendors'
                      ? t('vendors')
                      : tab === 'currencies'
                        ? 'Currency Master'
                      : tab === 'customer-margin'
                        ? 'Customer Margin'
                      : tab === 'inventory'
                        ? t('inventory')
                        : tab === 'vouchers'
                          ? `💳 ${t('vouchers')}`
                          : tab === 'direct-deals'
                            ? t('directDeals')
                          : tab === 'fixing-register'
                            ? 'Fixing Register'
                          : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>
        )
      })()}

      {/* DASHBOARD TAB */}
      {activeTab === 'dashboard' && (
        <div>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>📊 My Dashboard</h3>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: C.inkSoft }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                {' · '}{dashWidgets.length} widget{dashWidgets.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {/* Arrange and Customize buttons only */}
              <button
                onClick={() => setDashEditMode(v => !v)}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '600', border: `1px solid ${dashEditMode ? C.s1 : '#D1D5DB'}`, borderRadius: '0.375rem', background: dashEditMode ? '#DCFCE7' : C.p1, color: dashEditMode ? C.s2 : C.inkSoft, cursor: 'pointer' }}
              >
                ⠿ {dashEditMode ? 'Done' : 'Arrange'}
              </button>
              <button
                onClick={() => { setDashPickSelected([...dashWidgets]); setDashCustomizeOpen(true) }}
                style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', fontWeight: '600', border: 'none', borderRadius: '0.375rem', background: C.s1, color: '#fff', cursor: 'pointer' }}
              >
                + Customize
              </button>
            </div>
          </div>

          {/* Edit mode banner */}
          {dashEditMode && (
            <div style={{ background: 'linear-gradient(90deg,#DCFCE7,#F0FDF4)', border: `1px solid #A7F3D0`, borderRadius: '0.5rem', padding: '0.6rem 1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.82rem', color: C.s2 }}>
              <span style={{ fontSize: '1rem' }}>↕</span>
              <span>Drag widgets to rearrange. Click <strong>✕</strong> to remove a widget. Click <strong>Done</strong> when finished.</span>
            </div>
          )}

          {/* Widget grid */}
          {dashWidgets.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem 1rem', background: C.p2, borderRadius: '0.75rem' }}>
              <p style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📊</p>
              <p style={{ color: C.inkSoft, fontSize: '0.9rem', marginBottom: '1rem' }}>No widgets on your dashboard yet.</p>
              <button
                onClick={() => { setDashPickSelected([...dashWidgets]); setDashCustomizeOpen(true) }}
                style={{ padding: '0.5rem 1.25rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem' }}
              >
                + Add Widgets
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.875rem' }}>
              {dashWidgets.map((wid, idx) => {
                const meta = ERP_DASH_ALL_WIDGETS.find(w => w.id === wid)
                if (!meta) return null
                const rawCols = dashWidgetCols[wid] ?? meta.cols
                const span = Math.min(Math.max(Number(rawCols) || 1, 1), 3)
                const isHovered = dashHoveredWid === wid
                const edgeToEdge = wid === 'margins' || wid === 'apar'
                return (
                  <div
                    key={wid}
                    draggable={dashEditMode}
                    onDragStart={() => { dashDragSrc.current = idx }}
                    onDragOver={e => e.preventDefault()}
                    onDrop={() => {
                      const src = dashDragSrc.current
                      if (src == null || src === idx) return
                      const next = [...dashWidgets]
                      next.splice(src, 1)
                      next.splice(idx, 0, wid)
                      setDashWidgets(next)
                      dashDragSrc.current = null
                    }}
                    onMouseEnter={() => setDashHoveredWid(wid)}
                    onMouseLeave={() => setDashHoveredWid(null)}
                    style={{
                      gridColumn: `span ${span}`,
                      background: C.p1,
                      borderRadius: '12px',
                      overflow: 'hidden',
                      border: dashEditMode ? `2px dashed #A7F3D0` : `1px solid #E5E7EB`,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                      cursor: dashEditMode ? 'grab' : 'default',
                      position: 'relative',
                    }}
                  >
                    {/* Drag handle overlay — visible on hover in edit mode */}
                    {dashEditMode && isHovered && (
                      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', fontSize: '1.75rem', color: 'rgba(0,0,0,0.18)', pointerEvents: 'none', userSelect: 'none', zIndex: 2 }}>⠿</div>
                    )}
                    {/* Widget header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 13px', borderBottom: '1px solid #E5E7EB' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: 28, height: 28, borderRadius: '6px', background: meta.color || '#E8F5EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', flexShrink: 0 }}>
                          {meta.icon}
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: C.ink }}>{meta.label}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', opacity: (isHovered || dashEditMode) ? 1 : 0, transition: 'opacity 0.15s' }}>
                        {meta.viewTab && (
                          <button
                            onClick={() => setActiveTab(meta.viewTab)}
                            style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '2px 7px', borderRadius: '5px', border: '1px solid #A7F3D0', background: '#F0FDF4', fontSize: '0.68rem', fontWeight: '500', color: C.s2, cursor: 'pointer' }}
                          >→ View</button>
                        )}
                        <button
                          onClick={() => {
                            const cur = dashWidgetCols[wid] ?? meta.cols
                            const next = cur >= 3 ? 1 : Number(cur) + 1
                            setDashWidgetCols(prev => ({ ...prev, [wid]: next }))
                          }}
                          title="Resize widget"
                          style={{ padding: '2px 6px', border: '1px solid #E5E7EB', borderRadius: '5px', background: '#F9FAFB', cursor: 'pointer', fontSize: '0.75rem', color: C.inkSoft, lineHeight: 1 }}
                        >⤢</button>
                        <button
                          onClick={() => setDashWidgets(prev => prev.filter(w => w !== wid))}
                          style={{ background: 'none', border: 'none', color: C.danger, cursor: 'pointer', fontSize: '0.85rem', padding: '0 2px', lineHeight: 1 }}
                        >✕</button>
                      </div>
                    </div>
                    {/* Widget body */}
                    {edgeToEdge
                      ? <div style={{ fontSize: '0.82rem', color: C.inkSoft }}>
                          {renderERP_DashWidget(wid, dashboard, dashChatMessages, (tab) => setActiveTab(tab), onNavigateMain)}
                        </div>
                      : <div style={{ padding: '12px 13px', fontSize: '0.82rem', color: C.inkSoft }}>
                          {renderERP_DashWidget(wid, dashboard, dashChatMessages, (tab) => setActiveTab(tab), onNavigateMain)}
                        </div>
                    }
                  </div>
                )
              })}
            </div>
          )}

          {/* Customize modal */}
          {dashCustomizeOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: '#fff', borderRadius: '0.75rem', width: '560px', maxWidth: '95vw', maxHeight: '80vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: 0, color: C.ink, fontSize: '1rem', fontWeight: '700' }}>Customize Dashboard</h4>
                    <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: C.inkSoft }}>{dashPickSelected.length} widget{dashPickSelected.length !== 1 ? 's' : ''} selected</p>
                  </div>
                  <button onClick={() => setDashCustomizeOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.1rem', color: C.inkSoft, cursor: 'pointer' }}>✕</button>
                </div>
                <div style={{ padding: '1rem 1.5rem', overflowY: 'auto', flex: 1 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                    {ERP_DASH_ALL_WIDGETS.map(w => {
                      const on = dashPickSelected.includes(w.id)
                      return (
                        <div
                          key={w.id}
                          onClick={() => setDashPickSelected(prev => on ? prev.filter(x => x !== w.id) : [...prev, w.id])}
                          style={{ padding: '0.75rem', borderRadius: '0.5rem', border: `2px solid ${on ? C.s1 : '#E5E7EB'}`, background: on ? '#F0FDF4' : '#FAFAFA', cursor: 'pointer', display: 'flex', gap: '0.625rem', alignItems: 'flex-start' }}
                        >
                          <span style={{ fontSize: '1.1rem', flexShrink: 0 }}>{w.icon}</span>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '600', color: C.ink }}>{w.label}</p>
                            <p style={{ margin: '0.15rem 0 0', fontSize: '0.72rem', color: C.inkSoft }}>{w.desc}</p>
                          </div>
                          {on && <span style={{ marginLeft: 'auto', color: C.s1, fontSize: '0.9rem', flexShrink: 0 }}>✓</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #F3F4F6', display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button onClick={() => setDashCustomizeOpen(false)} style={{ padding: '0.5rem 1rem', background: C.p2, color: C.inkSoft, border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}>Cancel</button>
                  <button
                    onClick={() => {
                      const ordered = [...dashPickSelected].sort((a, b) => {
                        const ai = dashWidgets.indexOf(a), bi = dashWidgets.indexOf(b)
                        if (ai !== -1 && bi !== -1) return ai - bi
                        if (ai !== -1) return -1
                        if (bi !== -1) return 1
                        return ERP_DASH_ALL_WIDGETS.findIndex(w => w.id === a) - ERP_DASH_ALL_WIDGETS.findIndex(w => w.id === b)
                      })
                      setDashWidgets(ordered)
                      setDashCustomizeOpen(false)
                    }}
                    style={{ padding: '0.5rem 1.25rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600' }}
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* CHART OF ACCOUNTS TAB */}
      {activeTab === 'accounts' && (
        <div>
          <div style={{ marginBottom: '1.25rem' }}>
            <h3 style={{ color: C.ink, fontSize: '1.25rem', fontWeight: '700', margin: 0 }}>Chart of Accounts</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: C.inkSoft }}>
              Hierarchical account tree — right-click any account for more options.
            </p>
          </div>
          <ChartOfAccountsTree canManageAccounts={canManageAccounts} onOpenSummary={handleOpenAccountSummaryFromTree} />
        </div>
      )}

      {/* LEDGER TAB */}
      {activeTab === 'customers' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Customers</h3>
            {canManageCustomers && (
              <button
                onClick={() => setShowCustomerForm(!showCustomerForm)}
                style={{
                  padding: '0.5rem 1rem',
                  background: C.s1,
                  color: C.t1,
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                + Add Customer
              </button>
            )}
          </div>

          {showCustomerForm && (
            <form onSubmit={handleCreateCustomer} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <input placeholder="Customer Name" value={customerForm.name} onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Phone" value={customerForm.phone} onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Email" value={customerForm.email} onChange={(e) => setCustomerForm({ ...customerForm, email: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Address" value={customerForm.address} onChange={(e) => setCustomerForm({ ...customerForm, address: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="GST/VAT" value={customerForm.gstVat} onChange={(e) => setCustomerForm({ ...customerForm, gstVat: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input type="number" step="0.01" placeholder="Opening Balance" value={customerForm.openingBalance} onChange={(e) => setCustomerForm({ ...customerForm, openingBalance: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input type="number" step="0.01" placeholder="Credit Limit" value={customerForm.creditLimit} onChange={(e) => setCustomerForm({ ...customerForm, creditLimit: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input type="number" placeholder="Payment Terms (Days)" value={customerForm.paymentTermsDays} onChange={(e) => setCustomerForm({ ...customerForm, paymentTermsDays: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Currency (e.g. USD)" value={customerForm.currency} onChange={(e) => setCustomerForm({ ...customerForm, currency: e.target.value.toUpperCase() })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />
              <input placeholder="Notes" value={customerForm.notes} onChange={(e) => setCustomerForm({ ...customerForm, notes: e.target.value })} style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.75rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }} />

              <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                {saving ? 'Saving...' : 'Create Customer'}
              </button>
              <button type="button" onClick={() => setShowCustomerForm(false)} style={{ padding: '0.5rem 1rem', background: C.p1, color: C.t2, border: `1px solid ${C.t2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </form>
          )}

          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Phone</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Email</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>GST/VAT</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>Opening</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>Outstanding</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>0-30</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>31-60</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>61-90</th>
                  <th style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>90+</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Debtor A/C</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr key={customer._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                    <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '600' }}>{customer.name}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.phone || '-'}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.email || '-'}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.gstVat || '-'}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.openingBalance || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: Number(customer.outstandingBalance || 0) > 0 ? C.s1 : C.t2, fontWeight: '600' }}>{Number(customer.outstandingBalance || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.aging?.bucket0to30 || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.aging?.bucket31to60 || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t2 }}>{Number(customer.aging?.bucket61to90 || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: Number(customer.aging?.bucket90Plus || 0) > 0 ? '#F59E0B' : C.t2, fontWeight: Number(customer.aging?.bucket90Plus || 0) > 0 ? '700' : '400' }}>{Number(customer.aging?.bucket90Plus || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{customer.ledgerAccountId?.accountCode || '-'}{customer.ledgerAccountId?.accountName ? ` - ${customer.ledgerAccountId.accountName}` : ''}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>
                      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <button onClick={() => handleEditCustomer(customer)} style={{ padding: '0.35rem 0.7rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleDeleteCustomer(customer)} style={{ padding: '0.35rem 0.7rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {customers.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No customers added yet.</p>}
        </div>
      )}

      {/* CUSTOMER MARGIN TAB */}
      {activeTab === 'customer-margin' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.9rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button
                onClick={() => setActiveTab('dashboard')}
                title="Back to ERP Dashboard"
                style={{ background: 'none', border: '1px solid #A7F3D0', borderRadius: '0.4rem', padding: '0.3rem 0.5rem', cursor: 'pointer', fontSize: '1rem', color: '#1a6647', display: 'flex', alignItems: 'center', lineHeight: 1, fontWeight: '700' }}
              >←</button>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Customer Margin</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <select
                value={customerMarginSort}
                onChange={(e) => setCustomerMarginSort(e.target.value)}
                style={{ padding: '0.48rem 0.62rem', border: '1px solid #CBD5E1', borderRadius: '0.45rem', background: '#FFFFFF', color: C.ink, fontSize: '0.82rem' }}
              >
                <option value="margin-desc">Sort: Margin % (High to Low)</option>
                <option value="margin-asc">Sort: Margin % (Low to High)</option>
                <option value="name-asc">Sort: Name (A-Z)</option>
              </select>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.38rem', color: C.inkSoft, fontSize: '0.82rem', fontWeight: '600' }}>
                <input
                  type="checkbox"
                  checked={customerMarginCompactView}
                  onChange={(e) => setCustomerMarginCompactView(e.target.checked)}
                />
                Fixed List Area
              </label>
              <input
                placeholder="Search customer"
                value={customerMarginSearch}
                onChange={(e) => setCustomerMarginSearch(e.target.value)}
                style={{ width: 'min(320px, 100%)', padding: '0.5rem 0.65rem', border: '1px solid #CBD5E1', borderRadius: '0.45rem', background: '#FFFFFF', color: C.ink }}
              />
            </div>
          </div>

          <div style={{ border: '1px solid #BFD0E5', borderRadius: '0.45rem', overflow: 'hidden', background: '#FFFFFF' }}>
            <div style={{ background: 'linear-gradient(180deg, #E9F3FF 0%, #D7E9FF 100%)', borderBottom: '1px solid #BFD0E5', padding: '0.55rem 0.8rem', fontSize: '1rem', fontWeight: '700', color: '#1E3A8A' }}>
              Customer Margin
            </div>
            <div style={{ overflowX: 'auto', overflowY: customerMarginCompactView ? 'auto' : 'visible', maxHeight: customerMarginCompactView ? '380px' : 'none' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', fontSize: '0.88rem' }}>
                <colgroup>
                  <col style={{ width: '46%' }} />
                  <col style={{ width: '24%' }} />
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '16%' }} />
                </colgroup>
                <thead>
                  <tr style={{ background: '#F8FAFC', borderBottom: '1px solid #D9E2EC' }}>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'left', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700' }}>Customer Name</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Equity</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', borderRight: '1px solid #DEE7F2', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700' }}>Status</th>
                    <th style={{ position: 'sticky', top: 0, zIndex: 2, background: '#F3F7FC', padding: '0.46rem 0.68rem', textAlign: 'right', color: '#111827', fontSize: '0.8rem', letterSpacing: '0.02em', fontWeight: '700', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {customerMarginRows.map((row, index) => {
                    const isNegative = row.status === 'NEGATIVE'
                    const valueColor = isNegative ? '#DC2626' : '#1D4ED8'
                    return (
                      <tr
                        key={row.id || index}
                        onClick={(event) => handleCustomerMarginRowContextMenu(event, row)}
                        onContextMenu={(event) => handleCustomerMarginRowContextMenu(event, row)}
                        title="Click or right click to open details submenu"
                        style={{ borderBottom: '1px solid #EEF2F7', background: index % 2 === 0 ? '#FFFFFF' : '#FCFDFF', height: '30px', cursor: 'context-menu' }}
                      >
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', color: valueColor, fontWeight: '600', fontSize: '0.85rem', lineHeight: 1.08, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.customerName}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: valueColor, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginEquity(row)}</td>
                        <td style={{ borderRight: '1px solid #EEF3F9', padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: valueColor, fontWeight: '700', fontSize: '0.8rem', letterSpacing: '0.035em', lineHeight: 1.08 }}>{row.status}</td>
                        <td style={{ padding: '0.34rem 0.68rem', verticalAlign: 'middle', textAlign: 'right', color: valueColor, fontWeight: '700', fontSize: '0.84rem', lineHeight: 1.08, fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPercent(row.marginPercent)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {customerMarginContextMenu.open && customerMarginContextMenu.row && (
            <div
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
              style={{
                position: 'fixed',
                top: `${customerMarginContextMenu.y}px`,
                left: `${customerMarginContextMenu.x}px`,
                width: '292px',
                background: '#FDFEFE',
                border: '1px solid #9DB5D5',
                boxShadow: '0 10px 24px rgba(15, 23, 42, 0.2)',
                zIndex: 2000,
                borderRadius: '0.2rem',
                overflow: 'hidden',
              }}
            >
              <div style={{ padding: '0.35rem 0.5rem', borderBottom: '1px solid #D7E3F3', background: '#E7EFFA', color: '#15407E', fontSize: '0.76rem', fontWeight: '700', letterSpacing: '0.03em' }}>
                CUSTOMER MARGIN SUB MENU
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '132px 1fr', fontSize: '0.78rem' }}>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Account Code</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827' }}>{customerMarginContextMenu.row.accountCode || '-'}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Description</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{customerMarginContextMenu.row.description || '-'}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Excess/Short</div>
                <div style={{ padding: '0.34rem 0.52rem', borderBottom: '1px solid #E8EEF7', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginExcessShort(customerMarginContextMenu.row)}</div>
                <div style={{ padding: '0.34rem 0.52rem', borderRight: '1px solid #E8EEF7', color: '#1E3A8A', fontWeight: '700' }}>Margin</div>
                <div style={{ padding: '0.34rem 0.52rem', color: '#111827', fontFamily: 'Consolas, "Courier New", monospace', fontVariantNumeric: 'tabular-nums' }}>{formatCustomerMarginPercent(customerMarginContextMenu.row.marginPercent)}</div>
              </div>
            </div>
          )}

          <div style={{ marginTop: '0.75rem', color: C.inkSoft, fontSize: '0.82rem' }}>
            Equity shows signed exposure: positive values are favorable, negative values are payable.
          </div>

          {customerMarginRows.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No customers available for margin view.</p>}
        </div>
      )}

      {/* FIXING POSITION REGISTER TAB */}
      {activeTab === 'fixing-register' && (
        <div>
          {/* Back to ERP Dashboard */}
          <button
            onClick={() => setActiveTab('dashboard')}
            title="Back to ERP Dashboard"
            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem', width: '2rem', height: '2rem', borderRadius: '0.4rem', border: '1px solid #CBD5E1', background: '#F8FAFC', color: '#1E3A5F', fontSize: '1rem', cursor: 'pointer' }}
          >←</button>
          {/* Filter card */}
          <div style={{ borderRadius: '0.6rem', overflow: 'hidden', border: '1px solid #CBD5E1', boxShadow: '0 2px 10px rgba(0,0,0,0.08)', maxWidth: '860px', marginBottom: '1.8rem', position: 'relative', transform: `translate(${fixingRegPanelOffset.x}px, ${fixingRegPanelOffset.y}px)`, transition: fixingRegPanelDrag.active ? 'none' : 'transform 120ms ease-out' }}>
            {/* Header */}
            <div onMouseDown={beginFixingRegPanelDrag} style={{ background: 'var(--purple)', padding: '0.85rem 1.2rem', display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'sticky', top: 0, zIndex: 3, cursor: fixingRegPanelDrag.active ? 'grabbing' : 'grab', userSelect: 'none' }}>
              <span style={{ fontSize: '1rem', fontWeight: '700', color: '#FFFFFF', letterSpacing: '0.03em' }}>📊 Fixing position register</span>
              <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.7)', fontSize: '0.73rem', letterSpacing: '0.04em' }}>drag</span>
            </div>
            {/* Form body */}
            <div style={{ background: '#F8FAFC', padding: '1.25rem 1.2rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {/* Row 1: Metal | Quantity | Rate */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                {[
                  { label: 'Metal', field: 'metalType', opts: fixingRegisterStockTypeOptions.map((option) => [option.value, option.label]) },
                  { label: 'Quantity', field: 'quantityUnit', opts: [['GOZ', 'GOZ — Troy Oz'], ['GRAM', 'Gram'], ['KG', 'KG'], ['TOLA', 'Tola']] },
                  { label: 'Rate', field: 'rateUnit', opts: [['GOZ', 'GOZ — per Troy Oz'], ['GRAM', 'per Gram'], ['KG', 'per KG'], ['TOLA', 'per Tola']] },
                ].map(({ label, field, opts }) => {
                  const resolvedOpts = field === 'metalType' && !opts.length
                    ? [
                      ['ALL::all', 'All Metals'],
                      ['XAU::fallback-gold', 'Gold (XAU)'],
                      ['XAG::fallback-silver', 'Silver (XAG)'],
                      ['OTHER::fallback-other', 'Other Metals'],
                    ]
                    : opts
                  return (
                  <div key={field}>
                    <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
                    <select
                      value={fixingRegFilter[field]}
                      onChange={(e) => setFixingRegFilter(f => ({ ...f, [field]: e.target.value }))}
                      style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem' }}
                      disabled={false}
                    >
                      {resolvedOpts.map(([v, lbl]) => <option key={v} value={v}>{lbl}</option>)}
                    </select>
                  </div>
                )})}
              </div>
              {/* Row 2: Order By | From | To */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem' }}>
                <div>
                  <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order By</label>
                  <select
                    value={fixingRegFilter.orderBy}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, orderBy: e.target.value }))}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem' }}
                  >
                    <option value="voucherNo">Voucher Number</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>From Date</label>
                  <input type="date" value={fixingRegFilter.fromDate}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, fromDate: e.target.value }))}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem', boxSizing: 'border-box' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>To Date</label>
                  <input type="date" value={fixingRegFilter.toDate}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, toDate: e.target.value }))}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
              {/* Row 3: Group By */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: '0.75rem', alignItems: 'flex-end' }}>
                <div>
                  <label style={{ display: 'block', color: '#64748B', fontSize: '0.72rem', marginBottom: '0.28rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Group By</label>
                  <select
                    value={fixingRegFilter.groupBy}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, groupBy: e.target.value }))}
                    style={{ width: '100%', padding: '0.42rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.84rem' }}
                  >
                    <option value="none">— None —</option>
                    <option value="customer">Customer</option>
                    <option value="branch">Branch</option>
                    <option value="valuedate">Value Date</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', paddingBottom: '0.12rem' }}>
                  {[['all', 'All'], ['selected', 'Selected']].map(([v, lbl]) => (
                    <label key={v} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: '#374151', fontSize: '0.83rem', cursor: 'pointer' }}>
                      <input type="radio" name="fixingPartyFilter" value={v} checked={fixingRegFilter.partyFilter === v}
                        onChange={() => setFixingRegFilter(f => ({ ...f, partyFilter: v }))}
                        style={{ accentColor: '#2563EB' }}
                      />
                      {lbl}
                    </label>
                  ))}
                  {fixingRegFilter.partyFilter === 'selected' && (
                    <input
                      type="text"
                      placeholder="Search party…"
                      value={fixingRegFilter.partySearch}
                      onChange={(e) => setFixingRegFilter(f => ({ ...f, partySearch: e.target.value }))}
                      style={{ flex: 1, padding: '0.38rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.83rem' }}
                    />
                  )}
                </div>
              </div>
              {/* Row 4: Checkboxes + Status */}
              <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {[
                  ['excludeOpeningBalance', 'Exclude Opening Balance'],
                  ['excludeFutures', 'Exclude Futures'],
                ].map(([field, lbl]) => (
                  <label key={field} style={{ display: 'flex', alignItems: 'center', gap: '0.38rem', color: '#374151', fontSize: '0.84rem', cursor: 'pointer' }}>
                    <input type="checkbox" checked={fixingRegFilter[field]}
                      onChange={(e) => setFixingRegFilter(f => ({ ...f, [field]: e.target.checked }))}
                      style={{ width: '1rem', height: '1rem', accentColor: '#2563EB' }}
                    />
                    {lbl}
                  </label>
                ))}
                <div style={{ color: '#64748B', fontSize: '0.76rem', lineHeight: 1.35 }}>
                  Unfixing rows affect USD amount balance only; XAU position balance is unchanged.
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <label style={{ color: '#64748B', fontSize: '0.72rem', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
                  <select
                    value={fixingRegFilter.status}
                    onChange={(e) => setFixingRegFilter(f => ({ ...f, status: e.target.value }))}
                    style={{ padding: '0.38rem 0.55rem', borderRadius: '0.35rem', border: '1px solid #CBD5E1', background: '#FFFFFF', color: '#1E293B', fontSize: '0.83rem' }}
                  >
                    <option value="preview">Preview (All)</option>
                    <option value="final">Final (Confirmed only)</option>
                  </select>
                </div>
              </div>
              {/* Row 5: Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.2rem' }}>
                <button
                  onClick={() => { setFixingRegShown(false); setFixingRegResults([]); setFixingRegError(''); setActiveTab('dashboard') }}
                  style={{ padding: '0.48rem 1.4rem', background: 'transparent', color: '#6B7280', border: '1px solid #CBD5E1', borderRadius: '0.4rem', cursor: 'pointer', fontSize: '0.87rem', fontWeight: '600' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleFixingRegProceed}
                  disabled={fixingRegLoading}
                  style={{ padding: '0.48rem 1.6rem', background: fixingRegLoading ? 'rgba(var(--purple-rgb),0.5)' : 'var(--purple)', color: '#FFFFFF', border: 'none', borderRadius: '0.4rem', cursor: fixingRegLoading ? 'default' : 'pointer', fontSize: '0.87rem', fontWeight: '700', letterSpacing: '0.02em' }}
                >
                  {fixingRegLoading ? 'Loading…' : 'Proceed'}
                </button>
              </div>
            </div>
          </div>

          {/* Error */}
          {fixingRegError && (
            <div style={{ background: '#FEE2E2', color: '#991B1B', padding: '0.6rem 0.9rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.87rem' }}>
              {fixingRegError}
            </div>
          )}

          {/* Results */}
          {fixingRegShown && !fixingRegLoading && (() => {
            const qUnit = fixingRegFilter.quantityUnit
            const rUnit = fixingRegFilter.rateUnit
            const metalCodeLabel = String(fixingRegFilter.metalType || '').split('::')[0].toUpperCase() || 'ALL'
            const isQtyImpactRow = (row) => {
              const mode = String(row?.fixingMode || '').trim().toLowerCase()
              if (mode === 'unfixing') return false
              return true
            }
            const totalBuyOz = fixingRegResults
              .filter((r) => r.direction === 'buy' && isQtyImpactRow(r))
              .reduce((s, r) => s + Number(r.qty || 0), 0)
            const totalSellOz = fixingRegResults
              .filter((r) => r.direction === 'sell' && isQtyImpactRow(r))
              .reduce((s, r) => s + Number(r.qty || 0), 0)
            const netOz = totalBuyOz - totalSellOz
            const openingQtyOz = fixingRegFilter.excludeOpeningBalance ? 0 : Number(fixingRegOpening.qtyOz || 0)
            const openingValue = fixingRegFilter.excludeOpeningBalance ? 0 : Number(fixingRegOpening.value || 0)
            const closingQtyOz = openingQtyOz + netOz
            const getRowSignedValue = (row) => {
              const amount = Number(row?.amount || 0)
              const mode = String(row?.fixingMode || '').trim().toLowerCase()
              if (mode === 'unfixing') return amount
              return String(row?.direction || '').toLowerCase() === 'buy' ? amount : -amount
            }
            const txnNetValue = fixingRegResults.reduce((sum, row) => {
              return sum + getRowSignedValue(row)
            }, 0)
            const closingValue = openingValue + txnNetValue
            const fmtDate = (d) => d ? new Date(d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
            const fmtSignedAmt = (v) => {
              const amount = Number(v || 0)
              const abs = fixingRegFmtAmt(Math.abs(amount))
              if (amount < 0) return `(${abs})`
              return abs
            }
            const fmtSignedQty = (v) => {
              const value = Number(v || 0)
              const abs = fixingRegFmtQty(Math.abs(value), qUnit)
              if (value < 0) return `(${abs})`
              return abs
            }
            const fmtSignedRate = (v) => {
              const value = Number(v || 0)
              const abs = fixingRegFmtRate(Math.abs(value), rUnit)
              if (value < 0) return `(${abs})`
              return abs
            }
            const legacyHead1 = {
              padding: '0.24rem 0.38rem',
              border: '1px solid #8F949B',
              color: '#2F3A44',
              fontWeight: '700',
              fontSize: '0.69rem',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              whiteSpace: 'nowrap',
              background: '#E5C183',
              lineHeight: 1.05,
            }
            const legacyHead2 = {
              padding: '0.2rem 0.38rem',
              border: '1px solid #9BA1A9',
              color: '#2F3A44',
              fontWeight: '700',
              fontSize: '0.67rem',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              background: '#F2DEB5',
              lineHeight: 1.05,
            }
            const legacyCell = {
              padding: '0.24rem 0.4rem',
              border: '1px solid #C6CBD2',
              color: '#1F2937',
              lineHeight: 1.1,
            }
            const numericCell = {
              ...legacyCell,
              textAlign: 'right',
              fontWeight: '600',
              color: '#0F172A',
              fontVariantNumeric: 'tabular-nums',
              fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif',
            }
            let runningQtyOz = openingQtyOz
            let runningAmount = openingValue

            return (
              <div style={{ ...modalBackdropStyle, padding: 0 }} onClick={() => setFixingRegShown(false)}>
                <div style={{ ...modalCardStyle, width: '100vw', maxWidth: '100vw', height: '100vh', maxHeight: '100vh', borderRadius: 0, padding: '1rem', display: 'flex', flexDirection: 'column' }} onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem', gap: '0.8rem', position: 'sticky', top: 0, zIndex: 3, background: '#FFFFFF', paddingBottom: '0.35rem' }}>
                    <div>
                      <h4 style={{ margin: 0, color: C.ink, fontSize: '1.05rem' }}>Fixing Register Transactions Window</h4>
                      <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Metal sale, purchase, and direct deal entries between selected dates ordered by voucher number.</p>
                    </div>
                    <button onClick={() => setFixingRegShown(false)} style={{ padding: '0.42rem 0.75rem', border: '1px solid #D1D5DB', background: '#FFFFFF', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.8rem' }}>Close</button>
                  </div>

                  <div style={{ display: 'flex', gap: '0.65rem', marginBottom: '0.8rem', flexWrap: 'wrap' }}>
                    {[
                      { label: 'Total Buy', value: `${fixingRegFmtQty(totalBuyOz, qUnit)} ${qUnit}`, bg: '#DCFCE7', color: '#166534' },
                      { label: 'Total Sell', value: `${fixingRegFmtQty(totalSellOz, qUnit)} ${qUnit}`, bg: '#FEE2E2', color: '#991B1B' },
                      { label: 'Net Position', value: `${netOz >= 0 ? '+' : '-'}${fixingRegFmtQty(Math.abs(netOz), qUnit)} ${qUnit}`, bg: '#EFF6FF', color: netOz >= 0 ? '#1D4ED8' : '#B45309' },
                      { label: 'Records', value: String(fixingRegResults.length), bg: '#F3F4F6', color: '#374151' },
                    ].map((card) => (
                      <div key={card.label} style={{ background: card.bg, padding: '0.42rem 0.72rem', borderRadius: '0.38rem', minWidth: '145px' }}>
                        <div style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '700', color: card.color }}>{card.value}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ overflow: 'auto', border: '1px solid #8F98A6', borderRadius: '0.24rem', flex: 1, background: '#FCFCFC' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', minWidth: '1320px', fontFamily: '"Segoe UI", Tahoma, Arial, sans-serif', fontVariantNumeric: 'tabular-nums' }}>
                      <colgroup>
                        <col style={{ width: '40px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '120px' }} />
                        <col style={{ width: '360px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '90px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '110px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '130px' }} />
                        <col style={{ width: '95px' }} />
                      </colgroup>
                      <thead>
                        <tr style={{ background: '#EBC788' }}>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'right' }}>#</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'left' }}>Doc Date</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'left' }}>Val Date</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'left' }}>Doc No</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'left' }}>Description</th>
                          <th colSpan={3} style={{ ...legacyHead1, textAlign: 'center' }}>{`${metalCodeLabel} (${qUnit})`}</th>
                          <th colSpan={3} style={{ ...legacyHead1, textAlign: 'center' }}>Amount (USD)</th>
                          <th rowSpan={2} style={{ ...legacyHead1, textAlign: 'right' }}>Average</th>
                        </tr>
                        <tr style={{ background: '#F6E2BA' }}>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>In</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>Out</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>Balance</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>{`Rate (${rUnit})`}</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>Value</th>
                          <th style={{ ...legacyHead2, textAlign: 'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ background: '#FBF4E5' }}>
                          <td style={{ ...legacyCell, textAlign: 'right', color: '#64748B' }}>-</td>
                          <td style={{ ...legacyCell, color: '#374151', whiteSpace: 'nowrap' }}>-</td>
                          <td style={{ ...legacyCell, color: '#374151', whiteSpace: 'nowrap' }}>-</td>
                          <td style={{ ...legacyCell, color: '#111827', fontWeight: '700' }}>Opening C/F</td>
                          <td style={{ ...legacyCell, color: '#4B5563' }}>Opening Carry Forward</td>
                          <td style={{ ...numericCell, color: '#6B7280' }}>-</td>
                          <td style={{ ...numericCell, color: '#6B7280' }}>-</td>
                          <td style={numericCell}>{fmtSignedQty(openingQtyOz)}</td>
                          <td style={{ ...numericCell, color: '#6B7280' }}>-</td>
                          <td style={{ ...numericCell, color: '#6B7280' }}>-</td>
                          <td style={numericCell}>{fmtSignedAmt(openingValue)}</td>
                          <td style={numericCell}>{runningQtyOz !== 0 ? fmtSignedRate(runningAmount / runningQtyOz) : '-'}</td>
                        </tr>
                        {fixingRegResults.map((row, idx) => (
                          (() => {
                            const qtyOz = Number(row.qty || 0)
                            const amount = Number(row.amount || 0)
                            const isBuy = String(row.direction || '').toLowerCase() === 'buy'
                            const isQtyImpactEnabled = isQtyImpactRow(row)
                            const qtyInOz = isBuy ? qtyOz : 0
                            const qtyOutOz = isBuy ? 0 : qtyOz
                            const signedQtyOz = isQtyImpactEnabled ? (isBuy ? qtyOz : -qtyOz) : 0
                            const signedValue = getRowSignedValue(row)
                            runningQtyOz += signedQtyOz
                            runningAmount += signedValue
                            const avgRate = runningQtyOz !== 0 ? (runningAmount / runningQtyOz) : null
                            return (
                          <tr key={row.rowId || `${row.voucherNo}-${idx}`} style={{ background: idx % 2 === 0 ? '#FFFFFF' : '#FCFAF4' }}>
                            <td style={{ ...legacyCell, textAlign: 'right', color: '#64748B' }}>{idx + 1}</td>
                            <td style={{ ...legacyCell, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(row.docDate)}</td>
                            <td style={{ ...legacyCell, color: '#374151', whiteSpace: 'nowrap' }}>{fmtDate(row.valueDate)}</td>
                            <td style={{ ...legacyCell, color: '#111827', fontWeight: '700' }}>{row.voucherNo || '-'}</td>
                            <td style={{ ...legacyCell, color: '#4B5563', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <span
                                style={{
                                  display: 'inline-block',
                                  padding: '0.02rem 0.34rem',
                                  marginRight: '0.32rem',
                                  borderRadius: '0.2rem',
                                  fontSize: '0.64rem',
                                  fontWeight: '700',
                                  background: row.fixingMode === 'Unfixing' ? '#FEF3C7' : '#DCFCE7',
                                  color: row.fixingMode === 'Unfixing' ? '#92400E' : '#166534',
                                  border: row.fixingMode === 'Unfixing' ? '1px solid #FCD34D' : '1px solid #86EFAC',
                                  verticalAlign: 'middle',
                                }}
                              >
                                {row.fixingMode || 'Fixing'}
                              </span>
                              {row.remarks || `${row.sourceType || ''} ${row.customerName || ''}`.trim() || '-'}
                            </td>
                            <td style={numericCell}>{qtyInOz > 0 ? fixingRegFmtQty(qtyInOz, qUnit) : '-'}</td>
                            <td style={numericCell}>{qtyOutOz > 0 ? fixingRegFmtQty(qtyOutOz, qUnit) : '-'}</td>
                            <td style={numericCell}>{fmtSignedQty(runningQtyOz)}</td>
                            <td style={numericCell}>{fixingRegFmtRate(Number(row.price || 0), rUnit)}</td>
                            <td style={numericCell}>{fmtSignedAmt(signedValue)}</td>
                            <td style={numericCell}>{fmtSignedAmt(runningAmount)}</td>
                            <td style={numericCell}>{avgRate === null ? '-' : fmtSignedRate(avgRate)}</td>
                          </tr>
                            )
                          })()
                        ))}
                        <tr style={{ background: '#F4D9A3' }}>
                          <td style={{ ...legacyCell, textAlign: 'right', color: '#78350F', fontWeight: '700' }}>-</td>
                          <td style={{ ...legacyCell, color: '#78350F', whiteSpace: 'nowrap', fontWeight: '700' }}>-</td>
                          <td style={{ ...legacyCell, color: '#78350F', whiteSpace: 'nowrap', fontWeight: '700' }}>-</td>
                          <td style={{ ...legacyCell, color: '#78350F', fontWeight: '700' }}>Closing C/F</td>
                          <td style={{ ...legacyCell, color: '#78350F', fontWeight: '700' }}>Closing Carry Forward</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fixingRegFmtQty(totalBuyOz, qUnit)}</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fixingRegFmtQty(totalSellOz, qUnit)}</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fmtSignedQty(closingQtyOz)}</td>
                          <td style={{ ...numericCell, color: '#78350F', fontWeight: '700' }}>-</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fmtSignedAmt(txnNetValue)}</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{fmtSignedAmt(closingValue)}</td>
                          <td style={{ ...numericCell, fontWeight: '700', color: '#78350F' }}>{closingQtyOz !== 0 ? fmtSignedRate(closingValue / closingQtyOz) : '-'}</td>
                        </tr>
                        {fixingRegResults.length === 0 && (
                          <tr>
                            <td colSpan={12} style={{ padding: '0.8rem', textAlign: 'center', color: C.inkSoft }}>No transactions found for selected date range and filters.</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* LEDGER TAB */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Journal Entry (Advanced)</h3>
            {canManageAccounts && (
              <button
                onClick={() => setShowLedgerForm(!showLedgerForm)}
                style={{
                  padding: '0.5rem 1rem',
                  background: C.s1,
                  color: C.t1,
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                + Create Ledger Entry
              </button>
            )}
          </div>
          {showLedgerForm && (
            <form onSubmit={handleCreateLedgerEntry} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <select
                value={ledgerForm.mappingId}
                onChange={(e) => handleLedgerMappingChange(e.target.value)}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                <option value="">Post From Mapping (Optional)</option>
                {mappings.map((mapping) => (
                  <option key={mapping._id} value={mapping._id}>{mapping.mappingType}</option>
                ))}
              </select>
              <input
                type="date"
                value={ledgerForm.date}
                onChange={(e) => setLedgerForm({ ...ledgerForm, date: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              />
              <select
                value={ledgerForm.debitAccountId}
                onChange={(e) => setLedgerForm({ ...ledgerForm, debitAccountId: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                <option value="">Select Debit Account</option>
                {entryAccountOptions.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <select
                value={ledgerForm.creditAccountId}
                onChange={(e) => setLedgerForm({ ...ledgerForm, creditAccountId: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                <option value="">Select Credit Account</option>
                {entryAccountOptions.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                placeholder="Amount"
                value={ledgerForm.amount}
                onChange={(e) => setLedgerForm({ ...ledgerForm, amount: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              />
              <select
                value={ledgerForm.referenceType}
                onChange={(e) => setLedgerForm({ ...ledgerForm, referenceType: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                {LEDGER_REFERENCE_TYPES.map((referenceType) => (
                  <option key={referenceType} value={referenceType}>{referenceType}</option>
                ))}
              </select>
              <select
                value={ledgerForm.currency}
                onChange={(e) => setLedgerForm({ ...ledgerForm, currency: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                {(currencies.length ? currencies : [{ code: 'USD', name: 'US Dollar' }]).map((currency) => (
                  <option key={currency.code} value={currency.code}>{currency.code} - {currency.name}</option>
                ))}
              </select>
              <input
                placeholder="Description"
                value={ledgerForm.description}
                onChange={(e) => setLedgerForm({ ...ledgerForm, description: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              />
              <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                {saving ? 'Saving...' : 'Create Entry'}
              </button>
              <button type="button" onClick={() => setShowLedgerForm(false)} style={{ padding: '0.5rem 1rem', background: C.p1, color: C.t2, border: `1px solid ${C.t2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </form>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="date"
              value={ledgerFilters.startDate}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              style={modalInputStyle}
            />
            <input
              type="date"
              value={ledgerFilters.endDate}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              style={modalInputStyle}
            />
            <select
              value={ledgerFilters.department}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, department: e.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All Departments</option>
              {LEDGER_DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <select
              value={ledgerFilters.referenceType}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, referenceType: e.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All Types</option>
              {LEDGER_REFERENCE_TYPES.map((referenceType) => (
                <option key={referenceType} value={referenceType}>{referenceType}</option>
              ))}
            </select>
            <select
              value={ledgerFilters.accountId}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, accountId: e.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All Accounts</option>
              {accounts.map((account) => (
                <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
              ))}
            </select>
            <button
              onClick={() => setLedgerFilters({ startDate: '', endDate: '', department: '', referenceType: '', accountId: '' })}
              style={{ padding: '0.65rem 0.75rem', background: '#E5E7EB', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer', height: 'fit-content' }}
            >
              Reset Filters
            </button>
          </div>
          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th onClick={() => setSorting({...sorting, ledger: {by: 'date', asc: !sorting.ledger.asc}})} style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', cursor: 'pointer', background: sorting.ledger.by === 'date' ? C.p2 : 'transparent' }}>Date {sorting.ledger.by === 'date' && (sorting.ledger.asc ? '▲' : '▼')}</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Debit Account</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Credit Account</th>
                  <th onClick={() => setSorting({...sorting, ledger: {by: 'amount', asc: !sorting.ledger.asc}})} style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600', cursor: 'pointer', background: sorting.ledger.by === 'amount' ? C.p2 : 'transparent' }}>Amount {sorting.ledger.by === 'amount' && (sorting.ledger.asc ? '▲' : '▼')}</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: C.t1, fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ledger
                  .sort((a, b) => {
                    if (sorting.ledger.by === 'date') {
                      return sorting.ledger.asc ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date)
                    } else if (sorting.ledger.by === 'amount') {
                      return sorting.ledger.asc ? a.amount - b.amount : b.amount - a.amount
                    }
                    return 0
                  })
                  .slice((pagination.ledger - 1) * ITEMS_PER_PAGE, pagination.ledger * ITEMS_PER_PAGE)
                  .map((entry) => (
                    <tr key={entry._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{new Date(entry.date).toLocaleDateString()}</td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{entry.debitAccountId?.accountCode}</td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{entry.creditAccountId?.accountCode}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>{entry.amount?.toLocaleString()}</td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{entry.referenceType}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => handleEditLedger(entry)} title="Edit" style={{ padding: '0.35rem 0.5rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                          <button onClick={() => handleReverseLedger(entry)} title="Reverse" style={{ padding: '0.35rem 0.5rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Reverse</button>
                          <button onClick={() => handlePermanentDeleteLedger(entry)} title="Delete" style={{ padding: '0.35rem 0.5rem', background: '#7F1D1D', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination for Ledger */}
          {Math.ceil(ledger.length / ITEMS_PER_PAGE) > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button onClick={() => setPagination({...pagination, ledger: Math.max(1, pagination.ledger - 1)})} disabled={pagination.ledger === 1} style={{padding: '0.4rem 0.8rem', background: pagination.ledger === 1 ? '#D1D5DB' : C.s1, color: '#fff', border: 'none', cursor: pagination.ledger === 1 ? 'default' : 'pointer', borderRadius: '0.35rem'}}>← Prev</button>
              {Array.from({length: Math.ceil(ledger.length / ITEMS_PER_PAGE)}, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPagination({...pagination, ledger: p})} style={{padding: '0.4rem 0.6rem', background: p === pagination.ledger ? C.s1 : '#E5E7EB', color: p === pagination.ledger ? '#fff' : C.ink, border: 'none', cursor: 'pointer', borderRadius: '0.35rem', fontWeight: p === pagination.ledger ? '600' : '400'}}>{p}</button>
              ))}
              <button onClick={() => setPagination({...pagination, ledger: Math.min(Math.ceil(ledger.length / ITEMS_PER_PAGE), pagination.ledger + 1)})} disabled={pagination.ledger === Math.ceil(ledger.length / ITEMS_PER_PAGE)} style={{padding: '0.4rem 0.8rem', background: pagination.ledger === Math.ceil(ledger.length / ITEMS_PER_PAGE) ? '#D1D5DB' : C.s1, color: '#fff', border: 'none', cursor: pagination.ledger === Math.ceil(ledger.length / ITEMS_PER_PAGE) ? 'default' : 'pointer', borderRadius: '0.35rem'}}>Next →</button>
            </div>
          )}

          {ledger.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No ledger entries yet.</p>}
        </div>
      )}

      {/* ACCOUNT MAPPINGS TAB */}
      {activeTab === 'mappings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Account Mappings</h3>
            {canManageAccounts && (
              <button
                onClick={() => setShowMappingForm(!showMappingForm)}
                style={{
                  padding: '0.5rem 1rem',
                  background: C.s1,
                  color: C.t1,
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontWeight: '600',
                }}
              >
                + Add Mapping
              </button>
            )}
          </div>
          <p style={{ color: C.inkSoft, marginBottom: '1rem', fontSize: '0.875rem' }}>
            📌 Auto-map accounts for transactions. When a user selects a transaction type, the system auto-fills debit and credit accounts.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 320px) auto', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
            <select
              value={mappingFilters.department}
              onChange={(e) => setMappingFilters((prev) => ({ ...prev, department: e.target.value }))}
              style={{ display: 'block', width: '100%', padding: '0.6rem 0.75rem', background: '#F9FAFB', border: '1px solid #D1D5DB', color: C.ink, borderRadius: '0.5rem' }}
            >
              <option value="">All departments</option>
              {LEDGER_DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <div style={{ color: C.inkSoft, fontSize: '0.82rem', fontWeight: '700' }}>Filter scoped mappings by department</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#EEF2FF', color: '#3730A3', fontSize: '0.76rem', fontWeight: '700' }}>Total: {Number(mappingSummary.total || 0).toLocaleString()}</span>
            <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#F3F4F6', color: '#374151', fontSize: '0.76rem', fontWeight: '700' }}>Shared: {Number(mappingSummary.shared || 0).toLocaleString()}</span>
            {Object.entries(mappingSummary.byDepartment || {})
              .sort((left, right) => {
                const countDifference = Number(right[1] || 0) - Number(left[1] || 0)
                if (countDifference !== 0) return countDifference
                return String(left[0] || '').localeCompare(String(right[0] || ''))
              })
              .map(([department, count]) => (
              <span key={department} style={{ ...getDepartmentBadgeStyle(department), padding: '0.3rem 0.55rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: '700', textTransform: 'capitalize' }}>
                {department}: {Number(count || 0).toLocaleString()}
              </span>
            ))}
          </div>
          {showMappingForm && (
            <form onSubmit={handleCreateMapping} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>
              <input
                placeholder="Mapping Type"
                value={mappingForm.mappingType}
                onChange={(e) => setMappingForm({ ...mappingForm, mappingType: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              />
              <select
                value={mappingForm.debitAccountId}
                onChange={(e) => setMappingForm({ ...mappingForm, debitAccountId: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                <option value="">Select Debit Account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <select
                value={mappingForm.creditAccountId}
                onChange={(e) => setMappingForm({ ...mappingForm, creditAccountId: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                <option value="">Select Credit Account</option>
                {accounts.map((account) => (
                  <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                ))}
              </select>
              <select
                value={mappingForm.department}
                onChange={(e) => setMappingForm({ ...mappingForm, department: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              >
                <option value="">Shared / All Departments</option>
                {LEDGER_DEPARTMENTS.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              <input
                placeholder="Description"
                value={mappingForm.description}
                onChange={(e) => setMappingForm({ ...mappingForm, description: e.target.value })}
                style={{ display: 'block', width: '100%', padding: '0.5rem', marginBottom: '0.5rem', background: C.p2, border: 'none', color: C.t1, borderRadius: '0.375rem' }}
              />
              <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                {saving ? 'Saving...' : 'Create Mapping'}
              </button>
              <button type="button" onClick={() => setShowMappingForm(false)} style={{ padding: '0.5rem 1rem', background: C.p1, color: C.t2, border: `1px solid ${C.t2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                Cancel
              </button>
            </form>
          )}
          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th onClick={() => setSorting({...sorting, mappings: {by: 'type', asc: !sorting.mappings.asc}})} style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', cursor: 'pointer', background: sorting.mappings.by === 'type' ? C.p2 : 'transparent' }}>Type {sorting.mappings.by === 'type' && (sorting.mappings.asc ? '▲' : '▼')}</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Debit Account</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Credit Account</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Department</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: C.t1, fontWeight: '600' }}>Usage</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: C.t1, fontWeight: '600' }}>Active</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {mappings
                  .sort((a, b) => {
                    if (sorting.mappings.by === 'type') {
                      return sorting.mappings.asc ? a.mappingType.localeCompare(b.mappingType) : b.mappingType.localeCompare(a.mappingType)
                    }
                    return 0
                  })
                  .slice((pagination.mappings - 1) * ITEMS_PER_PAGE, pagination.mappings * ITEMS_PER_PAGE)
                  .map((m) => (
                    <tr key={m._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '600' }}>{m.mappingType}</td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{m.debitAccountId?.accountCode} - {m.debitAccountId?.accountName}</td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{m.creditAccountId?.accountCode} - {m.creditAccountId?.accountName}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ ...getDepartmentBadgeStyle(m.department), padding: '0.2rem 0.55rem', borderRadius: '999px', fontSize: '0.74rem', fontWeight: '700', textTransform: 'capitalize' }}>
                          {m.department || 'shared'}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center', color: m.usageCount > 0 ? C.s1 : C.t3, fontWeight: '600' }}>{m.usageCount || 0}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input type="checkbox" checked={m.isActive !== false} onChange={async () => {
                          try {
                            await erpAccountingAPI.updateMapping(token, m._id, {isActive: m.isActive === false})
                            await loadMappings()
                            showNotification(m.isActive === false ? '✅ Mapping activated' : '✅ Mapping deactivated')
                          } catch (e) {
                            setError(e.response?.data?.message || 'Failed to toggle mapping')
                          }
                        }} style={{cursor: 'pointer'}} />
                      </td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button onClick={() => setTestMapping(m) || setShowMappingTest(true)} title="Preview" style={{ padding: '0.35rem 0.5rem', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Test</button>
                          <button onClick={() => handleEditMapping(m)} style={{ padding: '0.35rem 0.5rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>
                          <button onClick={() => handleDeleteMapping(m)} style={{ padding: '0.35rem 0.5rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Pagination for Mappings */}
          {Math.ceil(mappings.length / ITEMS_PER_PAGE) > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
              <button onClick={() => setPagination({...pagination, mappings: Math.max(1, pagination.mappings - 1)})} disabled={pagination.mappings === 1} style={{padding: '0.4rem 0.8rem', background: pagination.mappings === 1 ? '#D1D5DB' : C.s1, color: '#fff', border: 'none', cursor: pagination.mappings === 1 ? 'default' : 'pointer', borderRadius: '0.35rem'}}>← Prev</button>
              {Array.from({length: Math.ceil(mappings.length / ITEMS_PER_PAGE)}, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPagination({...pagination, mappings: p})} style={{padding: '0.4rem 0.6rem', background: p === pagination.mappings ? C.s1 : '#E5E7EB', color: p === pagination.mappings ? '#fff' : C.ink, border: 'none', cursor: 'pointer', borderRadius: '0.35rem', fontWeight: p === pagination.mappings ? '600' : '400'}}>{p}</button>
              ))}
              <button onClick={() => setPagination({...pagination, mappings: Math.min(Math.ceil(mappings.length / ITEMS_PER_PAGE), pagination.mappings + 1)})} disabled={pagination.mappings === Math.ceil(mappings.length / ITEMS_PER_PAGE)} style={{padding: '0.4rem 0.8rem', background: pagination.mappings === Math.ceil(mappings.length / ITEMS_PER_PAGE) ? '#D1D5DB' : C.s1, color: '#fff', border: 'none', cursor: pagination.mappings === Math.ceil(mappings.length / ITEMS_PER_PAGE) ? 'default' : 'pointer', borderRadius: '0.35rem'}}>Next →</button>
            </div>
          )}

          {mappings.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No mappings configured yet.</p>}
        </div>
      )}

      {/* ACCOUNT SUMMARY TAB */}
      {activeTab === 'enquiry' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ marginBottom: '0.35rem', color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Account Summary</h3>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.9rem' }}>Search any chart-of-account code to view balances, account details, and exportable summary details.</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ padding: '0.4rem 0.7rem', borderRadius: '999px', background: '#ECFDF5', color: '#065F46', fontSize: '0.78rem', fontWeight: '700' }}>{isSuperAdmin ? 'Super Admin' : isFinance ? 'Finance' : 'Department Head'}</span>
              <span style={{ padding: '0.4rem 0.7rem', borderRadius: '999px', background: '#EFF6FF', color: '#1D4ED8', fontSize: '0.78rem', fontWeight: '700' }}>Role Based</span>
            </div>
          </div>

          {!canViewBalanceEnquiry ? (
            <div style={{ ...emptyCardStyle, borderStyle: 'solid', background: '#FEF2F2', color: '#991B1B' }}>⛔ Account summary access restricted. Super Admin, Finance, or Department Head with mapped-account visibility only.</div>
          ) : (
            <>
              <div style={{ marginBottom: '1rem' }}>
                <form onSubmit={handleAccountEnquiry} style={{ background: '#FAFAF7', border: '1px solid #D6D3C4', borderRadius: '0.75rem', padding: '1rem', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.65)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                    <p style={{ margin: 0, color: '#3F4B2E', fontWeight: '800', letterSpacing: '0.02em' }}>Account Lookup</p>
                    <span style={{ fontSize: '0.78rem', color: '#6B7280' }}>Type account code</span>
                  </div>
                  <input
                    placeholder="Enter Account Number (e.g. 1000)"
                    value={accountEnquiryCode}
                    onChange={(e) => {
                      setAccountEnquiryCode(e.target.value)
                      setEnquiryStatus({ type: '', message: '' })
                    }}
                    style={{ display: 'block', width: '100%', padding: '0.7rem 0.8rem', marginBottom: '0.75rem', background: '#FFFFFF', border: '1px solid #B8BEA0', color: C.ink, borderRadius: '0.5rem' }}
                  />
                  {filteredGroupedSummaryAccounts.length > 0 && (
                    <div style={{ marginTop: '-0.35rem', marginBottom: '0.75rem', border: '1px solid #D6D3C4', borderRadius: '0.6rem', background: '#FFFFFF', maxHeight: '300px', overflowY: 'auto', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)' }}>
                      {filteredGroupedSummaryAccounts.map((group) => (
                        <div key={group.type}>
                          <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '0.45rem 0.75rem', background: '#F5F7F0', borderBottom: '1px solid #E5E7EB', color: '#3F4B2E', fontSize: '0.76rem', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                            {group.type}
                          </div>
                          {group.accounts.map((account) => (
                            <button
                              key={account._id}
                              type="button"
                              onMouseDown={(event) => {
                                event.preventDefault()
                                setAccountEnquiryCode(account.accountCode)
                                setEnquiryStatus({ type: '', message: '' })
                                fetchAccountEnquiryByCode(account.accountCode)
                              }}
                              style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0.75rem', border: 'none', borderBottom: '1px solid #F3F4F6', background: '#FFFFFF', color: C.ink, cursor: 'pointer', textAlign: 'left' }}
                            >
                              <span style={{ fontWeight: '800', minWidth: '56px', color: '#111827' }}>{account.accountCode}</span>
                              <span style={{ flex: 1, color: '#4B5563', fontSize: '0.86rem' }}>{account.accountName}</span>
                              <span style={{ color: '#6B7280', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{account.accountType}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="submit" disabled={enquiryLoading} style={{ padding: '0.6rem 1rem', background: 'var(--purple)', color: '#FFFFFF', border: 'none', borderRadius: '0.45rem', cursor: 'pointer', fontWeight: '700' }}>
                      {enquiryLoading ? 'Loading...' : 'Load Summary'}
                    </button>
                    <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>Live from ERP accounting balances</span>
                  </div>
                  {enquiryStatus.message && (
                    <p style={{ marginTop: '0.6rem', marginBottom: 0, color: enquiryStatus.type === 'success' ? '#047857' : C.danger, fontWeight: '600', fontSize: '0.85rem' }}>
                      {enquiryStatus.message}
                    </p>
                  )}

                  {!summaryAccounts.length && (
                    <p style={{ margin: '0.7rem 0 0', color: '#92400E', fontSize: '0.82rem', fontWeight: '600' }}>
                      No accounts available for your role. Department heads only see mapped accounts in Account Summary.
                    </p>
                  )}

                  <div style={{ marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: '1px solid #E5E7EB' }}>
                    <p style={{ margin: '0 0 0.5rem', color: '#6B7280', fontWeight: '700', fontSize: '0.78rem' }}>Quick Accounts</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.45rem' }}>
                      {summaryAccounts
                        .slice()
                        .sort((a, b) => a.accountCode.localeCompare(b.accountCode))
                        .slice(0, 8)
                        .map((account) => (
                          <button
                            key={account._id}
                            type="button"
                            onClick={() => {
                              setAccountEnquiryCode(account.accountCode)
                              fetchAccountEnquiryByCode(account.accountCode)
                            }}
                            style={{ padding: '0.35rem 0.6rem', borderRadius: '999px', border: '1px solid #C7D2FE', background: '#EEF2FF', color: '#3730A3', cursor: 'pointer', fontSize: '0.76rem', fontWeight: '700' }}
                            title={account.accountName}
                          >
                            {account.accountCode}
                          </button>
                        ))}
                    </div>
                  </div>
                </form>
              </div>

              {enquiryHistory.length > 0 && (
                <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem', marginBottom: '1rem' }}>
                  <p style={{ margin: 0, color: C.ink, fontWeight: '700', marginBottom: '0.55rem' }}>Recent Account Summary History</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {enquiryHistory.map((item) => (
                      <button
                        key={`${item.accountCode}-${item.searchedAt}`}
                        type="button"
                        onClick={() => fetchAccountEnquiryByCode(item.accountCode)}
                        style={{ padding: '0.35rem 0.6rem', borderRadius: '0.4rem', border: '1px solid #D1D5DB', background: '#F9FAFB', color: C.ink, cursor: 'pointer', fontSize: '0.8rem' }}
                        title={item.accountName || item.accountCode}
                      >
                        {item.accountCode}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      )}

      {/* TRANSACTIONS TAB */}
      {activeTab === 'transactions' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Transactions</h3>
            {selectedTransactionId && (
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: C.inkSoft, fontSize: '0.84rem', fontWeight: '700' }}>Linked transaction highlighted</span>
                <button onClick={() => setSelectedTransactionId('')} style={{ padding: '0.35rem 0.6rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}>Clear</button>
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem', fontWeight: '700' }}>TOTAL</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.totalCount || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.82rem' }}>Amount {Number(transactionSummary.totalAmount || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#92400E', fontSize: '0.78rem', fontWeight: '700' }}>DRAFT</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.draft || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#1D4ED8', fontSize: '0.78rem', fontWeight: '700' }}>SUBMITTED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.submitted || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#166534', fontSize: '0.78rem', fontWeight: '700' }}>APPROVED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.approved || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#065F46', fontSize: '0.78rem', fontWeight: '700' }}>POSTED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.posted || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#9D174D', fontSize: '0.78rem', fontWeight: '700' }}>RETURNED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.returned || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, color: '#B91C1C', fontSize: '0.78rem', fontWeight: '700' }}>REJECTED</p>
              <p style={{ margin: '0.35rem 0 0', color: C.ink, fontSize: '1.2rem', fontWeight: '800' }}>{Number(transactionSummary.rejected || 0).toLocaleString()}</p>
            </div>
          </div>
          <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.5rem' }}>
              <input placeholder="Search description/type/currency" value={transactionFilters.search} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, search: e.target.value }))} style={modalInputStyle} />
              <select value={transactionFilters.status} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))} style={modalInputStyle}>
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="posted">Posted</option>
                <option value="returned">Returned</option>
                <option value="rejected">Rejected</option>
              </select>
              <select value={transactionFilters.type} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, type: e.target.value, page: 1 }))} style={modalInputStyle}>
                <option value="">All types</option>
                {availableTransactionTypes.map((type) => <option key={type} value={type}>{TRANSACTION_TYPE_LABELS[type]}</option>)}
              </select>
              <input type="date" value={transactionFilters.startDate} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, startDate: e.target.value }))} style={modalInputStyle} />
              <input type="date" value={transactionFilters.endDate} onChange={(e) => setTransactionFilters((prev) => ({ ...prev, endDate: e.target.value }))} style={modalInputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button type="button" onClick={() => loadTransactions({ page: 1 })} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: C.s1, color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Apply Filters</button>
              <button type="button" onClick={() => { const resetFilters = { search: '', status: '', type: '', startDate: '', endDate: '' }; setTransactionFilters(resetFilters); loadTransactions({ page: 1, ...resetFilters }) }} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer', fontWeight: '700' }}>Reset</button>
              <button type="button" onClick={handleExportTransactionsCsv} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #10B981', background: '#ECFDF5', color: '#065F46', cursor: 'pointer', fontWeight: '700' }}>Export CSV</button>
              <button type="button" onClick={handleExportTransactionsXlsx} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #047857', background: '#ECFDF5', color: '#064E3B', cursor: 'pointer', fontWeight: '700' }}>Export XLSX</button>
              <button type="button" onClick={handleExportTransactionsPdf} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #EF4444', background: '#FEF2F2', color: '#991B1B', cursor: 'pointer', fontWeight: '700' }}>Export PDF</button>
            </div>
          </div>
          <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '0.65rem' }}>
              <div>
                <p style={{ margin: 0, color: C.ink, fontWeight: '800' }}>Bulk workflow actions</p>
                <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>{getTransactionBulkSelectionLabel(selectedTransactionIds)}</p>
              </div>
              <button type="button" onClick={() => setSelectedTransactionIds([])} style={{ padding: '0.4rem 0.7rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer', fontWeight: '700' }}>Clear Selection</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(260px, 2fr)', gap: '0.75rem', alignItems: 'start' }}>
              <textarea value={transactionWorkflowNote} onChange={(e) => setTransactionWorkflowNote(e.target.value)} rows={3} placeholder="Workflow note for submit / approve / post actions" style={{ ...modalInputStyle, marginBottom: 0, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="button" disabled={!selectedTransactionIds.length || saving} onClick={() => handleBulkTransactionAction('submit')} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#F59E0B', color: '#111827', cursor: 'pointer', fontWeight: '700' }}>Bulk Submit</button>
                {(isSuperAdmin || isFinance) && <button type="button" disabled={!selectedTransactionIds.length || saving} onClick={() => handleBulkTransactionAction('approve')} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#0EA5E9', color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Bulk Approve</button>}
                {(isSuperAdmin || isFinance) && <button type="button" disabled={!selectedTransactionIds.length || saving} onClick={() => handleBulkTransactionAction('post')} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: C.s1, color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Bulk Post</button>}
              </div>
            </div>
          </div>
          <form onSubmit={handleCreateTransaction} style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
              <div>
                <p style={{ margin: 0, color: C.ink, fontWeight: '700' }}>{isTransactionEditMode ? 'Edit transaction draft' : 'Create a new transaction draft'}</p>
                <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>Capture source transaction details, optional mapping, and account overrides in one place.</p>
              </div>
              {isTransactionEditMode && <button type="button" onClick={resetTransactionComposer} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer', fontWeight: '700' }}>Cancel edit</button>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              <select value={transactionForm.type} onChange={(e) => setTransactionForm((prev) => ({ ...prev, type: e.target.value }))} style={modalInputStyle}>
                {availableTransactionTypes.map((type) => <option key={type} value={type}>{TRANSACTION_TYPE_LABELS[type]}</option>)}
              </select>
              {['sale', 'purchase'].includes(String(transactionForm.type || '').toLowerCase()) && (
                <select value={transactionForm.metalFixStatus} onChange={(e) => setTransactionForm((prev) => ({ ...prev, metalFixStatus: e.target.value }))} style={modalInputStyle}>
                  <option value="fixed">Fixing (Fixed)</option>
                  <option value="unfixed">Non-Fixing (Unfixed)</option>
                </select>
              )}
              <input type="number" step="0.01" placeholder="Amount" value={transactionForm.amount} onChange={(e) => setTransactionForm((prev) => ({ ...prev, amount: e.target.value }))} style={modalInputStyle} />
              <input type="date" value={transactionForm.date} onChange={(e) => setTransactionForm((prev) => ({ ...prev, date: e.target.value }))} style={modalInputStyle} />
              <select value={transactionForm.currency} onChange={(e) => setTransactionForm((prev) => ({ ...prev, currency: e.target.value }))} style={modalInputStyle}>
                {(currencies.length ? currencies : [{ code: 'USD' }]).map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}
              </select>
              <input type="number" step="0.0001" min="0" placeholder="Exchange Rate" value={transactionForm.exchangeRate} onChange={(e) => setTransactionForm((prev) => ({ ...prev, exchangeRate: e.target.value }))} style={modalInputStyle} />
              <select value={transactionForm.customerId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, customerId: e.target.value }))} style={modalInputStyle}>
                <option value="">Customer (for Sales/Receipt)</option>
                {customers.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
              </select>
              <select value={transactionForm.vendorId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, vendorId: e.target.value }))} style={modalInputStyle}>
                <option value="">Vendor (for Purchase/Payment)</option>
                {vendors.map((v) => <option key={v._id} value={v._id}>{v.name}</option>)}
              </select>
              <select value={transactionForm.inventoryItemId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, inventoryItemId: e.target.value }))} style={modalInputStyle}>
                <option value="">Inventory Item (optional)</option>
                {inventoryProducts.map((p) => <option key={p._id} value={p._id}>{p.sku || p.name}</option>)}
              </select>
              <select value={transactionForm.mappingId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, mappingId: e.target.value }))} style={modalInputStyle}>
                <option value="">Account Mapping (optional)</option>
                {mappings.map((m) => <option key={m._id} value={m._id}>{m.mappingType}</option>)}
              </select>
              <select value={transactionForm.debitAccountId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, debitAccountId: e.target.value }))} style={modalInputStyle}>
                <option value="">Debit Account Override</option>
                {accounts.map((account) => <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>)}
              </select>
              <select value={transactionForm.creditAccountId} onChange={(e) => setTransactionForm((prev) => ({ ...prev, creditAccountId: e.target.value }))} style={modalInputStyle}>
                <option value="">Credit Account Override</option>
                {accounts.map((account) => <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>)}
              </select>
              <input placeholder="Description" value={transactionForm.description} onChange={(e) => setTransactionForm((prev) => ({ ...prev, description: e.target.value }))} style={modalInputStyle} />
            </div>
            <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' }}>{saving ? 'Saving...' : isTransactionEditMode ? 'Save Changes' : 'Create Transaction (Draft)'}</button>
          </form>

          {selectedTransaction && (
            <div style={{ background: '#F9FAFB', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, color: C.ink, fontWeight: '800' }}>{TRANSACTION_TYPE_LABELS[selectedTransaction.type] || selectedTransaction.type}</p>
                  <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.85rem' }}>{selectedTransaction.description || 'No description provided'}</p>
                </div>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', fontSize: '0.8rem', fontWeight: '800', ...(TRANSACTION_STATUS_STYLES[selectedTransaction.status] || { background: '#E5E7EB', color: C.ink }) }}>{selectedTransaction.status}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginTop: '0.9rem' }}>
                <div style={emptyCardStyle}><strong>Amount:</strong> {selectedTransaction.currency} {Number(selectedTransaction.amount || 0).toLocaleString()}</div>
                <div style={emptyCardStyle}><strong>Date:</strong> {selectedTransaction.date ? new Date(selectedTransaction.date).toLocaleDateString() : '-'}</div>
                <div style={emptyCardStyle}><strong>Customer:</strong> {selectedTransaction.customerId?.name || '-'}</div>
                <div style={emptyCardStyle}><strong>Vendor:</strong> {selectedTransaction.vendorId?.name || '-'}</div>
                <div style={emptyCardStyle}><strong>Debit:</strong> {selectedTransaction.debitAccountId ? `${selectedTransaction.debitAccountId.accountCode} - ${selectedTransaction.debitAccountId.accountName}` : '-'}</div>
                <div style={emptyCardStyle}><strong>Credit:</strong> {selectedTransaction.creditAccountId ? `${selectedTransaction.creditAccountId.accountCode} - ${selectedTransaction.creditAccountId.accountName}` : '-'}</div>
              </div>
              <div style={{ background: '#fff', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem', marginTop: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.65rem' }}>
                  <div>
                    <p style={{ margin: 0, color: C.ink, fontWeight: '800' }}>Attachments</p>
                    <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.82rem' }}>Upload supporting receipts, invoices, approvals, or backup documents.</p>
                  </div>
                  <label style={{ padding: '0.5rem 0.85rem', border: '1px solid #0EA5E9', background: '#EFF6FF', color: '#1D4ED8', borderRadius: '0.35rem', cursor: saving ? 'not-allowed' : 'pointer', fontWeight: '700' }}>
                    Upload document
                    <input
                      key={transactionAttachmentInputKey}
                      type="file"
                      disabled={saving}
                      onChange={(e) => handleUploadTransactionAttachment(e.target.files?.[0])}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                <div style={{ display: 'grid', gap: '0.55rem' }}>
                  {(selectedTransaction.attachments || []).map((attachment) => (
                    <div key={attachment._id || attachment.fileName} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.45rem', padding: '0.65rem', display: 'flex', justifyContent: 'space-between', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <a href={resolveTransactionAttachmentUrl(attachment)} target="_blank" rel="noreferrer" style={{ color: '#1D4ED8', fontWeight: '700', textDecoration: 'none' }}>{attachment.originalName}</a>
                        <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.78rem' }}>
                          {(attachment.uploadedBy?.name || 'User')} · {attachment.uploadedAt ? new Date(attachment.uploadedAt).toLocaleString() : ''} · {Number(attachment.size || 0).toLocaleString()} bytes
                        </p>
                      </div>
                      <button type="button" disabled={saving} onClick={() => handleDeleteTransactionAttachment(attachment._id)} style={{ padding: '0.35rem 0.65rem', border: 'none', borderRadius: '0.35rem', background: '#FEE2E2', color: '#B91C1C', cursor: 'pointer', fontWeight: '700' }}>Remove</button>
                    </div>
                  ))}
                  {!(selectedTransaction.attachments || []).length && <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>No documents uploaded yet.</p>}
                </div>
              </div>
              <div style={{ background: '#fff', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem', marginTop: '0.9rem' }}>
                <p style={{ margin: '0 0 0.5rem', color: C.ink, fontWeight: '800' }}>Single transaction workflow</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 1fr) minmax(260px, 1.4fr)', gap: '0.75rem', alignItems: 'start' }}>
                  <textarea value={transactionWorkflowNote} onChange={(e) => setTransactionWorkflowNote(e.target.value)} rows={3} placeholder="Workflow note or mandatory return/rejection reason" style={{ ...modalInputStyle, marginBottom: 0, resize: 'vertical' }} />
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                    {['draft', 'returned', 'rejected'].includes(selectedTransaction.status) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('submit', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#F59E0B', color: '#111827', cursor: 'pointer', fontWeight: '700' }}>Submit</button>}
                    {selectedTransaction.status === 'submitted' && (isSuperAdmin || isFinance) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('approve', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#0EA5E9', color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Approve</button>}
                    {['submitted', 'approved'].includes(selectedTransaction.status) && (isSuperAdmin || isFinance) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('return', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#F472B6', color: '#831843', cursor: 'pointer', fontWeight: '700' }}>Return for Edit</button>}
                    {['submitted', 'approved', 'returned'].includes(selectedTransaction.status) && (isSuperAdmin || isFinance) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('reject', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: '#FEE2E2', color: '#B91C1C', cursor: 'pointer', fontWeight: '700' }}>Reject</button>}
                    {['submitted', 'approved'].includes(selectedTransaction.status) && (isSuperAdmin || isFinance) && <button type="button" disabled={saving} onClick={() => handleTransactionAction('post', selectedTransaction._id)} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: 'none', background: C.s1, color: '#fff', cursor: 'pointer', fontWeight: '700' }}>Post</button>}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 1.2fr) minmax(280px, 1fr)', gap: '0.85rem', marginTop: '0.9rem' }}>
                <div style={{ background: '#fff', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <p style={{ margin: '0 0 0.5rem', color: C.ink, fontWeight: '800' }}>Comments</p>
                  <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.65rem', flexWrap: 'wrap' }}>
                    <textarea value={transactionCommentDraft} onChange={(e) => setTransactionCommentDraft(e.target.value)} rows={3} placeholder="Add transaction comment, reviewer note, or posting note" style={{ ...modalInputStyle, marginBottom: 0, resize: 'vertical', flex: '1 1 240px' }} />
                    <button type="button" disabled={saving} onClick={handleAddTransactionComment} style={{ padding: '0.5rem 0.85rem', border: 'none', background: C.s1, color: '#fff', borderRadius: '0.35rem', cursor: 'pointer', fontWeight: '700', alignSelf: 'start' }}>Add Comment</button>
                  </div>
                  <div style={{ maxHeight: '220px', overflowY: 'auto', display: 'grid', gap: '0.55rem' }}>
                    {(selectedTransaction.comments || []).map((comment) => (
                      <div key={`${comment._id || comment.createdAt}-${comment.message}`} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.45rem', padding: '0.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <span style={{ color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>{comment.createdBy?.name || 'User'}</span>
                          <span style={{ color: C.inkSoft, fontSize: '0.76rem' }}>{comment.createdAt ? new Date(comment.createdAt).toLocaleString() : ''}</span>
                        </div>
                        <p style={{ margin: '0 0 0.2rem', color: '#047857', fontSize: '0.76rem', fontWeight: '700', textTransform: 'uppercase' }}>{formatTransactionCommentKind(comment.kind)}</p>
                        <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>{comment.message}</p>
                      </div>
                    ))}
                    {!(selectedTransaction.comments || []).length && <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>No comments yet.</p>}
                  </div>
                </div>
                <div style={{ background: '#fff', border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem' }}>
                  <p style={{ margin: '0 0 0.5rem', color: C.ink, fontWeight: '800' }}>Approval Audit Trail</p>
                  <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'grid', gap: '0.55rem' }}>
                    {(selectedTransaction.auditTrail || []).slice().reverse().map((entry) => {
                      const auditEntry = formatTransactionAuditEntry(entry, TRANSACTION_ACTION_LABELS)
                      return (
                      <div key={`${entry._id || entry.createdAt}-${entry.action}`} style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.45rem', padding: '0.65rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
                          <span style={{ color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>{auditEntry.title}</span>
                          <span style={{ color: C.inkSoft, fontSize: '0.76rem' }}>{entry.createdAt ? new Date(entry.createdAt).toLocaleString() : ''}</span>
                        </div>
                        <p style={{ margin: '0 0 0.2rem', color: C.inkSoft, fontSize: '0.8rem' }}>Actor: {auditEntry.actorName}</p>
                        <p style={{ margin: '0 0 0.2rem', color: C.inkSoft, fontSize: '0.8rem' }}>Status: {auditEntry.statusText}</p>
                        {auditEntry.comment && <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>{auditEntry.comment}</p>}
                      </div>
                    )})}
                    {!(selectedTransaction.auditTrail || []).length && <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>No workflow history yet.</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th style={{ padding: '0.65rem', textAlign: 'center' }}>
                    <input type="checkbox" checked={allVisibleTransactionsSelected} onChange={toggleVisibleTransactionSelection} />
                  </th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Date</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Party</th>
                  <th style={{ padding: '0.65rem', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: '0.65rem', textAlign: 'left' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr id={`erp-transaction-row-${tx._id}`} key={tx._id} onClick={() => setSelectedTransactionId(tx._id)} style={{ borderBottom: `1px solid ${C.p2}`, background: selectedTransactionId === tx._id ? '#ECFDF5' : 'transparent', outline: selectedTransactionId === tx._id ? '2px solid #10B981' : 'none', outlineOffset: '-2px', cursor: 'pointer' }}>
                    <td style={{ padding: '0.65rem', textAlign: 'center' }}>
                      <input type="checkbox" checked={selectedTransactionIds.includes(tx._id)} onChange={(e) => { e.stopPropagation(); toggleTransactionSelection(tx._id) }} onClick={(e) => e.stopPropagation()} />
                    </td>
                    <td style={{ padding: '0.65rem' }}>{new Date(tx.date).toLocaleDateString()}</td>
                    <td style={{ padding: '0.65rem', textTransform: 'capitalize', fontWeight: '700' }}>{TRANSACTION_TYPE_LABELS[tx.type] || tx.type}</td>
                    <td style={{ padding: '0.65rem' }}>{tx.customerId?.name || tx.vendorId?.name || tx.inventoryItemId?.sku || '-'}</td>
                    <td style={{ padding: '0.65rem', textAlign: 'right' }}>{tx.currency} {Number(tx.amount || 0).toLocaleString()}</td>
                    <td style={{ padding: '0.65rem', textTransform: 'capitalize', fontWeight: '600' }}><span style={{ padding: '0.25rem 0.5rem', borderRadius: '999px', ...(TRANSACTION_STATUS_STYLES[tx.status] || { background: '#E5E7EB', color: C.ink }) }}>{tx.status}</span></td>
                    <td style={{ padding: '0.65rem', maxWidth: '260px', color: C.inkSoft }}>{tx.description || '-'}</td>
                    <td style={{ padding: '0.65rem' }}>
                      <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                        {tx.status !== 'posted' && <button onClick={(e) => { e.stopPropagation(); populateTransactionForm(tx) }} style={{ padding: '0.3rem 0.5rem', border: '1px solid #D1D5DB', borderRadius: '0.3rem', background: '#fff', color: C.ink, cursor: 'pointer' }}>Edit</button>}
                        {['draft', 'returned', 'rejected'].includes(tx.status) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('submit', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#F59E0B', color: '#111827', cursor: 'pointer' }}>Submit</button>}
                        {tx.status === 'submitted' && (isSuperAdmin || isFinance) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('approve', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#0EA5E9', color: '#fff', cursor: 'pointer' }}>Approve</button>}
                        {['submitted', 'approved'].includes(tx.status) && (isSuperAdmin || isFinance) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('return', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#FBCFE8', color: '#9D174D', cursor: 'pointer' }}>Return</button>}
                        {['submitted', 'approved', 'returned'].includes(tx.status) && (isSuperAdmin || isFinance) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('reject', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#FEE2E2', color: '#B91C1C', cursor: 'pointer' }}>Reject</button>}
                        {['submitted', 'approved'].includes(tx.status) && (isSuperAdmin || isFinance) && <button onClick={(e) => { e.stopPropagation(); handleTransactionAction('post', tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: C.s1, color: '#fff', cursor: 'pointer' }}>Post</button>}
                        {tx.status !== 'posted' && <button onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx._id) }} style={{ padding: '0.3rem 0.5rem', border: 'none', borderRadius: '0.3rem', background: '#FEE2E2', color: '#B91C1C', cursor: 'pointer' }}>Delete</button>}
                      </div>
                    </td>
                  </tr>
                ))}
                {!transactions.length && (
                  <tr>
                    <td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: C.inkSoft }}>No transactions match the current filters.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>Showing page {transactionMeta.page} of {transactionPageCount} · {Number(transactionMeta.total || 0).toLocaleString()} total transactions</p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" disabled={transactionMeta.page <= 1 || loading} onClick={() => loadTransactions({ page: Math.max(1, transactionMeta.page - 1) })} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}>Previous</button>
              <button type="button" disabled={transactionMeta.page >= transactionPageCount || loading} onClick={() => loadTransactions({ page: Math.min(transactionPageCount, transactionMeta.page + 1) })} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}>Next</button>
            </div>
          </div>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div>
          <h3 style={{ marginBottom: '1rem', color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Reports (Advanced ERP)</h3>

          <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.6rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
              <select value={reportFilters.period} onChange={(e) => setReportFilters((prev) => ({ ...prev, period: e.target.value }))} style={modalInputStyle}>
                <option value="today">Today</option>
                <option value="month">This Month</option>
                <option value="ytd">Year To Date</option>
                <option value="custom">Custom Range</option>
              </select>
              <input type="date" value={reportFilters.startDate} onChange={(e) => setReportFilters((prev) => ({ ...prev, startDate: e.target.value, period: 'custom' }))} style={modalInputStyle} />
              <input type="date" value={reportFilters.endDate} onChange={(e) => setReportFilters((prev) => ({ ...prev, endDate: e.target.value, period: 'custom' }))} style={modalInputStyle} />
              <select value={reportFilters.accountType} onChange={(e) => setReportFilters((prev) => ({ ...prev, accountType: e.target.value }))} style={modalInputStyle}>
                <option value="">All Account Types</option>
                <option value="Asset">Asset</option>
                <option value="Liability">Liability</option>
                <option value="Income">Income</option>
                <option value="Expense">Expense</option>
                <option value="Equity">Equity</option>
              </select>
              <select value={reportFilters.sortBy} onChange={(e) => setReportFilters((prev) => ({ ...prev, sortBy: e.target.value }))} style={modalInputStyle}>
                <option value="accountCode">Sort: Account Code</option>
                <option value="accountName">Sort: Account Name</option>
                <option value="debit">Sort: Debit</option>
                <option value="credit">Sort: Credit</option>
                <option value="net">Sort: Net</option>
              </select>
              <select value={reportFilters.sortDir} onChange={(e) => setReportFilters((prev) => ({ ...prev, sortDir: e.target.value }))} style={modalInputStyle}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              <select value={reportFilters.referenceType} onChange={(e) => setReportFilters((prev) => ({ ...prev, referenceType: e.target.value }))} style={modalInputStyle}>
                <option value="">All Day Book Types</option>
                {LEDGER_REFERENCE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input type="number" placeholder="Day Book Min Amount" value={reportFilters.minAmount} onChange={(e) => setReportFilters((prev) => ({ ...prev, minAmount: e.target.value }))} style={modalInputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: C.ink, fontSize: '0.86rem', fontWeight: '600' }}>
                  <input type="checkbox" checked={reportFilters.includeZeroAccounts} onChange={(e) => setReportFilters((prev) => ({ ...prev, includeZeroAccounts: e.target.checked }))} />
                  Include zero-balance accounts
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: C.ink, fontSize: '0.86rem', fontWeight: '600' }}>
                  <input type="checkbox" checked={reportFilters.comparePrevious} onChange={(e) => setReportFilters((prev) => ({ ...prev, comparePrevious: e.target.checked }))} />
                  Compare with previous period
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={handleExportReportCsv} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #10B981', background: '#ECFDF5', color: '#065F46', fontWeight: '700', cursor: 'pointer' }}>Export CSV</button>
                <button onClick={handleExportReportXlsx} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #047857', background: '#ECFDF5', color: '#064E3B', fontWeight: '700', cursor: 'pointer' }}>Export XLSX</button>
                <button onClick={handleExportReportPdf} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #EF4444', background: '#FEF2F2', color: '#991B1B', fontWeight: '700', cursor: 'pointer' }}>Export PDF</button>
                <button onClick={handlePrintCurrentReport} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #60A5FA', background: '#EFF6FF', color: '#1E40AF', fontWeight: '700', cursor: 'pointer' }}>Print</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Trial Balance</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Debit: {Number(reports.trialBalance?.totalDebit || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Credit: {Number(reports.trialBalance?.totalCredit || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', color: reports.trialBalance?.balanced ? C.s1 : C.danger, fontWeight: '700', fontSize: '0.82rem' }}>{reports.trialBalance?.balanced ? 'Balanced' : 'Difference Found'}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Profit & Loss</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Income: {Number(reports.profitLoss?.totalIncome || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Expense: {Number(reports.profitLoss?.totalExpense || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontWeight: '700', color: Number(reports.profitLoss?.netProfit || 0) >= 0 ? C.s1 : C.danger, fontSize: '0.82rem' }}>Net: {Number(reports.profitLoss?.netProfit || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Balance Sheet</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Assets: {Number(reports.balanceSheet?.totalAssets || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>L+E: {Number(reports.balanceSheet?.liabilitiesPlusEquity || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>Current Ratio: {reports.balanceSheet?.currentRatio ?? '-'}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Forex Impact</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Entries: {Number(reports.forex?.entriesCount || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Impact: {Number(reports.forex?.forexImpact || 0).toLocaleString()}</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
            {[
              ['summary', 'Summary'],
              ['trial', 'Trial Balance'],
              ['pnl', 'Profit & Loss'],
              ['balanceSheet', 'Balance Sheet'],
              ['dayBook', 'Day Book'],
              ['outstanding', 'Outstanding'],
              ['forex', 'Forex'],
              ['ledger', 'Ledger Drilldown'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setReportView(id)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.35rem',
                  border: reportView === id ? 'none' : '1px solid #D1D5DB',
                  background: reportView === id ? C.s1 : '#FFFFFF',
                  color: reportView === id ? '#fff' : C.ink,
                  fontWeight: '600',
                  cursor: 'pointer',
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {(reportView === 'summary' || reportView === 'trial') && (
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <p style={{ margin: 0, fontWeight: '700', color: C.ink }}>Trial Balance Detailed</p>
                <input placeholder="Search account code/name" value={reportFilters.search} onChange={(e) => setReportFilters((prev) => ({ ...prev, search: e.target.value }))} style={{ ...modalInputStyle, marginBottom: 0, width: '260px' }} />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Code</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Debit</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Credit</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Net</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reports.trialBalance?.trialBalance || [])
                      .filter((row) => {
                        const q = String(reportFilters.search || '').toLowerCase().trim()
                        if (!q) return true
                        return String(row.accountCode || '').toLowerCase().includes(q) || String(row.accountName || '').toLowerCase().includes(q)
                      })
                      .slice(0, 500)
                      .map((row) => (
                        <tr key={`${row.accountCode}-${row.accountType}`} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.6rem', fontWeight: '700' }}>{row.accountCode}</td>
                          <td style={{ padding: '0.6rem' }}>{row.accountName}</td>
                          <td style={{ padding: '0.6rem' }}>{row.accountType}</td>
                          <td style={{ padding: '0.6rem', textAlign: 'right' }}>{Number(row.debit || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.6rem', textAlign: 'right' }}>{Number(row.credit || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.6rem', textAlign: 'right', color: Number(row.net || 0) >= 0 ? C.s1 : C.danger, fontWeight: '700' }}>
                            {formatDirectionalBalance(row.net)}
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <button onClick={() => handleTrialAccountDrilldown(row.accountCode)} style={{ padding: '0.3rem 0.5rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', color: '#0C4A6E', background: '#E0F2FE', cursor: 'pointer' }}>
                              Ledger
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportView === 'pnl' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Income Breakdown</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.55rem', textAlign: 'left' }}>Code</th><th style={{ padding: '0.55rem', textAlign: 'left' }}>Account</th><th style={{ padding: '0.55rem', textAlign: 'right' }}>Amount</th><th style={{ padding: '0.55rem', textAlign: 'left' }}>Action</th></tr></thead>
                    <tbody>
                      {(reports.profitLoss?.incomeBreakdown || []).map((row) => (
                        <tr key={`inc-${row.accountCode}`} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.55rem' }}>{row.accountCode}</td><td style={{ padding: '0.55rem' }}>{row.accountName}</td><td style={{ padding: '0.55rem', textAlign: 'right' }}>{Number(row.amount || 0).toLocaleString()}</td><td style={{ padding: '0.55rem' }}><button onClick={() => handleReportAccountDrilldown(row.accountId, row.accountCode)} style={{ padding: '0.28rem 0.48rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', background: '#EFF6FF', color: '#1E40AF', cursor: 'pointer' }}>Vouchers</button></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Expense Breakdown</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.55rem', textAlign: 'left' }}>Code</th><th style={{ padding: '0.55rem', textAlign: 'left' }}>Account</th><th style={{ padding: '0.55rem', textAlign: 'right' }}>Amount</th><th style={{ padding: '0.55rem', textAlign: 'left' }}>Action</th></tr></thead>
                    <tbody>
                      {(reports.profitLoss?.expenseBreakdown || []).map((row) => (
                        <tr key={`exp-${row.accountCode}`} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.55rem' }}>{row.accountCode}</td><td style={{ padding: '0.55rem' }}>{row.accountName}</td><td style={{ padding: '0.55rem', textAlign: 'right' }}>{Number(row.amount || 0).toLocaleString()}</td><td style={{ padding: '0.55rem' }}><button onClick={() => handleReportAccountDrilldown(row.accountId, row.accountCode)} style={{ padding: '0.28rem 0.48rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', background: '#EFF6FF', color: '#1E40AF', cursor: 'pointer' }}>Vouchers</button></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '0.75rem', borderTop: `1px solid ${C.p2}`, paddingTop: '0.6rem' }}>
                  <p style={{ margin: '0.2rem 0', fontWeight: '700' }}>Total Income: {Number(reports.profitLoss?.totalIncome || 0).toLocaleString()}</p>
                  <p style={{ margin: '0.2rem 0', fontWeight: '700' }}>Total Expense: {Number(reports.profitLoss?.totalExpense || 0).toLocaleString()}</p>
                  <p style={{ margin: '0.2rem 0', fontWeight: '800', color: Number(reports.profitLoss?.netProfit || 0) >= 0 ? C.s1 : C.danger }}>Net Profit: {Number(reports.profitLoss?.netProfit || 0).toLocaleString()}</p>
                  {reports.profitLoss?.previousPeriod && <p style={{ margin: '0.2rem 0', fontWeight: '600', color: C.inkSoft }}>Variance vs previous: {Number(reports.profitLoss?.varianceVsPrevious || 0).toLocaleString()}</p>}
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.6rem' }}>Monthly Comparison</p>
                <div style={{ overflowX: 'auto', marginBottom: '0.9rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Month</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Income</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Expense</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Net Profit</th></tr></thead>
                    <tbody>{(reports.profitLoss?.monthlyComparison || []).map((row) => <tr key={row.label} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.label}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalIncome)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalExpense)}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.netProfit)}</td></tr>)}</tbody>
                  </table>
                </div>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.6rem' }}>Quarterly Comparison</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Quarter</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Income</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Expense</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Net Profit</th></tr></thead>
                    <tbody>{(reports.profitLoss?.quarterlyComparison || []).map((row) => <tr key={row.label} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.label}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalIncome)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalExpense)}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.netProfit)}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportView === 'balanceSheet' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              {[['Assets', reports.balanceSheet?.assets || []], ['Liabilities', reports.balanceSheet?.liabilities || []], ['Equity', reports.balanceSheet?.equity || []]].map(([title, rows]) => (
                <div key={title} style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                  <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>{title}</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Code</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Name</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Balance</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Action</th></tr></thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={`${title}-${row.accountCode}`} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.accountCode}</td><td style={{ padding: '0.5rem' }}>{row.accountName}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatDirectionalBalance(row.balance, { preferredDirection: title === 'Assets' ? 'debit' : 'credit' })}</td><td style={{ padding: '0.5rem' }}><button onClick={() => handleReportAccountDrilldown(row.accountId, row.accountCode)} style={{ padding: '0.28rem 0.48rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', background: '#EFF6FF', color: '#1E40AF', cursor: 'pointer' }}>Vouchers</button></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: '0.15rem 0', fontWeight: '700' }}>Assets: {Number(reports.balanceSheet?.totalAssets || 0).toLocaleString()}</p>
                <p style={{ margin: '0.15rem 0', fontWeight: '700' }}>Liabilities + Equity: {Number(reports.balanceSheet?.liabilitiesPlusEquity || 0).toLocaleString()}</p>
                <p style={{ margin: '0.15rem 0', color: Math.abs(Number(reports.balanceSheet?.difference || 0)) < 0.01 ? C.s1 : C.danger, fontWeight: '800' }}>Difference: {Number(reports.balanceSheet?.difference || 0).toLocaleString()}</p>
                <p style={{ margin: '0.15rem 0' }}>Working Capital: {Number(reports.balanceSheet?.workingCapital || 0).toLocaleString()}</p>
                <p style={{ margin: '0.15rem 0' }}>Current Ratio: {reports.balanceSheet?.currentRatio ?? '-'}</p>
              </div>
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.6rem' }}>Monthly Comparison</p>
                <div style={{ overflowX: 'auto', marginBottom: '0.9rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Month</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Assets</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Liabilities</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Equity</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Working Capital</th></tr></thead>
                    <tbody>{(reports.balanceSheet?.monthlyComparison || []).map((row) => <tr key={row.label} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.label}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalAssets)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalLiabilities)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalEquity)}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.workingCapital)}</td></tr>)}</tbody>
                  </table>
                </div>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.6rem' }}>Quarterly Comparison</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Quarter</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Assets</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Liabilities</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Equity</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Working Capital</th></tr></thead>
                    <tbody>{(reports.balanceSheet?.quarterlyComparison || []).map((row) => <tr key={row.label} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.label}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalAssets)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalLiabilities)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalEquity)}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.workingCapital)}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportView === 'dayBook' && (
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Day Book Entries</p>
              <p style={{ margin: '0 0 0.5rem', color: C.inkSoft, fontSize: '0.84rem' }}>
                Total Entries: {reports.dayBook?.totals?.count || 0} | Debit: {Number(reports.dayBook?.totals?.debit || 0).toLocaleString()} | Credit: {Number(reports.dayBook?.totals?.credit || 0).toLocaleString()}
              </p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Debit A/C</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Credit A/C</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(reports.dayBook?.entries || []).slice(0, 600).map((entry) => (
                      <tr key={entry._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                        <td style={{ padding: '0.5rem' }}>{new Date(entry.date).toLocaleString()}</td>
                        <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{entry.referenceType}</td>
                        <td style={{ padding: '0.5rem' }}>{entry.description || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{entry.debitAccountId?.accountCode} - {entry.debitAccountId?.accountName}</td>
                        <td style={{ padding: '0.5rem' }}>{entry.creditAccountId?.accountCode} - {entry.creditAccountId?.accountName}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(entry.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportView === 'outstanding' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.45rem' }}>Customer Outstanding</p>
                <p style={{ margin: '0 0 0.45rem', color: C.inkSoft, fontSize: '0.84rem' }}>Total: {Number(reports.customerOutstanding?.totals?.outstanding || 0).toLocaleString()} | Limit Exceeded: {reports.customerOutstanding?.totals?.limitExceededCount || 0}</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Customer</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Ledger</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Outstanding</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>0-30</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>31-60</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>61-90</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>90+</th><th style={{ padding: '0.5rem', textAlign: 'center' }}>Limit</th></tr></thead>
                    <tbody>
                      {(reports.customerOutstanding?.rows || []).map((row) => (
                        <tr key={row.customerId} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.5rem' }}>{row.customerName}</td>
                          <td style={{ padding: '0.5rem' }}>{row.ledgerAccount?.accountCode || '-'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(row.outstanding || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.aging?.bucket0to30 || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.aging?.bucket31to60 || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.aging?.bucket61to90 || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.aging?.bucket90Plus || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', color: row.limitExceeded ? C.danger : C.s1, fontWeight: '700' }}>{row.limitExceeded ? 'Exceeded' : 'OK'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.45rem' }}>Vendor Outstanding</p>
                <p style={{ margin: '0 0 0.45rem', color: C.inkSoft, fontSize: '0.84rem' }}>Total: {Number(reports.vendorOutstanding?.totals?.outstanding || 0).toLocaleString()} | Credit: {Number(reports.vendorOutstanding?.totals?.credit || 0).toLocaleString()}</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Vendor</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Ledger</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Outstanding</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th></tr></thead>
                    <tbody>
                      {(reports.vendorOutstanding?.rows || []).map((row) => (
                        <tr key={row.vendorId} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.5rem' }}>{row.vendorName}</td>
                          <td style={{ padding: '0.5rem' }}>{row.ledgerAccount?.accountCode || '-'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(row.outstanding || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem' }}>{row.outstandingType || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportView === 'forex' && (
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Forex Gain/Loss Analysis</p>
              <p style={{ margin: '0 0 0.6rem', color: C.inkSoft, fontSize: '0.84rem' }}>Entries: {reports.forex?.entriesCount || 0} | Total Impact: {Number(reports.forex?.forexImpact || 0).toLocaleString()}</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Currency</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Entries</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Impact</th></tr></thead>
                  <tbody>
                    {Object.entries(reports.forex?.byCurrency || {}).map(([currency, row]) => (
                      <tr key={currency} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{currency}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.count || 0).toLocaleString()}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(row.impact || 0).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportView === 'ledger' && (
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <select
                  value={selectedReportAccountId}
                  onChange={(e) => {
                    const account = accounts.find((acc) => acc._id === e.target.value)
                    setSelectedReportAccountId(e.target.value)
                    setSelectedReportAccountCode(account?.accountCode || '')
                    loadLedgerReport(e.target.value)
                  }}
                  style={{ ...modalInputStyle, marginBottom: 0 }}
                >
                  <option value="">Select Account For Ledger Drilldown</option>
                  {accounts.map((account) => (
                    <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                  ))}
                </select>
                {selectedReportAccountCode && <span style={{ color: C.inkSoft, fontWeight: '700', fontSize: '0.84rem' }}>Account: {selectedReportAccountCode}</span>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Voucher</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Description</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Debit A/C</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Credit A/C</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Running</th></tr></thead>
                  <tbody>
                    {ledgerReportRows.map((row, i) => (
                      <tr key={`${row.date}-${i}`} style={{ borderBottom: `1px solid ${C.p2}` }}>
                        <td style={{ padding: '0.5rem', fontWeight: '700' }}>{String(row.entryId || '').slice(-6).toUpperCase()}</td>
                        <td style={{ padding: '0.5rem' }}>{new Date(row.date).toLocaleString()}</td>
                        <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{row.referenceType}</td>
                        <td style={{ padding: '0.5rem' }}>{row.description || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{row.debitAccount?.accountCode || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{row.creditAccount?.accountCode || '-'}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: Number(row.runningBalance || 0) >= 0 ? C.s1 : C.danger }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span>{Number(row.runningBalance || 0).toLocaleString()}</span>
                            <button onClick={() => handleOpenVoucherSource(row.entryId)} style={{ padding: '0.25rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #D1D5DB', background: '#F9FAFB', color: C.ink, cursor: 'pointer', fontSize: '0.74rem', fontWeight: '700' }}>Source</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {loading && <p style={{ color: C.inkSoft, marginTop: '0.8rem' }}>Loading report data...</p>}

          {voucherSource && (
            <div style={modalBackdropStyle} onClick={() => !voucherSourceLoading && setVoucherSource(null)}>
              <div style={{ ...modalCardStyle, width: 'min(760px, 100%)' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, color: C.ink }}>Voucher Source Drilldown</h4>
                    <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.85rem' }}>Trace journal entry back to source transaction or manual voucher.</p>
                  </div>
                  <button onClick={() => setVoucherSource(null)} style={{ padding: '0.45rem 0.75rem', border: '1px solid #D1D5DB', background: '#fff', borderRadius: '0.35rem', cursor: 'pointer' }}>Close</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={emptyCardStyle}>
                    <p style={{ margin: 0, fontWeight: '700', color: C.ink }}>Ledger Voucher</p>
                    <p style={{ margin: '0.35rem 0 0' }}>Type: {voucherSource.ledgerEntry?.referenceType || '-'}</p>
                    <p style={{ margin: '0.2rem 0 0' }}>Date: {voucherSource.ledgerEntry?.date ? new Date(voucherSource.ledgerEntry.date).toLocaleString() : '-'}</p>
                    <p style={{ margin: '0.2rem 0 0' }}>Debit: {voucherSource.ledgerEntry?.debitAccountId?.accountCode || '-'} - {voucherSource.ledgerEntry?.debitAccountId?.accountName || ''}</p>
                    <p style={{ margin: '0.2rem 0 0' }}>Credit: {voucherSource.ledgerEntry?.creditAccountId?.accountCode || '-'} - {voucherSource.ledgerEntry?.creditAccountId?.accountName || ''}</p>
                    <p style={{ margin: '0.2rem 0 0', fontWeight: '700' }}>Amount: {formatMoney(voucherSource.ledgerEntry?.amount)}</p>
                  </div>

                  <div style={emptyCardStyle}>
                    <p style={{ margin: 0, fontWeight: '700', color: C.ink }}>Source Record</p>
                    {voucherSource.sourceTransaction ? (
                      <>
                        <p style={{ margin: '0.35rem 0 0' }}>Status: {voucherSource.sourceTransaction.status}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Type: {voucherSource.sourceTransaction.type}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Amount: {formatMoney(voucherSource.sourceTransaction.amount)} {voucherSource.sourceTransaction.currency || 'USD'}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Customer: {voucherSource.sourceTransaction.customerId?.name || '-'}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Vendor: {voucherSource.sourceTransaction.vendorId?.name || '-'}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Inventory: {voucherSource.sourceTransaction.inventoryItemId?.sku || voucherSource.sourceTransaction.inventoryItemId?.name || '-'}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Mapping: {voucherSource.sourceTransaction.mappingId?.mappingType || '-'}</p>
                      </>
                    ) : (
                      <p style={{ margin: '0.35rem 0 0' }}>No transaction record linked. This appears to be a manual journal or system-only voucher.</p>
                    )}
                  </div>
                </div>

                {voucherSource.sourceTransaction && (
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', padding: '0.85rem' }}>
                    <p style={{ margin: 0, fontWeight: '700', color: C.ink, marginBottom: '0.45rem' }}>Narration</p>
                    <p style={{ margin: 0, color: C.inkSoft }}>{voucherSource.sourceTransaction.description || 'No description available.'}</p>
                  </div>
                )}

                {voucherSource.sourceTransaction && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => handleJumpToTransaction(voucherSource.sourceTransaction._id)} style={{ padding: '0.5rem 0.85rem', border: 'none', background: C.s1, color: '#fff', borderRadius: '0.35rem', cursor: 'pointer', fontWeight: '700' }}>Open In Transactions</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VENDORS TAB */}
      {activeTab === 'vendors' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Vendors Management</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button
                onClick={handleVendorFilterSearch}
                style={{ padding: '0.5rem 0.85rem', background: '#E0F2FE', color: '#075985', border: '1px solid #7DD3FC', borderRadius: '0.4rem', cursor: 'pointer', fontWeight: '600' }}
              >
                Refresh List
              </button>
              <button
                onClick={() => {
                  setEditingVendorId('')
                  setShowVendorForm((prev) => !prev)
                }}
                disabled={!canManageVendors}
                style={{ padding: '0.5rem 0.85rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.4rem', cursor: canManageVendors ? 'pointer' : 'not-allowed', opacity: canManageVendors ? 1 : 0.55, fontWeight: '600' }}
              >
                + Add Vendor
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #059669', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Total Vendors</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.totalVendors}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #0284C7', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Total Outstanding</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{Number(vendorSummary.totalOutstanding || 0).toLocaleString()}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #D97706', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Over Limit</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.overLimit}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #DC2626', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Blacklisted</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.blacklisted}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #8B5CF6', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>In Review</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.review || 0}</p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderLeft: '4px solid #D97706', borderRadius: '0.5rem', padding: '0.85rem' }}>
              <p style={{ margin: 0, color: C.t3, fontSize: '0.78rem' }}>Non-Compliant</p>
              <p style={{ margin: '0.3rem 0 0', color: C.ink, fontWeight: '700', fontSize: '1.25rem' }}>{vendorSummary.nonCompliant || 0}</p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '1rem' }}>
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#991B1B', fontSize: '0.76rem' }}>Overdue Dues</p>
              <p style={{ margin: '0.2rem 0 0', color: '#7F1D1D', fontWeight: '700' }}>{vendorPaymentCalendar.alerts?.overdue || 0}</p>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#92400E', fontSize: '0.76rem' }}>Due Soon (7d)</p>
              <p style={{ margin: '0.2rem 0 0', color: '#78350F', fontWeight: '700' }}>{vendorPaymentCalendar.alerts?.due_soon || 0}</p>
            </div>
            <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#1D4ED8', fontSize: '0.76rem' }}>Upcoming</p>
              <p style={{ margin: '0.2rem 0 0', color: '#1E3A8A', fontWeight: '700' }}>{vendorPaymentCalendar.alerts?.upcoming || 0}</p>
            </div>
            <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.76rem' }}>Total Due Amount</p>
              <p style={{ margin: '0.2rem 0 0', color: C.ink, fontWeight: '700' }}>{Number(vendorPaymentCalendar.alerts?.totalDue || 0).toLocaleString()}</p>
            </div>
            <div style={{ background: '#EFF6FF', border: '1px solid #93C5FD', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#1D4ED8', fontSize: '0.76rem' }}>Doc Warning 30d</p>
              <p style={{ margin: '0.2rem 0 0', color: '#1E3A8A', fontWeight: '700' }}>{vendorComplianceSummary.expiryBuckets?.warning30 || 0}</p>
            </div>
            <div style={{ background: '#EEF2FF', border: '1px solid #A5B4FC', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#3730A3', fontSize: '0.76rem' }}>Doc Warning 60d</p>
              <p style={{ margin: '0.2rem 0 0', color: '#312E81', fontWeight: '700' }}>{vendorComplianceSummary.expiryBuckets?.warning60 || 0}</p>
            </div>
            <div style={{ background: '#F5F3FF', border: '1px solid #C4B5FD', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#5B21B6', fontSize: '0.76rem' }}>Doc Warning 90d</p>
              <p style={{ margin: '0.2rem 0 0', color: '#4C1D95', fontWeight: '700' }}>{vendorComplianceSummary.expiryBuckets?.warning90 || 0}</p>
            </div>
            <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#991B1B', fontSize: '0.76rem' }}>Doc Expired</p>
              <p style={{ margin: '0.2rem 0 0', color: '#7F1D1D', fontWeight: '700' }}>{vendorComplianceSummary.expiryBuckets?.expired || 0}</p>
            </div>
            <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '0.45rem', padding: '0.55rem' }}>
              <p style={{ margin: 0, color: '#92400E', fontSize: '0.76rem' }}>Overdue Queue</p>
              <p style={{ margin: '0.2rem 0 0', color: '#78350F', fontWeight: '700' }}>{vendorOverdueQueue.summary?.total || 0} alerts</p>
            </div>
          </div>

          <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.45rem' }}>
              <p style={{ margin: 0, color: C.ink, fontWeight: '700', fontSize: '0.9rem' }}>Overdue Email Queue Payload</p>
              <button onClick={loadVendorOverdueQueue} style={{ padding: '0.3rem 0.6rem', borderRadius: '0.35rem', border: '1px solid #7DD3FC', background: '#E0F2FE', color: '#075985', cursor: 'pointer', fontSize: '0.74rem', fontWeight: '600' }}>Refresh Queue</button>
            </div>
            <p style={{ margin: '0 0 0.4rem', color: C.inkSoft, fontSize: '0.78rem' }}>
              Total: {vendorOverdueQueue.summary?.total || 0} | With Recipient: {vendorOverdueQueue.summary?.withRecipient || 0} | Critical: {vendorOverdueQueue.summary?.critical || 0} | Amount Due: {Number(vendorOverdueQueue.summary?.totalAmountDue || 0).toLocaleString()}
            </p>
            <div style={{ maxHeight: '130px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
              {(vendorOverdueQueue.queue || []).slice(0, 12).map((row) => (
                <div key={row.queueId} style={{ padding: '0.45rem', borderBottom: `1px solid ${C.p2}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem', alignItems: 'center' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: '700', color: C.ink }}>{row.subject}</span>
                    <span style={{ fontSize: '0.7rem', color: row.priority === 'high' ? '#991B1B' : '#92400E', fontWeight: '700' }}>{row.priority}</span>
                  </div>
                  <div style={{ fontSize: '0.71rem', color: C.inkSoft, marginTop: '0.15rem' }}>To: {(row.to || []).join(', ') || 'No recipient email'}</div>
                  <div style={{ fontSize: '0.71rem', color: C.inkSoft, marginTop: '0.1rem' }}>{row.preview}</div>
                </div>
              ))}
              {(!vendorOverdueQueue.queue || !vendorOverdueQueue.queue.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No overdue queue payloads right now.</p>}
            </div>
          </div>

          <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem' }}>
              <input
                placeholder="Search name, code, contact, phone"
                value={vendorFilters.search}
                onChange={(e) => setVendorFilters((prev) => ({ ...prev, search: e.target.value }))}
                style={modalInputStyle}
              />
              <select value={vendorFilters.status} onChange={(e) => setVendorFilters((prev) => ({ ...prev, status: e.target.value }))} style={modalInputStyle}>
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
              <select value={vendorFilters.approvalStatus} onChange={(e) => setVendorFilters((prev) => ({ ...prev, approvalStatus: e.target.value }))} style={modalInputStyle}>
                <option value="">All Workflow</option>
                <option value="draft">Draft</option>
                <option value="review">Review</option>
                <option value="approved">Approved</option>
                <option value="blacklisted">Blacklisted</option>
              </select>
              <select value={vendorFilters.riskLevel} onChange={(e) => setVendorFilters((prev) => ({ ...prev, riskLevel: e.target.value }))} style={modalInputStyle}>
                <option value="">All Risk</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
              <input
                placeholder="Category"
                value={vendorFilters.category}
                onChange={(e) => setVendorFilters((prev) => ({ ...prev, category: e.target.value }))}
                style={modalInputStyle}
              />
            </div>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.25rem', color: C.inkSoft, fontSize: '0.82rem' }}>
              <input type="checkbox" checked={vendorFilters.includeInactive} onChange={(e) => setVendorFilters((prev) => ({ ...prev, includeInactive: e.target.checked }))} />
              Include inactive vendors
            </label>
          </div>

          {showVendorForm && (
            <form onSubmit={handleCreateVendor} style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '1rem', marginBottom: '1rem' }}>
              <p style={{ marginTop: 0, marginBottom: '0.6rem', color: C.ink, fontWeight: '700' }}>{editingVendorId ? 'Update Vendor Profile' : 'Create Vendor Profile'}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.5rem' }}>
                <input placeholder="Vendor Code" value={vendorForm.vendorCode} onChange={(e) => setVendorForm((prev) => ({ ...prev, vendorCode: e.target.value.toUpperCase() }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Vendor Name" value={vendorForm.name} onChange={(e) => setVendorForm((prev) => ({ ...prev, name: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Contact Person" value={vendorForm.contactPerson} onChange={(e) => setVendorForm((prev) => ({ ...prev, contactPerson: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Phone" value={vendorForm.phone} onChange={(e) => setVendorForm((prev) => ({ ...prev, phone: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Email" value={vendorForm.email} onChange={(e) => setVendorForm((prev) => ({ ...prev, email: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Address" value={vendorForm.address} onChange={(e) => setVendorForm((prev) => ({ ...prev, address: e.target.value }))} style={modalInputStyle} />
                <input placeholder="City" value={vendorForm.city} onChange={(e) => setVendorForm((prev) => ({ ...prev, city: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Country" value={vendorForm.country} onChange={(e) => setVendorForm((prev) => ({ ...prev, country: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Postal Code" value={vendorForm.postalCode} onChange={(e) => setVendorForm((prev) => ({ ...prev, postalCode: e.target.value }))} style={modalInputStyle} />
                <input placeholder="GST/VAT" value={vendorForm.gstVat} onChange={(e) => setVendorForm((prev) => ({ ...prev, gstVat: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Tax Registration" value={vendorForm.taxRegistrationNo} onChange={(e) => setVendorForm((prev) => ({ ...prev, taxRegistrationNo: e.target.value }))} style={modalInputStyle} />
                <input type="number" step="0.01" placeholder="Opening Balance" value={vendorForm.openingBalance} onChange={(e) => setVendorForm((prev) => ({ ...prev, openingBalance: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input type="number" placeholder="Payment Terms (days)" value={vendorForm.paymentTermsDays} onChange={(e) => setVendorForm((prev) => ({ ...prev, paymentTermsDays: e.target.value }))} style={modalInputStyle} />
                <input type="number" step="0.01" placeholder="Credit Limit" value={vendorForm.creditLimit} onChange={(e) => setVendorForm((prev) => ({ ...prev, creditLimit: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Category" value={vendorForm.category} onChange={(e) => setVendorForm((prev) => ({ ...prev, category: e.target.value }))} style={modalInputStyle} />
                <select value={vendorForm.rating} onChange={(e) => setVendorForm((prev) => ({ ...prev, rating: e.target.value }))} style={modalInputStyle}>
                  <option value="1">1 Star</option>
                  <option value="2">2 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="5">5 Stars</option>
                </select>
                <select value={vendorForm.riskLevel} onChange={(e) => setVendorForm((prev) => ({ ...prev, riskLevel: e.target.value }))} style={modalInputStyle}>
                  <option value="low">Risk Low</option>
                  <option value="medium">Risk Medium</option>
                  <option value="high">Risk High</option>
                </select>
                <select value={vendorForm.status} onChange={(e) => setVendorForm((prev) => ({ ...prev, status: e.target.value }))} style={modalInputStyle}>
                  <option value="active">Status Active</option>
                  <option value="on_hold">Status On Hold</option>
                  <option value="blacklisted">Status Blacklisted</option>
                </select>
                <input placeholder="Preferred Currency" value={vendorForm.preferredCurrency} onChange={(e) => setVendorForm((prev) => ({ ...prev, preferredCurrency: e.target.value.toUpperCase() }))} style={modalInputStyle} />
                <input placeholder="Base Currency" value={vendorForm.currency} onChange={(e) => setVendorForm((prev) => ({ ...prev, currency: e.target.value.toUpperCase() }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Bank Name" value={vendorForm.bankName} onChange={(e) => setVendorForm((prev) => ({ ...prev, bankName: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Bank Account Number" value={vendorForm.bankAccountNumber} onChange={(e) => setVendorForm((prev) => ({ ...prev, bankAccountNumber: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="IBAN" value={vendorForm.iban} onChange={(e) => setVendorForm((prev) => ({ ...prev, iban: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="SWIFT" value={vendorForm.swiftCode} onChange={(e) => setVendorForm((prev) => ({ ...prev, swiftCode: e.target.value }))} style={modalInputStyle} disabled={!canManageVendors} />
                <input placeholder="Tags (comma separated)" value={vendorForm.tags} onChange={(e) => setVendorForm((prev) => ({ ...prev, tags: e.target.value }))} style={modalInputStyle} />
                <input placeholder="Notes" value={vendorForm.notes} onChange={(e) => setVendorForm((prev) => ({ ...prev, notes: e.target.value }))} style={modalInputStyle} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button type="submit" disabled={saving || (!canManageVendors && !editingVendorId)} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.4rem', cursor: 'pointer' }}>{saving ? 'Saving...' : editingVendorId ? 'Update Vendor' : 'Create Vendor'}</button>
                <button type="button" onClick={() => { setShowVendorForm(false); setEditingVendorId('') }} style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.4rem', cursor: 'pointer' }}>Cancel</button>
              </div>
            </form>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 1fr', gap: '1rem' }}>
            <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Code</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Vendor</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Contact</th>
                    <th style={{ padding: '0.6rem', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '0.6rem', textAlign: 'right' }}>Outstanding</th>
                    <th style={{ padding: '0.6rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {vendors.map((v) => (
                    <tr key={v._id} style={{ borderBottom: `1px solid ${C.p2}`, background: selectedVendorId === v._id ? '#ECFEFF' : 'transparent' }}>
                      <td style={{ padding: '0.6rem' }}>{v.vendorCode || '-'}</td>
                      <td style={{ padding: '0.6rem', minWidth: '170px' }}>
                        <div style={{ fontWeight: '700', color: C.ink }}>{v.name}</div>
                        <div style={{ color: C.inkSoft, fontSize: '0.74rem' }}>{v.category || 'general'} | Risk {v.riskLevel || 'medium'}</div>
                      </td>
                      <td style={{ padding: '0.6rem' }}>{v.contactPerson || v.phone || '-'}</td>
                      <td style={{ padding: '0.6rem' }}>
                        <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', background: v.status === 'blacklisted' ? '#FEE2E2' : v.status === 'on_hold' ? '#FEF3C7' : '#DCFCE7', color: v.status === 'blacklisted' ? '#991B1B' : v.status === 'on_hold' ? '#92400E' : '#166534', fontWeight: '700', fontSize: '0.72rem' }}>{v.status || 'active'}</span>
                      </td>
                      <td style={{ padding: '0.6rem', textAlign: 'right', fontWeight: '700', color: v.isOverLimit ? '#DC2626' : C.ink }}>{Number(v.outstanding || 0).toLocaleString()}</td>
                      <td style={{ padding: '0.6rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button onClick={() => handleVendorSelect(v._id)} style={{ padding: '0.25rem 0.55rem', background: '#E0F2FE', border: '1px solid #7DD3FC', borderRadius: '0.3rem', color: '#075985', cursor: 'pointer', fontSize: '0.75rem' }}>View</button>
                          {vendorPermissions.canUpdateOperational && <button onClick={() => handleEditVendor(v)} style={{ padding: '0.25rem 0.55rem', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '0.3rem', color: '#065F46', cursor: 'pointer', fontSize: '0.75rem' }}>Edit</button>}
                          {vendorPermissions.canManage && <button onClick={() => handleDeleteVendor(v)} style={{ padding: '0.25rem 0.55rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.3rem', color: '#991B1B', cursor: 'pointer', fontSize: '0.75rem' }}>Deactivate</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {vendors.length === 0 && <p style={{ color: C.inkSoft, margin: '0.8rem', textAlign: 'center' }}>No vendors found for current filters.</p>}
            </div>

            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.85rem' }}>
              <h4 style={{ marginTop: 0, marginBottom: '0.6rem', color: C.ink, fontWeight: '700' }}>Vendor Details</h4>
              {!selectedVendorDetails?.vendor ? (
                <div style={emptyCardStyle}>Select a vendor to view profile, financial metrics, and recent activity.</div>
              ) : (
                <div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <p style={{ margin: 0, fontWeight: '700', color: C.ink }}>{selectedVendorDetails.vendor.name}</p>
                    <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>{selectedVendorDetails.vendor.vendorCode || '-'} | {selectedVendorDetails.vendor.contactPerson || 'No contact'} | {selectedVendorDetails.vendor.phone || '-'}</p>
                  </div>

                  <div style={{ marginBottom: '0.8rem', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem', background: '#F8FAFC' }}>
                    <p style={{ margin: '0 0 0.4rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Approval Workflow</p>
                    <p style={{ margin: '0 0 0.35rem', color: C.inkSoft, fontSize: '0.76rem' }}>Current: <span style={{ fontWeight: '700', color: C.ink }}>{selectedVendorDetails.vendor.approvalStatus || 'draft'}</span></p>
                    <input
                      placeholder="Reason for transition"
                      value={vendorWorkflowReason}
                      onChange={(e) => setVendorWorkflowReason(e.target.value)}
                      style={{ ...modalInputStyle, marginBottom: '0.45rem' }}
                    />
                    <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                      <button onClick={() => handleVendorWorkflowStatus('draft')} disabled={saving || !vendorPermissions.canUpdateOperational} style={{ padding: '0.25rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #BFDBFE', background: '#EFF6FF', color: '#1D4ED8', cursor: 'pointer', fontSize: '0.74rem' }}>Draft</button>
                      <button onClick={() => handleVendorWorkflowStatus('review')} disabled={saving || !vendorPermissions.canUpdateOperational} style={{ padding: '0.25rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #FDE68A', background: '#FFFBEB', color: '#92400E', cursor: 'pointer', fontSize: '0.74rem' }}>Review</button>
                      <button onClick={() => handleVendorWorkflowStatus('approved')} disabled={saving || !vendorPermissions.canManage} style={{ padding: '0.25rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #6EE7B7', background: '#ECFDF5', color: '#065F46', cursor: 'pointer', fontSize: '0.74rem' }}>Approve</button>
                      <button onClick={() => handleVendorWorkflowStatus('blacklisted')} disabled={saving || !vendorPermissions.canManage} style={{ padding: '0.25rem 0.55rem', borderRadius: '0.3rem', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', cursor: 'pointer', fontSize: '0.74rem' }}>Blacklist</button>
                    </div>
                    <div style={{ marginTop: '0.45rem', maxHeight: '84px', overflowY: 'auto', borderTop: `1px solid ${C.p2}`, paddingTop: '0.45rem' }}>
                      {(selectedVendorDetails.vendor.approvalHistory || []).slice().reverse().slice(0, 5).map((h, idx) => (
                        <p key={`${h.changedAt || idx}-${idx}`} style={{ margin: '0 0 0.3rem', color: C.inkSoft, fontSize: '0.72rem' }}>
                          <strong style={{ color: C.ink }}>{h.status}</strong> {h.reason ? `- ${h.reason}` : ''} ({new Date(h.changedAt).toLocaleString()})
                        </p>
                      ))}
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.8rem', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem', background: '#F8FAFC' }}>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Required Document Compliance</p>
                    <p style={{ margin: '0 0 0.35rem', color: C.inkSoft, fontSize: '0.76rem' }}>
                      Category: <strong style={{ color: C.ink }}>{selectedVendorDetails.vendor.compliance?.category || selectedVendorDetails.vendor.category || 'general'}</strong>
                      {' | '}
                      Score: <strong style={{ color: C.ink }}>{Number(selectedVendorDetails.vendor.compliance?.complianceScore || 0).toLocaleString()}%</strong>
                      {' | '}
                      Status: <strong style={{ color: selectedVendorDetails.vendor.compliance?.compliant ? '#065F46' : '#991B1B' }}>{selectedVendorDetails.vendor.compliance?.compliant ? 'Compliant' : 'At Risk'}</strong>
                    </p>
                    <p style={{ margin: '0 0 0.25rem', color: C.inkSoft, fontSize: '0.74rem' }}>
                      Missing Required: {(selectedVendorDetails.vendor.compliance?.missingDocuments || []).join(', ') || 'None'}
                    </p>
                    <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.74rem' }}>
                      Expired Required: {(selectedVendorDetails.vendor.compliance?.expiredRequiredDocuments || []).join(', ') || 'None'}
                    </p>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
                      <p style={{ margin: 0, color: C.t3, fontSize: '0.75rem' }}>Outstanding</p>
                      <p style={{ margin: '0.2rem 0 0', color: C.ink, fontWeight: '700' }}>{Number(selectedVendorDetails.vendor.outstanding || 0).toLocaleString()}</p>
                    </div>
                    <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
                      <p style={{ margin: 0, color: C.t3, fontSize: '0.75rem' }}>Credit Utilization</p>
                      <p style={{ margin: '0.2rem 0 0', color: selectedVendorDetails.vendor.isOverLimit ? '#DC2626' : C.ink, fontWeight: '700' }}>{Number(selectedVendorDetails.vendor.utilizationPercent || 0).toLocaleString()}%</p>
                    </div>
                    <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
                      <p style={{ margin: 0, color: C.t3, fontSize: '0.75rem' }}>Posted Purchases</p>
                      <p style={{ margin: '0.2rem 0 0', color: C.ink, fontWeight: '700' }}>{selectedVendorDetails.vendor.purchaseCount || 0}</p>
                    </div>
                    <div style={{ background: '#F8FAFC', border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.55rem' }}>
                      <p style={{ margin: 0, color: C.t3, fontSize: '0.75rem' }}>Posted Payments</p>
                      <p style={{ margin: '0.2rem 0 0', color: C.ink, fontWeight: '700' }}>{selectedVendorDetails.vendor.paymentCount || 0}</p>
                    </div>
                  </div>

                  <div style={{ marginBottom: '0.6rem' }}>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Recent Transactions</p>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
                      {(selectedVendorDetails.recentTransactions || []).map((tx) => (
                        <div key={tx._id} style={{ padding: '0.5rem', borderBottom: `1px solid ${C.p2}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <span style={{ color: C.ink, fontWeight: '600', fontSize: '0.77rem', textTransform: 'capitalize' }}>{tx.type} ({tx.status})</span>
                            <span style={{ color: C.ink, fontWeight: '700', fontSize: '0.77rem' }}>{Number(tx.amount || 0).toLocaleString()} {tx.currency || 'USD'}</span>
                          </div>
                          <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>{new Date(tx.date).toLocaleString()}</div>
                        </div>
                      ))}
                      {(!selectedVendorDetails.recentTransactions || !selectedVendorDetails.recentTransactions.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No recent transactions.</p>}
                    </div>
                  </div>

                  <div>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Recent Ledger Activity</p>
                    <div style={{ maxHeight: '150px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
                      {(selectedVendorDetails.recentLedgerEntries || []).map((entry) => (
                        <div key={entry._id} style={{ padding: '0.5rem', borderBottom: `1px solid ${C.p2}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.4rem' }}>
                            <span style={{ color: C.ink, fontWeight: '600', fontSize: '0.77rem', textTransform: 'capitalize' }}>{entry.referenceType}</span>
                            <span style={{ color: C.ink, fontWeight: '700', fontSize: '0.77rem' }}>{Number(entry.amount || 0).toLocaleString()} {entry.currency || 'USD'}</span>
                          </div>
                          <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>{new Date(entry.date).toLocaleString()}</div>
                        </div>
                      ))}
                      {(!selectedVendorDetails.recentLedgerEntries || !selectedVendorDetails.recentLedgerEntries.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No recent ledger activity.</p>}
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Document Vault</p>
                    <form onSubmit={handleAddVendorDocument} style={{ border: `1px solid ${C.p2}`, borderRadius: '0.45rem', padding: '0.5rem', marginBottom: '0.45rem', background: '#F8FAFC' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
                        <select value={vendorDocumentForm.docType} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, docType: e.target.value }))} style={modalInputStyle}>
                          <option value="contract">Contract</option>
                          <option value="trade_license">Trade License</option>
                          <option value="vat_certificate">VAT Certificate</option>
                          <option value="bank_proof">Bank Proof</option>
                          <option value="other">Other</option>
                        </select>
                        <input placeholder="Title" value={vendorDocumentForm.title} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, title: e.target.value }))} style={modalInputStyle} />
                        <input placeholder="Document No" value={vendorDocumentForm.documentNo} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, documentNo: e.target.value }))} style={modalInputStyle} />
                        <input placeholder="File URL" value={vendorDocumentForm.fileUrl} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, fileUrl: e.target.value }))} style={modalInputStyle} />
                        <input type="date" value={vendorDocumentForm.issueDate} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, issueDate: e.target.value }))} style={modalInputStyle} />
                        <input type="date" value={vendorDocumentForm.expiryDate} onChange={(e) => setVendorDocumentForm((prev) => ({ ...prev, expiryDate: e.target.value }))} style={modalInputStyle} />
                      </div>
                      <button type="submit" disabled={saving || !vendorPermissions.canUpdateOperational} style={{ padding: '0.3rem 0.6rem', borderRadius: '0.32rem', border: '1px solid #6EE7B7', background: '#ECFDF5', color: '#065F46', cursor: 'pointer', fontSize: '0.74rem' }}>Add Document</button>
                    </form>
                    <div style={{ maxHeight: '140px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
                      {(selectedVendorDetails.vendor.documents || []).map((doc) => (
                        <div key={doc._id} style={{ padding: '0.45rem', borderBottom: `1px solid ${C.p2}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem' }}>
                            <span style={{ color: C.ink, fontWeight: '600', fontSize: '0.74rem' }}>{doc.docType} - {doc.title}</span>
                            {vendorPermissions.canUpdateOperational && <button onClick={() => handleDeleteVendorDocument(doc._id)} style={{ padding: '0.2rem 0.45rem', borderRadius: '0.28rem', border: '1px solid #FCA5A5', background: '#FEF2F2', color: '#991B1B', cursor: 'pointer', fontSize: '0.7rem' }}>Delete</button>}
                          </div>
                          <div style={{ color: C.inkSoft, fontSize: '0.71rem' }}>{doc.documentNo || '-'} {doc.expiryDate ? `| Exp: ${new Date(doc.expiryDate).toLocaleDateString()}` : ''}</div>
                        </div>
                      ))}
                      {(!selectedVendorDetails.vendor.documents || !selectedVendorDetails.vendor.documents.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No documents uploaded.</p>}
                    </div>
                  </div>

                  <div style={{ marginTop: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.35rem', color: C.ink, fontWeight: '700', fontSize: '0.82rem' }}>Payment Calendar & Due Alerts</p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(70px, 1fr))', gap: '0.35rem', marginBottom: '0.45rem' }}>
                      <div style={{ border: `1px solid ${C.p2}`, borderRadius: '0.35rem', padding: '0.35rem', background: '#FEF2F2' }}><p style={{ margin: 0, fontSize: '0.68rem', color: C.inkSoft }}>Overdue</p><p style={{ margin: '0.15rem 0 0', fontWeight: '700', color: '#991B1B', fontSize: '0.82rem' }}>{selectedVendorDetails.paymentAlerts?.overdue || 0}</p></div>
                      <div style={{ border: `1px solid ${C.p2}`, borderRadius: '0.35rem', padding: '0.35rem', background: '#FFFBEB' }}><p style={{ margin: 0, fontSize: '0.68rem', color: C.inkSoft }}>Due Soon</p><p style={{ margin: '0.15rem 0 0', fontWeight: '700', color: '#92400E', fontSize: '0.82rem' }}>{selectedVendorDetails.paymentAlerts?.due_soon || 0}</p></div>
                      <div style={{ border: `1px solid ${C.p2}`, borderRadius: '0.35rem', padding: '0.35rem', background: '#EFF6FF' }}><p style={{ margin: 0, fontSize: '0.68rem', color: C.inkSoft }}>Upcoming</p><p style={{ margin: '0.15rem 0 0', fontWeight: '700', color: '#1D4ED8', fontSize: '0.82rem' }}>{selectedVendorDetails.paymentAlerts?.upcoming || 0}</p></div>
                      <div style={{ border: `1px solid ${C.p2}`, borderRadius: '0.35rem', padding: '0.35rem', background: '#F8FAFC' }}><p style={{ margin: 0, fontSize: '0.68rem', color: C.inkSoft }}>Later</p><p style={{ margin: '0.15rem 0 0', fontWeight: '700', color: C.ink, fontSize: '0.82rem' }}>{selectedVendorDetails.paymentAlerts?.later || 0}</p></div>
                    </div>
                    <div style={{ maxHeight: '130px', overflowY: 'auto', border: `1px solid ${C.p2}`, borderRadius: '0.45rem' }}>
                      {(selectedVendorDetails.paymentCalendar || []).map((due) => (
                        <div key={`${due.purchaseTransactionId}-${due.dueDate}`} style={{ padding: '0.45rem', borderBottom: `1px solid ${C.p2}` }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.35rem' }}>
                            <span style={{ fontSize: '0.74rem', fontWeight: '600', color: C.ink }}>{Number(due.remaining || 0).toLocaleString()} {due.currency || 'USD'}</span>
                            <span style={{ fontSize: '0.71rem', color: due.alertLevel === 'overdue' ? '#991B1B' : due.alertLevel === 'due_soon' ? '#92400E' : C.inkSoft }}>{due.alertLevel} ({due.daysToDue}d)</span>
                          </div>
                          <div style={{ fontSize: '0.71rem', color: C.inkSoft }}>Due {new Date(due.dueDate).toLocaleDateString()}</div>
                        </div>
                      ))}
                      {(!selectedVendorDetails.paymentCalendar || !selectedVendorDetails.paymentCalendar.length) && <p style={{ margin: '0.55rem', color: C.inkSoft, fontSize: '0.75rem' }}>No pending due amounts in horizon.</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY TAB */}
      {activeTab === 'inventory' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Inventory Workspace</h3>
              <p style={{ margin: '0.35rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>Rebuilt inventory area with separate cards for stock types, products, and reporting.</p>
            </div>
            <button type="button" onClick={loadInventory} style={{ padding: '0.55rem 0.95rem', background: '#E2E8F0', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.45rem', cursor: 'pointer', fontWeight: '700' }}>Refresh Inventory</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem', alignItems: 'start' }}>
            <div style={{ background: '#FCFFFC', border: '1px solid #CDE7D4', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 8px 18px rgba(5, 150, 105, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#14532D', fontSize: '1rem' }}>Stock Type Creation</p>
                  <p style={{ margin: '0.35rem 0 0', color: '#3F5F48', fontSize: '0.8rem', lineHeight: 1.5 }}>Create the master stock types that define metal, material type, purity, and stock-code mapping.</p>
                </div>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#DCFCE7', color: '#166534', fontWeight: '800', fontSize: '0.74rem' }}>{inventoryMappingProducts.length}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingProductId('')
                  setInventoryMappingForm(createInventoryMappingForm())
                  setInventoryStockCodeManualOverride(false)
                  setInventoryModalOffset({ x: 0, y: 0 })
                  setShowInventoryMappingModal(true)
                }}
                style={{ marginTop: '0.85rem', width: '100%', padding: '0.7rem 0.95rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700' }}
              >
                + Create Stock Type
              </button>
              <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.55rem' }}>
                {inventoryMappingProducts.slice(0, 4).map((item) => {
                  const meta = decodeInventoryCategoryMeta(item.category)
                  return (
                    <div key={item._id} style={{ border: '1px solid #DCFCE7', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: '700', color: C.ink }}>{titleCaseWords(meta.mainStock || meta.metalType || item.name)}</span>
                        {Number(item.unitCost || 0) > 0 && <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#166534', background: '#DCFCE7', padding: '0.15rem 0.4rem', borderRadius: '0.25rem' }}>{Number(item.unitCost).toLocaleString()} {item.currency || 'USD'}/{meta.priceUnit || 'OZ'}</span>}
                      </div>
                      <div style={{ marginTop: '0.2rem', color: C.inkSoft, fontSize: '0.75rem' }}>Main Stock Mapping</div>
                      <div style={{ marginTop: '0.45rem', display: 'flex', gap: '0.35rem' }}>
                        <button onClick={() => handleEditProduct(item)} style={{ padding: '0.28rem 0.55rem', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '0.3rem', color: '#065F46', cursor: 'pointer', fontSize: '0.72rem' }}>Edit</button>
                        {(isSuperAdmin || isFinance) && <button onClick={() => handleDeleteProduct(item)} style={{ padding: '0.28rem 0.55rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.3rem', color: '#991B1B', cursor: 'pointer', fontSize: '0.72rem' }}>Delete</button>}
                      </div>
                    </div>
                  )
                })}
                {!inventoryMappingProducts.length && <div style={{ border: '1px dashed #BBF7D0', borderRadius: '0.5rem', padding: '0.75rem', color: '#166534', fontSize: '0.8rem' }}>No stock types yet. Create your first stock type to define mapping rules.</div>}
              </div>
            </div>

            <div style={{ background: '#FFFDF8', border: '1px solid #F2DFC1', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 8px 18px rgba(180, 83, 9, 0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#92400E', fontSize: '1rem' }}>Product Creation</p>
                  <p style={{ margin: '0.35rem 0 0', color: '#7C5A12', fontSize: '0.8rem', lineHeight: 1.5 }}>Create products with Product Category, Name, Description, Weight, Gross Weight, Purity, Tax Type, VAT %, and Purity Weight.</p>
                </div>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#FEF3C7', color: '#92400E', fontWeight: '800', fontSize: '0.74rem' }}>{inventoryCatalogProducts.length}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingInventoryProductId('')
                  setInventoryProductModalOffset({ x: 0, y: 0 })
                  setShowInventoryProductModal(true)
                }}
                style={{ marginTop: '0.85rem', width: '100%', padding: '0.7rem 0.95rem', background: '#B45309', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700' }}
              >
                + Create Product
              </button>
              <div style={{ marginTop: '0.85rem', display: 'grid', gap: '0.55rem' }}>
                {Object.entries(inventoryProductsByMetal).slice(0, 4).map(([metal, entries]) => (
                  <div key={metal} style={{ border: '1px solid #FDE68A', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}>
                    <div style={{ fontWeight: '800', color: '#92400E', fontSize: '0.78rem', marginBottom: '0.35rem' }}>{metal}</div>
                    <div style={{ display: 'grid', gap: '0.4rem' }}>
                      {entries.slice(0, 3).map(({ item, meta }) => (
                        <div key={item._id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', borderTop: '1px solid #FEF3C7', paddingTop: '0.35rem' }}>
                          <div>
                            <div style={{ fontWeight: '700', color: C.ink, fontSize: '0.76rem' }}>{item.name}</div>
                            <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>Category {meta.productCategory || metal} | Wt {Number(meta.weight || item.quantity || 0).toLocaleString()} g | Purity {meta.productPurity || meta.purity || '-'} | Tax {meta.taxType || '-'} | VAT {formatVatPercent(meta.vatPercent)} | Pure Wt {Number(meta.purityWeight || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                          </div>
                          <div style={{ display: 'grid', justifyItems: 'end', gap: '0.35rem' }}>
                            <div style={{ color: '#92400E', fontWeight: '700', fontSize: '0.74rem', maxWidth: '220px', textAlign: 'right' }}>{meta.productDescription || '-'}</div>
                            <div style={{ display: 'flex', gap: '0.35rem' }}>
                              <button type="button" onClick={() => handleEditInventoryCatalogProduct(item, meta)} style={{ padding: '0.24rem 0.55rem', background: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '0.3rem', color: '#065F46', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700' }}>Edit</button>
                              {(isSuperAdmin || isFinance) && <button type="button" onClick={() => handleDeleteInventoryCatalogProduct(item)} style={{ padding: '0.24rem 0.55rem', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '0.3rem', color: '#991B1B', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700' }}>Delete</button>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!inventoryCatalogProducts.length && <div style={{ border: '1px dashed #FCD34D', borderRadius: '0.5rem', padding: '0.75rem', color: '#92400E', fontSize: '0.8rem' }}>No inventory products created yet. Use a stock type to start adding products.</div>}
              </div>
            </div>

            <div style={{ background: '#FBFCFF', border: '1px solid #D9E6FB', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 8px 18px rgba(29, 78, 216, 0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', alignItems: 'flex-start' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: '#1D4ED8', fontSize: '1rem' }}>Inventory Report</p>
                  <p style={{ margin: '0.35rem 0 0', color: '#4B5E8B', fontSize: '0.8rem', lineHeight: 1.5 }}>Live snapshot of stock left by product and metal, including quantity on hand, inventory value, and low-stock exposure.</p>
                </div>
                <span style={{ padding: '0.3rem 0.55rem', borderRadius: '999px', background: '#DBEAFE', color: '#1D4ED8', fontWeight: '800', fontSize: '0.74rem' }}>{inventoryReportProducts.length}</span>
              </div>
              <div style={{ marginTop: '0.85rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.55rem' }}>
                <div style={{ border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}><p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Stock Types</p><p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryMappingProducts.length}</p></div>
                <div style={{ border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}><p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Products</p><p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryCatalogProducts.length}</p></div>
                <div style={{ border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}><p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Stock Left</p><p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryTotalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
                <div style={{ border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.6rem' }}><p style={{ margin: 0, color: C.inkSoft, fontSize: '0.72rem' }}>Inventory Value</p><p style={{ margin: '0.22rem 0 0', color: C.ink, fontWeight: '800' }}>{inventoryTotalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</p></div>
              </div>
              <div style={{ marginTop: '0.7rem', border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontWeight: '700', color: C.ink, fontSize: '0.8rem' }}>Stock Left By Metal</span>
                  <span style={{ color: inventoryLowStockCount > 0 ? '#B45309' : '#1D4ED8', fontWeight: '700', fontSize: '0.75rem' }}>Low Stock: {inventoryLowStockCount}</span>
                </div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {inventoryMetalBreakdown.map((row) => (
                    <div key={row.metal} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', paddingBottom: '0.45rem', borderBottom: '1px solid #EFF6FF' }}>
                      <div>
                        <div style={{ color: C.ink, fontWeight: '700', fontSize: '0.78rem' }}>{row.metal}</div>
                        <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>{row.productCount} product{row.productCount === 1 ? '' : 's'} | Stock Left {row.totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} | Low Stock {row.lowStockCount}</div>
                      </div>
                      <div style={{ color: C.ink, fontWeight: '700', fontSize: '0.78rem', textAlign: 'right' }}>{row.totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                    </div>
                  ))}
                  {!inventoryMetalBreakdown.length && <div style={{ color: C.inkSoft, fontSize: '0.8rem' }}>No metal/product breakdown available yet.</div>}
                </div>
              </div>
              <div style={{ marginTop: '0.7rem', border: '1px solid #DBEAFE', background: '#FFFFFF', borderRadius: '0.5rem', padding: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', marginBottom: '0.45rem' }}>
                  <span style={{ fontWeight: '700', color: C.ink, fontSize: '0.8rem' }}>Top Inventory Items</span>
                  <span style={{ color: '#1D4ED8', fontWeight: '700', fontSize: '0.75rem' }}>Showing highest value items</span>
                </div>
                <div style={{ display: 'grid', gap: '0.45rem' }}>
                  {inventoryTopProducts.map((row) => {
                    const { item, productMeta } = row
                    return (
                      <div key={item._id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.5rem', paddingBottom: '0.4rem', borderBottom: '1px solid #EFF6FF' }}>
                        <div>
                          <div style={{ color: C.ink, fontWeight: '700', fontSize: '0.78rem' }}>{item.name}</div>
                          <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>{row.metal} | Category {row.categoryName} | Stock Left {row.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 })} {row.stockUnit} | Stock Value {row.stockValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                          <div style={{ color: C.inkSoft, fontSize: '0.72rem' }}>Gross Wt {row.weight.toLocaleString(undefined, { maximumFractionDigits: 4 })} g | Purity {row.purity || '-'} | Tax {productMeta.taxType || '-'} | VAT {formatVatPercent(productMeta.vatPercent)} | Pure Wt {row.purityWeight.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
                        </div>
                        <div style={{ color: C.ink, fontWeight: '700', fontSize: '0.78rem', textAlign: 'right' }}>
                          <div>{row.stockValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
                          <div style={{ color: row.quantity <= 0 ? '#B91C1C' : row.isLowStock ? '#B45309' : C.inkSoft, fontSize: '0.7rem' }}>{row.quantity <= 0 ? 'Zero Stock' : row.isLowStock ? 'Low Stock' : 'In Stock'}</div>
                        </div>
                      </div>
                    )
                  })}
                  {!inventoryTopProducts.length && <div style={{ color: C.inkSoft, fontSize: '0.8rem' }}>No inventory movements or product records yet.</div>}
                </div>
              </div>
            </div>
          </div>

          {legacyInventoryProducts.length > 0 && (
            <p style={{ marginTop: '0.8rem', color: '#92400E', fontSize: '0.8rem' }}>
              Legacy inventory records still exist outside the new stock-type/product structure: {legacyInventoryProducts.length}
            </p>
          )}

          {/* All Inventory Items Table */}
          {inventoryReportProducts.length > 0 && (
            <div style={{ marginTop: '1.25rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '800', color: C.ink, fontSize: '1rem' }}>All Inventory Items</p>
                  <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Live stock on hand — quantities updated automatically when sale/purchase vouchers are posted.</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    value={inventoryVatFilter}
                    onChange={(e) => setInventoryVatFilter(e.target.value)}
                    style={{ padding: '0.35rem 0.55rem', border: '1px solid #CBD5E1', borderRadius: '0.4rem', fontSize: '0.78rem', color: C.ink, background: '#FFFFFF' }}
                  >
                    <option value="all">VAT: All</option>
                    <option value="with-vat">VAT: &gt; 0%</option>
                    <option value="zero-or-blank">VAT: 0% / Blank</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => setInventoryVatSortDir((prev) => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none'))}
                    style={{ padding: '0.35rem 0.55rem', border: '1px solid #CBD5E1', borderRadius: '0.4rem', fontSize: '0.78rem', color: C.ink, background: '#FFFFFF', cursor: 'pointer', fontWeight: '600' }}
                  >
                    VAT Sort: {inventoryVatSortDir === 'none' ? 'None' : inventoryVatSortDir === 'asc' ? 'Low-High' : 'High-Low'}
                  </button>
                  <span style={{ padding: '0.3rem 0.6rem', background: '#DBEAFE', color: '#1D4ED8', borderRadius: '999px', fontWeight: '700', fontSize: '0.74rem' }}>{sortedInventoryTableRows.length} items</span>
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                      {['SKU', 'Name', 'Category', 'Tax Type', 'VAT %', 'Qty On Hand', 'Unit', 'Unit Cost', 'Selling Price', 'Total Value', 'Min Stock', 'Status'].map(col => {
                        const isVatCol = col === 'VAT %'
                        const vatSortIndicator = inventoryVatSortDir === 'none' ? '' : inventoryVatSortDir === 'asc' ? ' ▲' : ' ▼'
                        return (
                          <th
                            key={col}
                            onClick={isVatCol ? () => setInventoryVatSortDir((prev) => (prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none')) : undefined}
                            title={isVatCol ? 'Click to sort VAT %' : undefined}
                            style={{
                              padding: '0.55rem 0.7rem',
                              textAlign: col === 'VAT %' || col === 'Qty On Hand' || col === 'Unit Cost' || col === 'Selling Price' || col === 'Total Value' ? 'right' : 'left',
                              color: '#374151',
                              fontWeight: '700',
                              whiteSpace: 'nowrap',
                              cursor: isVatCol ? 'pointer' : 'default',
                              userSelect: isVatCol ? 'none' : 'auto',
                            }}
                          >
                            {isVatCol ? `${col}${vatSortIndicator}` : col}
                          </th>
                        )
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedInventoryTableRows.map(({ item, categoryMeta, productMeta }) => {
                      const lowStock = Number(item.minThreshold || 0) > 0 && Number(item.quantity || 0) <= Number(item.minThreshold || 0)
                      const totalValue = Number(item.quantity || 0) * Number(item.unitCost || 0)
                      return (
                        <tr key={item._id} style={{ borderBottom: '1px solid #F1F5F9', background: lowStock ? '#FFF7ED' : undefined }}>
                          <td style={{ padding: '0.5rem 0.7rem', color: '#6B7280', fontFamily: 'monospace' }}>{item.sku || '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', fontWeight: '600', color: C.ink }}>{item.name}</td>
                          <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, fontSize: '0.78rem' }}>{item.category ? (categoryMeta.mainStock || item.category).slice(0, 30) : '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, fontSize: '0.78rem' }}>{productMeta.taxType || '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.inkSoft, fontSize: '0.78rem' }}>{formatVatPercent(productMeta.vatPercent)}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '700', color: lowStock ? '#B45309' : '#065F46' }}>{Number(item.quantity || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft }}>{item.unit || 'pcs'}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.ink }}>{Number(item.unitCost || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.ink }}>{Number(item.sellingPrice || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '700', color: '#1D4ED8' }}>{totalValue.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                          <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.inkSoft }}>{Number(item.minThreshold || 0) || '—'}</td>
                          <td style={{ padding: '0.5rem 0.7rem' }}>
                            {lowStock
                              ? <span style={{ background: '#FEF3C7', color: '#B45309', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: '700' }}>Low Stock</span>
                              : <span style={{ background: '#DCFCE7', color: '#166534', borderRadius: '999px', padding: '0.2rem 0.55rem', fontSize: '0.72rem', fontWeight: '700' }}>OK</span>
                            }
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Stock Movements from Vouchers */}
          <div style={{ marginTop: '1.25rem', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: '0.7rem', padding: '1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div>
                <p style={{ margin: 0, fontWeight: '800', color: C.ink, fontSize: '1rem' }}>Stock Movement History</p>
                <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Every inventory change from posted sale/purchase vouchers — full audit trail.</p>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  placeholder="Search item or reason..."
                  value={stockMovementsFilter}
                  onChange={e => setStockMovementsFilter(e.target.value)}
                  style={{ padding: '0.4rem 0.7rem', border: '1px solid #D1D5DB', borderRadius: '0.4rem', fontSize: '0.82rem', minWidth: '180px' }}
                />
                <button type="button" onClick={loadStockLedger} style={{ padding: '0.4rem 0.8rem', background: '#E2E8F0', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.4rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.8rem' }}>
                  {stockMovementsLoading ? 'Loading…' : 'Refresh'}
                </button>
                <span style={{ padding: '0.3rem 0.6rem', background: '#F1F5F9', color: '#475569', borderRadius: '999px', fontWeight: '700', fontSize: '0.74rem' }}>{stockMovements.length} entries</span>
              </div>
            </div>
            {stockMovementsLoading
              ? <div style={{ textAlign: 'center', padding: '1.5rem', color: C.inkSoft }}>Loading stock movements…</div>
              : stockMovements.length === 0
                ? (
                  <div style={{ border: '1px dashed #CBD5E0', borderRadius: '0.5rem', padding: '1.5rem', textAlign: 'center' }}>
                    <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.85rem' }}>No stock movements yet.</p>
                    <p style={{ margin: '0.4rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>Post a sale or purchase voucher with a product linked to an inventory item to see movements here.</p>
                  </div>
                )
                : (() => {
                  const filtered = stockMovementsFilter.trim()
                    ? stockMovements.filter(m =>
                        String(m.itemName || '').toLowerCase().includes(stockMovementsFilter.toLowerCase()) ||
                        String(m.reason || '').toLowerCase().includes(stockMovementsFilter.toLowerCase()) ||
                        String(m.actorName || '').toLowerCase().includes(stockMovementsFilter.toLowerCase())
                      )
                    : stockMovements
                  return (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC', borderBottom: '2px solid #E2E8F0' }}>
                            {['Date', 'Item', 'Change', 'Before', 'After', 'Reason (Voucher)', 'By'].map(col => (
                              <th key={col} style={{ padding: '0.55rem 0.7rem', textAlign: col === 'Change' || col === 'Before' || col === 'After' ? 'right' : 'left', color: '#374151', fontWeight: '700', whiteSpace: 'nowrap' }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.slice(0, 200).map((m, i) => {
                            const isIn = Number(m.change || 0) > 0
                            return (
                              <tr key={m._id || i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                                <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, whiteSpace: 'nowrap' }}>
                                  {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : '—'}
                                </td>
                                <td style={{ padding: '0.5rem 0.7rem', fontWeight: '600', color: C.ink }}>{m.itemName}</td>
                                <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '700', color: isIn ? '#166534' : '#B91C1C' }}>
                                  {isIn ? '+' : ''}{Number(m.change || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}
                                </td>
                                <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', color: C.inkSoft }}>{Number(m.quantityBefore || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                <td style={{ padding: '0.5rem 0.7rem', textAlign: 'right', fontWeight: '600', color: C.ink }}>{Number(m.quantityAfter || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</td>
                                <td style={{ padding: '0.5rem 0.7rem' }}>
                                  <span style={{ background: isIn ? '#DCFCE7' : '#FEE2E2', color: isIn ? '#166534' : '#991B1B', borderRadius: '0.3rem', padding: '0.18rem 0.45rem', fontSize: '0.78rem', fontWeight: '600' }}>
                                    {m.reason || '—'}
                                  </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.7rem', color: C.inkSoft, fontSize: '0.78rem' }}>{m.actorName || '—'}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {filtered.length > 200 && <p style={{ textAlign: 'center', color: C.inkSoft, fontSize: '0.8rem', marginTop: '0.5rem' }}>Showing 200 of {filtered.length} entries</p>}
                    </div>
                  )
                })()
            }
          </div>

          {showInventoryProductModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 1210, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={(e) => { if (e.target === e.currentTarget) resetInventoryProductForm() }}>
              <form onSubmit={handleCreateInventoryCatalogProduct} style={{ width: 'min(1100px, 96vw)', background: '#FFFFFF', border: '1px solid #CBD5E0', borderRadius: '0.5rem', padding: 0, boxShadow: '0 20px 42px rgba(0,0,0,0.35)', overflow: 'hidden', transform: `translate(${inventoryProductModalOffset.x}px, ${inventoryProductModalOffset.y}px)`, userSelect: inventoryProductModalDragging ? 'none' : 'auto' }}>
                <div style={{ height: 0, overflow: 'hidden' }} />
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', backgroundColor: '#3F4B2E', color: '#FFFFFF', padding: '1rem', cursor: inventoryProductModalDragging ? 'grabbing' : 'grab' }}
                  onMouseDown={handleInventoryProductModalDragStart}
                >
                  <div>
                    <p style={{ margin: 0, color: '#FFFFFF', fontWeight: '800', fontSize: '1.08rem' }}>{editingInventoryProductId ? 'Edit Product' : 'Product Creation'}</p>
                    <p style={{ margin: '0.25rem 0 0', color: 'rgba(255,255,255,0.88)', fontSize: '0.84rem' }}>Enter Product Category, Name, Description, Weight, Gross Weight, Purity, Tax Type, VAT %, and auto-calculated Purity Weight.</p>
                  </div>
                  <button type="button" onClick={resetInventoryProductForm} style={{ border: 'none', background: 'transparent', color: '#FFFFFF', cursor: 'pointer', fontSize: '1.45rem', lineHeight: 1 }}>✕</button>
                </div>
                <div style={{ padding: '1.2rem 1.5rem', background: '#F3F4F6' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
                    <select value={inventoryProductForm.stockTypeId} onChange={(e) => {
                      const option = inventoryStockTypeOptions.find((item) => item.id === e.target.value)
                      setInventoryProductForm((prev) => ({ ...prev, stockTypeId: e.target.value, categoryName: option?.mainStock || '', purity: prev.purity || option?.purity || '' }))
                    }} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }}>
                      <option value="">Product Category</option>
                      {inventoryStockTypeOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
                    </select>
                    <input placeholder="Product Name" value={inventoryProductForm.name} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, name: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <input placeholder="Description" value={inventoryProductForm.description} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, description: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <input type="number" step="0.0001" placeholder="Weight" value={inventoryProductForm.weight} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, weight: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <input type="number" step="0.0001" placeholder="Gross Weight" value={inventoryProductForm.grossWeight} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, grossWeight: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <input placeholder="Purity" value={inventoryProductForm.purity} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, purity: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }} />
                    <select value={inventoryProductForm.taxType} onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, taxType: e.target.value }))} style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }}>
                      <option value="VAT">VAT</option>
                      <option value="GST">GST</option>
                      <option value="Sales Tax">Sales Tax</option>
                      <option value="None">None</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="VAT %"
                      value={inventoryProductForm.vatPercent}
                      onChange={(e) => setInventoryProductForm((prev) => ({ ...prev, vatPercent: e.target.value }))}
                      style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#FFFFFF', borderRadius: '0.45rem' }}
                    />
                    <input value={inventoryProductPurityWeight ? inventoryProductPurityWeight.toLocaleString(undefined, { maximumFractionDigits: 4 }) : ''} readOnly placeholder="Purity Weight" style={{ ...modalInputStyle, border: '1px solid #CBD5E0', background: '#EEF2F7', color: C.inkSoft, borderRadius: '0.45rem' }} />
                  </div>
                </div>
                <div style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button type="button" onClick={resetInventoryProductForm} style={{ padding: '0.6rem 1.2rem', background: '#E5E7EB', color: '#111827', border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '600' }}>Cancel</button>
                  <button type="button" disabled={saving} onClick={(e) => handleCreateInventoryCatalogProduct({ preventDefault: () => e.preventDefault() })} style={{ padding: '0.6rem 1.2rem', backgroundColor: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: 'pointer', fontWeight: '700', opacity: saving ? 0.75 : 1 }}>{saving ? 'Saving...' : editingInventoryProductId ? 'Update Product' : 'Create Product'}</button>
                </div>
              </form>
            </div>
          )}

          {showInventoryMappingModal && (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
              onClick={(e) => { if (e.target === e.currentTarget) resetInventoryMappingForm() }}
            >
              <form
                onSubmit={handleCreateProduct}
                style={{
                  width: 'min(980px, 98vw)',
                  maxHeight: '88vh',
                  overflowY: 'auto',
                  background: '#E3DEDE',
                  border: '1px solid #987973',
                  borderRadius: '0.62rem',
                  padding: '0.38rem',
                  boxShadow: '0 14px 26px rgba(0, 0, 0, 0.22)',
                  transform: `translate(${inventoryModalOffset.x}px, ${inventoryModalOffset.y}px)`,
                  userSelect: inventoryModalDragging ? 'none' : 'auto',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.75rem',
                    marginBottom: '0.35rem',
                    padding: '0.3rem 0.55rem',
                    borderRadius: '0.34rem 0.34rem 0 0',
                    border: '1px solid #A5857F',
                    background: '#B69A95',
                    cursor: inventoryModalDragging ? 'grabbing' : 'grab',
                  }}
                  onMouseDown={handleInventoryModalDragStart}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
                    <p style={{ margin: 0, fontWeight: '700', color: '#FFFFFF', letterSpacing: '0.01em', fontSize: '0.97rem' }}>{editingProductId ? 'Stock Type Creation' : 'Stock Type Creation'}</p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.38rem' }}>
                    <button type="button" onClick={resetInventoryMappingForm} style={{ width: '1.08rem', height: '1.08rem', borderRadius: '999px', border: '1px solid rgba(255,255,255,0.82)', background: 'rgba(255,255,255,0.14)', color: '#fff', cursor: 'pointer', fontSize: '0.65rem', lineHeight: 1 }}>x</button>
                  </div>
                </div>

                <div style={{ border: '1px solid #A5857F', borderRadius: '0 0 0.36rem 0.36rem', background: '#F3F0F0', padding: '0.45rem' }}>
                  <div style={{ border: '1px solid #B39792', borderRadius: '0.2rem', background: '#F0ECEC', padding: '0.34rem' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.22rem', marginBottom: '0.3rem' }}>
                      {[['details','Details'],['pricing','Pricing'],['stockenquiry','Stock Enquiry']].map(([key, label]) => (
                        <span key={key} onClick={() => setStockTypeModalTab(key)} style={{ fontSize: '0.68rem', fontWeight: '700', cursor: 'pointer', color: stockTypeModalTab === key ? '#724B46' : '#9B817C', padding: '0.14rem 0.34rem', border: `1px solid ${stockTypeModalTab === key ? '#B99E98' : '#CDB9B5'}`, borderBottom: stockTypeModalTab === key ? 'none' : '1px solid #B99E98', borderRadius: '0.22rem 0.22rem 0 0', background: stockTypeModalTab === key ? '#F8F5F4' : '#EEE8E7', userSelect: 'none' }}>{label}</span>
                      ))}
                    </div>

                    <div style={{ border: '1px solid #B99E98', background: '#FCFBFB', padding: '0.48rem' }}>
                      {stockTypeModalTab === 'pricing' && (
                        <div style={{ border: '1px solid #C7AEAA', background: '#F5F1F1', padding: '0.42rem', maxWidth: '360px' }}>
                            <p style={{ margin: '0 0 0.35rem', fontSize: '0.72rem', color: '#6F4B45', fontWeight: '700' }}>Current Price</p>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0.28rem', alignItems: 'center', marginBottom: '0.28rem' }}>
                              <label style={{ fontSize: '0.74rem', color: '#6F4B45', fontWeight: '700' }}>Price :</label>
                              <input
                                type="number" step="0.01"
                                placeholder="Enter price"
                                value={inventoryMappingForm.currentPrice}
                                onChange={e => setInventoryMappingForm(prev => ({ ...prev, currentPrice: e.target.value }))}
                                style={{ ...modalInputStyle, borderColor: '#C0A5A0', background: '#FFFFFF', fontSize: '0.78rem', borderRadius: '0.12rem', padding: '0.1rem 0.3rem', minHeight: '1.62rem' }}
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0.28rem', alignItems: 'center', marginBottom: '0.28rem' }}>
                              <label style={{ fontSize: '0.74rem', color: '#6F4B45', fontWeight: '700' }}>Unit :</label>
                              <select value={inventoryMappingForm.priceUnit} onChange={e => setInventoryMappingForm(prev => ({ ...prev, priceUnit: e.target.value }))} style={{ ...modalInputStyle, borderColor: '#C0A5A0', background: '#FFFFFF', fontSize: '0.78rem', borderRadius: '0.12rem', padding: '0.1rem 0.3rem', minHeight: '1.62rem' }}>
                                <option value="OZ">Per OZ (Troy)</option>
                                <option value="GRAM">Per Gram</option>
                                <option value="KG">Per KG</option>
                              </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: '0.28rem', alignItems: 'center' }}>
                              <label style={{ fontSize: '0.74rem', color: '#6F4B45', fontWeight: '700' }}>Currency :</label>
                              <select value={inventoryMappingForm.priceCurrency} onChange={e => setInventoryMappingForm(prev => ({ ...prev, priceCurrency: e.target.value }))} style={{ ...modalInputStyle, borderColor: '#C0A5A0', background: '#FFFFFF', fontSize: '0.78rem', borderRadius: '0.12rem', padding: '0.1rem 0.3rem', minHeight: '1.62rem' }}>
                                <option value="USD">USD</option>
                                <option value="AED">AED</option>
                                <option value="EUR">EUR</option>
                                <option value="GBP">GBP</option>
                              </select>
                            </div>
                        </div>
                      )}
                      {stockTypeModalTab !== 'pricing' && <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(250px, 0.9fr)', gap: '0.45rem' }}>
                      <div style={{ border: '1px solid #C7AEAA', background: '#F5F1F1', padding: '0.42rem' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: '0.28rem', alignItems: 'center' }}>
                          <label style={{ fontSize: '0.74rem', color: '#6F4B45', fontWeight: '700' }}>Mtl Type :</label>
                          <input
                            placeholder="e.g. Gold, Silver, Platinum"
                            value={inventoryMappingForm.mainStock}
                            onChange={(e) => {
                              const val = e.target.value
                              setInventoryMappingForm((prev) => ({ ...prev, mainStock: val, metalType: val.trim().toLowerCase() }))
                            }}
                            style={{ ...modalInputStyle, borderColor: '#C0A5A0', background: '#FFFFFF', fontSize: '0.78rem', borderRadius: '0.12rem', padding: '0.1rem 0.3rem', minHeight: '1.62rem' }}
                          />
                        </div>
                      </div>

                      <div style={{ border: '1px solid #C7AEAA', background: '#F8F4F4', padding: '0.42rem' }}>
                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#6F4B45', fontWeight: '700' }}>Stock Information</p>
                        <div style={{ marginTop: '0.35rem', display: 'grid', gridTemplateColumns: '96px 1fr', gap: '0.24rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.7rem', color: '#7A5A53', fontWeight: '700' }}>Description :</span>
                          <span style={{ fontSize: '0.7rem', color: '#2F2624', border: '1px solid #C9B2AE', background: '#FFFFFF', padding: '0.2rem 0.34rem' }}>{titleCaseWords(resolveMainStockValueFromForm(inventoryMappingForm) || '-')}</span>
                          <span style={{ fontSize: '0.7rem', color: '#7A5A53', fontWeight: '700' }}>Details :</span>
                          <span style={{ fontSize: '0.7rem', color: '#2F2624', border: '1px solid #C9B2AE', background: '#FFFFFF', padding: '0.2rem 0.34rem' }}>{`mainStock=${resolveMainStockValueFromForm(inventoryMappingForm) || '-'};metalType=${inventoryMappingForm.metalType || '-'}`}</span>
                        </div>
                      </div>
                    </div>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.46rem', justifyContent: 'flex-end' }}>
                  <button type="button" onClick={resetInventoryMappingForm} style={{ padding: '0.38rem 0.8rem', background: '#ECE7E6', color: '#473A37', border: '1px solid #B99E98', borderRadius: '0.2rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.74rem' }}>Cancel</button>
                  <button type="submit" disabled={saving} style={{ padding: '0.38rem 0.8rem', background: '#8A5C54', color: '#fff', border: '1px solid #744742', borderRadius: '0.2rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.74rem' }}>{saving ? 'Saving...' : editingProductId ? 'Save Stock Type' : 'Create Stock Type'}</button>
                </div>
              </form>
            </div>
          )}
        </div>
      )}

      {/* SETTINGS TAB */}
      {activeTab === 'settings' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Settings</h3>
          </div>

          <div style={{ marginBottom: '1.25rem', background: C.p1, padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
            <h4 style={{ color: C.ink, marginTop: 0, marginBottom: '0.4rem', fontWeight: '700' }}>Inventory Stock Code Format</h4>
            <p style={{ marginTop: 0, marginBottom: '0.75rem', color: C.inkSoft, fontSize: '0.82rem' }}>
              Configure auto stock-code format used in ERP Inventory mapping.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
              <select
                value={inventoryStockCodeSettings.format}
                onChange={(e) => setInventoryStockCodeSettings((prev) => ({ ...prev, format: e.target.value }))}
                style={modalInputStyle}
              >
                <option value="metal-purity">GOLD-9999</option>
                <option value="prefix-metal-purity">RM-GOLD-9999</option>
              </select>
              <input
                placeholder="Prefix"
                value={inventoryStockCodeSettings.prefix}
                onChange={(e) => setInventoryStockCodeSettings((prev) => ({ ...prev, prefix: e.target.value.toUpperCase() }))}
                disabled={inventoryStockCodeSettings.format !== 'prefix-metal-purity'}
                style={inventoryStockCodeSettings.format !== 'prefix-metal-purity' ? { ...modalInputStyle, background: '#F8FAFC', color: C.inkSoft } : modalInputStyle}
              />
            </div>

            <p style={{ margin: '0.6rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>
              Preview: {buildAutoStockCode({ mainStock: 'gold', customMainStock: '', metalType: 'gold', purity: '999.9' }, inventoryStockCodeSettings)}
            </p>
          </div>

          <div style={{ marginBottom: '2rem' }}>
            <h4 style={{ color: C.ink, marginBottom: '1rem', fontWeight: '700' }}>Report Branding</h4>
            <form onSubmit={handleSaveBranding} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', border: `1px solid ${C.p2}`, marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1.2fr) repeat(2, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <select value={selectedBrandingKey} onChange={(e) => handleSelectBrandingProfile(e.target.value)} style={modalInputStyle}>
                  {brandingProfiles.map((profile) => (
                    <option key={profile.key} value={profile.key}>{brandingOptionLabel(profile)}{profile.isDefault ? ' (Default)' : ''}</option>
                  ))}
                </select>
                <input
                  placeholder="Profile Key"
                  value={brandingForm.key}
                  onChange={(e) => {
                    const nextKey = normalizeBrandingKey(e.target.value)
                    setSelectedBrandingKey(nextKey)
                    setBrandingForm((prev) => ({ ...prev, key: nextKey }))
                  }}
                  style={modalInputStyle}
                />
                <label style={{ ...modalInputStyle, display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                  <input
                    type="checkbox"
                    checked={Boolean(brandingForm.isDefault)}
                    onChange={(e) => setBrandingForm((prev) => ({ ...prev, isDefault: e.target.checked }))}
                  />
                  Set as default entity
                </label>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <button type="button" onClick={handleCreateBrandingDraft} style={{ padding: '0.45rem 0.85rem', background: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}>
                  + New Entity Profile
                </button>
                <span style={{ color: C.inkSoft, fontSize: '0.82rem', alignSelf: 'center' }}>Each profile can represent a separate legal entity, branch, or reporting unit.</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                <input
                  placeholder="Entity Name"
                  value={brandingForm.entityName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, entityName: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Branch / Unit"
                  value={brandingForm.branchName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, branchName: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Company Name"
                  value={brandingForm.companyName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, companyName: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Legal Name"
                  value={brandingForm.legalName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, legalName: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Report Subtitle"
                  value={brandingForm.reportSubtitle}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, reportSubtitle: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Footer Text"
                  value={brandingForm.reportFooter}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, reportFooter: e.target.value }))}
                  style={modalInputStyle}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '0.75rem', alignItems: 'start', marginBottom: '0.75rem' }}>
                <input
                  placeholder="Logo URL or paste data URL"
                  value={brandingForm.logoUrl}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoUrl: e.target.value }))}
                  style={modalInputStyle}
                />
                <label style={{ ...modalInputStyle, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 0 }}>
                  Upload Logo
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleBrandingLogoFile(e.target.files?.[0])}
                    style={{ display: 'none' }}
                  />
                </label>
              </div>

              {brandingForm.logoUrl && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ padding: '0.75rem', border: `1px dashed ${C.p2}`, borderRadius: '0.5rem', background: '#FFFDF7' }}>
                    <p style={{ marginTop: 0, marginBottom: '0.5rem', color: C.ink, fontWeight: '600' }}>Source Logo</p>
                    <img src={brandingForm.logoUrl} alt="Brand logo source" style={{ maxHeight: '72px', maxWidth: '220px', objectFit: 'contain' }} />
                  </div>
                  <div style={{ padding: '0.75rem', border: `1px dashed ${C.p2}`, borderRadius: '0.5rem', background: '#FFFDF7' }}>
                    <p style={{ marginTop: 0, marginBottom: '0.5rem', color: C.ink, fontWeight: '600' }}>Header Crop Result</p>
                    <div style={{ width: `${clampBrandingDimension(brandingForm.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)}px`, height: `${clampBrandingDimension(brandingForm.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)}px`, border: '1px solid #D1D5DB', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                      {brandingPreviewLogo ? <img src={brandingPreviewLogo} alt="Brand logo processed preview" style={{ width: '100%', height: '100%', objectFit: 'fill' }} /> : null}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  type="number"
                  min="80"
                  max="260"
                  placeholder="Logo Width"
                  value={brandingForm.logoWidth}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoWidth: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  type="number"
                  min="32"
                  max="120"
                  placeholder="Logo Height"
                  value={brandingForm.logoHeight}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoHeight: e.target.value }))}
                  style={modalInputStyle}
                />
                <select
                  value={brandingForm.logoFit}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, logoFit: e.target.value }))}
                  style={modalInputStyle}
                >
                  <option value="contain">Contain</option>
                  <option value="cover">Cover / Crop</option>
                  <option value="fill">Fill / Stretch</option>
                </select>
              </div>

              <div style={{ marginBottom: '1rem', padding: '1rem', borderRadius: '0.75rem', border: `1px solid ${C.p2}`, background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)' }}>
                <p style={{ marginTop: 0, marginBottom: '0.75rem', color: C.ink, fontWeight: '700' }}>Company Profile Preview</p>
                <div style={{ height: '10px', background: 'var(--grad-brand)', borderRadius: '999px', marginBottom: '14px' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', borderBottom: '2px solid #111827', paddingBottom: '0.9rem', marginBottom: '0.9rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: '260px', flex: '1 1 320px' }}>
                    <p style={{ margin: '0 0 0.35rem', color: '#065F46', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 700 }}>{brandingPreview.companyName || DEFAULT_BRANDING.companyName}</p>
                    <p style={{ margin: '0 0 0.35rem', color: '#111827', fontSize: '1.3rem', fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 700 }}>ERP Financial Statement</p>
                    <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{brandingPreview.entityName || DEFAULT_BRANDING.entityName}{brandingPreview.branchName ? ` / ${brandingPreview.branchName}` : ''}</p>
                    {brandingPreview.legalName ? <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{brandingPreview.legalName}</p> : null}
                    <p style={{ margin: '0 0 0.2rem', color: '#4B5563', fontSize: '0.8rem' }}>{brandingPreview.reportSubtitle || DEFAULT_BRANDING.reportSubtitle} | Prepared for statutory / CA-style review</p>
                    <p style={{ margin: 0, color: '#4B5563', fontSize: '0.8rem' }}>Period: 01 Apr 2026 to 30 Apr 2026</p>
                  </div>
                  {brandingPreviewLogo ? (
                    <div style={{ width: `${clampBrandingDimension(brandingPreview.logoWidth, DEFAULT_BRANDING.logoWidth, 80, 260)}px`, height: `${clampBrandingDimension(brandingPreview.logoHeight, DEFAULT_BRANDING.logoHeight, 32, 120)}px`, borderRadius: '0.35rem', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E5E7EB', flex: '0 0 auto' }}>
                      <img src={brandingPreviewLogo} alt="Export header preview logo" style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }} />
                    </div>
                  ) : null}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(120px, 1fr))', gap: '0.75rem', marginBottom: '0.9rem' }}>
                  <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #475569', color: '#374151', fontSize: '0.78rem' }}>{brandingPreview.preparedByTitle || DEFAULT_BRANDING.preparedByTitle}<br />{brandingPreview.preparedByName || DEFAULT_BRANDING.preparedByName}</div>
                  <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #475569', color: '#374151', fontSize: '0.78rem' }}>{brandingPreview.reviewedByTitle || DEFAULT_BRANDING.reviewedByTitle}<br />{brandingPreview.reviewedByName || DEFAULT_BRANDING.reviewedByName}</div>
                  <div style={{ paddingTop: '0.85rem', borderTop: '1px solid #475569', color: '#374151', fontSize: '0.78rem' }}>{brandingPreview.approvedByTitle || DEFAULT_BRANDING.approvedByTitle}<br />{brandingPreview.approvedByName || DEFAULT_BRANDING.approvedByName}</div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem', color: '#334155', fontSize: '0.74rem', flexWrap: 'wrap' }}>
                  <span>{brandingPreview.companyName || DEFAULT_BRANDING.companyName} Reporting Suite</span>
                  <span>{brandingPreview.reportFooter || DEFAULT_BRANDING.reportFooter}</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
                <input
                  placeholder="Prepared By Title"
                  value={brandingForm.preparedByTitle}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, preparedByTitle: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Prepared By Name"
                  value={brandingForm.preparedByName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, preparedByName: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Reviewed By Title"
                  value={brandingForm.reviewedByTitle}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, reviewedByTitle: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Reviewed By Name"
                  value={brandingForm.reviewedByName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, reviewedByName: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Approved By Title"
                  value={brandingForm.approvedByTitle}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, approvedByTitle: e.target.value }))}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Approved By Name"
                  value={brandingForm.approvedByName}
                  onChange={(e) => setBrandingForm((prev) => ({ ...prev, approvedByName: e.target.value }))}
                  style={modalInputStyle}
                />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                <button type="submit" disabled={saving || !canManageAccounts} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: canManageAccounts ? 'pointer' : 'not-allowed', opacity: canManageAccounts ? 1 : 0.65 }}>
                  {saving ? 'Saving...' : 'Save Branding'}
                </button>
                <button type="button" onClick={() => setBrandingForm(reportBranding)} style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                  Reset Changes
                </button>
                <span style={{ color: C.inkSoft, fontSize: '0.82rem' }}>Use separate profiles per branch or legal entity. Uploaded logos give the most reliable PDF result.</span>
              </div>
            </form>

          </div>

          <div style={{ background: C.p1, padding: '1.5rem', borderRadius: '0.5rem', borderLeft: `4px solid ${C.s1}` }}>
            <h4 style={{ color: C.t1, marginBottom: '1rem', fontWeight: '600' }}>📋 System Information</h4>
            <ul style={{ color: C.t2, fontSize: '0.875rem', listStyle: 'none', padding: 0 }}>
              <li style={{ marginBottom: '0.5rem' }}>✓ Central Ledger System: Every transaction creates one ledger entry</li>
              <li style={{ marginBottom: '0.5rem' }}>✓ Auto Journal Logic: Debit/Credit pairs auto-populated based on mappings</li>
              <li style={{ marginBottom: '0.5rem' }}>✓ Role-Based Access: Finance and Super Admin only</li>
              <li style={{ marginBottom: '0.5rem' }}>✓ Multi-Currency: configurable base currency and exchange rates</li>
              <li style={{ marginBottom: '0.5rem' }}>✓ Reports: Trial Balance, Ledger, and Dashboard all from ledger data</li>
            </ul>
          </div>
        </div>
      )}

      {/* CURRENCIES TAB */}
      {activeTab === 'currencies' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <h3 style={{ margin: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Currency Master</h3>
              <p style={{ margin: '0.3rem 0 0', color: C.inkSoft, fontSize: '0.84rem' }}>
                Manage currency code master and conversion rates vs USD for all ERP postings.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {canManageAccounts && (
                <button
                  onClick={() => setShowCurrencyForm(!showCurrencyForm)}
                  style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}
                >
                  {showCurrencyForm ? 'Close Form' : '+ Add Currency'}
                </button>
              )}
              {canManageAccounts && (
                <button
                  onClick={handleSyncCurrencyMaster}
                  disabled={saving}
                  style={{ padding: '0.5rem 1rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '600' }}
                >
                  {saving ? 'Syncing...' : 'Sync USD/EUR/AED/UZS'}
                </button>
              )}
              <button
                onClick={() => setActiveTab('settings')}
                style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.375rem', cursor: 'pointer' }}
              >
                Back to Settings
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <h4 style={{ margin: 0, marginBottom: '0.45rem', color: C.ink, fontSize: '0.95rem' }}>Exchange Difference Accounts</h4>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.82rem' }}>
                System auto-creates and uses <strong>Exchange Gain (4190)</strong> and <strong>Exchange Loss (5190)</strong> when posting foreign-currency payment/receipt adjustments.
              </p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <h4 style={{ margin: 0, marginBottom: '0.45rem', color: C.ink, fontSize: '0.95rem' }}>Rate Direction (vs USD)</h4>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.82rem' }}>
                Exchange rate stores <strong>USD value of 1 unit</strong> of the selected currency. Example: AED 0.2723 means 1 AED = 0.2723 USD.
              </p>
            </div>
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <h4 style={{ margin: 0, marginBottom: '0.45rem', color: C.ink, fontSize: '0.95rem' }}>USD Converter</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.45rem' }}>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="USD Amount"
                  value={usdConversion.usdAmount}
                  onChange={(e) => setUsdConversion((prev) => ({ ...prev, usdAmount: e.target.value }))}
                  style={modalInputStyle}
                />
                <select
                  value={usdConversion.targetCode}
                  onChange={(e) => setUsdConversion((prev) => ({ ...prev, targetCode: e.target.value }))}
                  style={modalInputStyle}
                >
                  {currencies.map((currency) => (
                    <option key={currency._id || currency.code} value={currency.code}>{currency.code} - {currency.name}</option>
                  ))}
                </select>
              </div>
              <p style={{ margin: '0.5rem 0 0', color: C.inkSoft, fontSize: '0.8rem' }}>
                {usdConversion.usdAmount || '0'} USD = <strong style={{ color: C.ink }}>{Number(usdToTargetAmount || 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</strong> {usdConversion.targetCode || '---'}
              </p>
              <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.75rem' }}>
                1 {usdConversion.targetCode || '---'} = <strong style={{ color: C.ink }}>{Number(selectedUsdConversionRate || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })}</strong> USD
              </p>
              <p style={{ margin: '0.2rem 0 0', color: C.inkSoft, fontSize: '0.72rem' }}>
                Rate used: {selectedUsdConversionRate > 0 ? selectedUsdConversionRate.toFixed(6) : 'N/A'} USD per {usdConversion.targetCode || 'unit'}
              </p>
            </div>
          </div>

          {showCurrencyForm && (
            <form onSubmit={handleCreateCurrency} style={{ background: C.p1, padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', border: `1px solid ${C.p2}` }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
                <input
                  placeholder="Currency Code"
                  value={currencyForm.code}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value.toUpperCase() })}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Currency Name"
                  value={currencyForm.name}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, name: e.target.value })}
                  style={modalInputStyle}
                />
                <input
                  placeholder="Symbol"
                  value={currencyForm.symbol}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
                  style={modalInputStyle}
                />
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  placeholder="Exchange Rate"
                  value={currencyForm.exchangeRate}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, exchangeRate: e.target.value })}
                  style={modalInputStyle}
                />
              </div>
              <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', color: C.ink, marginTop: '0.6rem' }}>
                <input
                  type="checkbox"
                  checked={currencyForm.baseCurrency}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, baseCurrency: e.target.checked })}
                />
                Set as base currency
              </label>
              <div style={{ marginTop: '0.75rem' }}>
                <button type="submit" disabled={saving} style={{ padding: '0.5rem 1rem', background: C.s1, color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: 'pointer', marginRight: '0.5rem' }}>
                  {saving ? 'Saving...' : 'Create Currency'}
                </button>
                <button type="button" onClick={() => setShowCurrencyForm(false)} style={{ padding: '0.5rem 1rem', background: '#fff', color: C.ink, border: `1px solid ${C.p2}`, borderRadius: '0.375rem', cursor: 'pointer' }}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem', border: `1px solid ${C.p2}` }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Code</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Name</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Symbol</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Exchange Rate</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>1 USD =</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Base</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Active</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currencies.map((c) => (
                  <tr key={c._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                    <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '700' }}>{c.code}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{c.name}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{c.symbol || '-'}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{Number(c.exchangeRate || 0).toFixed(6)}</td>
                    <td style={{ padding: '0.75rem', color: C.t2 }}>{Number(c.exchangeRate || 0) > 0 ? Number(1 / Number(c.exchangeRate || 1)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '-'}</td>
                    <td style={{ padding: '0.75rem', color: c.baseCurrency ? C.s1 : C.t2 }}>{c.baseCurrency ? '✓ Base' : '-'}</td>
                    <td style={{ padding: '0.75rem', color: c.isActive ? '#065F46' : C.inkSoft }}>{c.isActive ? 'Active' : 'Inactive'}</td>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap' }}>
                        <button onClick={() => handleEditCurrency(c)} style={{ padding: '0.35rem 0.7rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Edit</button>
                        <button onClick={() => handleDeleteCurrency(c)} style={{ padding: '0.35rem 0.7rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {currencies.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No currencies configured yet.</p>}
        </div>
      )}

      {editState.record && (
        <div style={modalBackdropStyle} onClick={closeEditModal}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '1rem', color: C.ink, fontSize: '1.1rem', fontWeight: '700' }}>
              Edit {editState.type.charAt(0).toUpperCase() + editState.type.slice(1)}
            </h3>
            <form onSubmit={handleSaveEdit}>
              {editState.type === 'account' && (
                <>
                  <input
                    value={editState.form.accountName || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, accountName: e.target.value } }))}
                    placeholder="Account Name"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.description || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))}
                    placeholder="Description"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.department || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, department: e.target.value } }))}
                    placeholder="Department"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.currency || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, currency: e.target.value } }))}
                    placeholder="Currency"
                    style={modalInputStyle}
                  />
                </>
              )}
              {editState.type === 'mapping' && (
                <>
                  <input
                    value={editState.form.mappingType || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, mappingType: e.target.value } }))}
                    placeholder="Mapping Type"
                    style={modalInputStyle}
                  />
                  <select
                    value={editState.form.debitAccountId || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, debitAccountId: e.target.value } }))}
                    style={modalInputStyle}
                  >
                    <option value="">Select Debit Account</option>
                    {accounts.map((account) => (
                      <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                    ))}
                  </select>
                  <select
                    value={editState.form.creditAccountId || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, creditAccountId: e.target.value } }))}
                    style={modalInputStyle}
                  >
                    <option value="">Select Credit Account</option>
                    {accounts.map((account) => (
                      <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                    ))}
                  </select>
                  <select
                    value={editState.form.department || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, department: e.target.value } }))}
                    style={modalInputStyle}
                  >
                    <option value="">Shared / All Departments</option>
                    {LEDGER_DEPARTMENTS.map((department) => (
                      <option key={department} value={department}>{department}</option>
                    ))}
                  </select>
                  <input
                    value={editState.form.description || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))}
                    placeholder="Description"
                    style={modalInputStyle}
                  />
                </>
              )}
              {editState.type === 'currency' && (
                <>
                  <input
                    value={editState.form.code || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, code: e.target.value.toUpperCase() } }))}
                    placeholder="Code"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.name || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, name: e.target.value } }))}
                    placeholder="Name"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.symbol || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, symbol: e.target.value } }))}
                    placeholder="Symbol"
                    style={modalInputStyle}
                  />
                  <input
                    type="number"
                    step="0.0001"
                    value={editState.form.exchangeRate || 1}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, exchangeRate: e.target.value } }))}
                    placeholder="Exchange Rate"
                    style={modalInputStyle}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: C.ink, marginBottom: '0.75rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(editState.form.baseCurrency)}
                      onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, baseCurrency: e.target.checked } }))}
                    />
                    Set as base currency
                  </label>
                </>
              )}
              {editState.type === 'customer' && (
                <>
                  <input
                    value={editState.form.name || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, name: e.target.value } }))}
                    placeholder="Customer Name"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.phone || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, phone: e.target.value } }))}
                    placeholder="Phone"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.email || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, email: e.target.value } }))}
                    placeholder="Email"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.address || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, address: e.target.value } }))}
                    placeholder="Address"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.gstVat || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, gstVat: e.target.value } }))}
                    placeholder="GST/VAT"
                    style={modalInputStyle}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={editState.form.creditLimit || 0}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, creditLimit: e.target.value } }))}
                    placeholder="Credit Limit"
                    style={modalInputStyle}
                  />
                  <input
                    type="number"
                    value={editState.form.paymentTermsDays || 0}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, paymentTermsDays: e.target.value } }))}
                    placeholder="Payment Terms (Days)"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.currency || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, currency: e.target.value.toUpperCase() } }))}
                    placeholder="Currency"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.notes || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, notes: e.target.value } }))}
                    placeholder="Notes"
                    style={modalInputStyle}
                  />
                </>
              )}
              {editState.type === 'ledger' && (
                <>
                  <input
                    type="date"
                    value={editState.form.date || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, date: e.target.value } }))}
                    style={modalInputStyle}
                  />
                  <select
                    value={editState.form.debitAccountId || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, debitAccountId: e.target.value } }))}
                    style={modalInputStyle}
                  >
                    <option value="">Select Debit Account</option>
                    {accounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>{acc.accountCode} - {acc.accountName}</option>
                    ))}
                  </select>
                  <select
                    value={editState.form.creditAccountId || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, creditAccountId: e.target.value } }))}
                    style={modalInputStyle}
                  >
                    <option value="">Select Credit Account</option>
                    {accounts.map((acc) => (
                      <option key={acc._id} value={acc._id}>{acc.accountCode} - {acc.accountName}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={editState.form.amount || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, amount: parseFloat(e.target.value) || 0 } }))}
                    placeholder="Amount"
                    style={modalInputStyle}
                  />
                  <input
                    value={editState.form.description || ''}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, description: e.target.value } }))}
                    placeholder="Description"
                    style={modalInputStyle}
                  />
                  <select
                    value={editState.form.referenceType || 'journal'}
                    onChange={(e) => setEditState((prev) => ({ ...prev, form: { ...prev.form, referenceType: e.target.value } }))}
                    style={modalInputStyle}
                  >
                    <option value="journal">Journal</option>
                    <option value="invoice">Invoice</option>
                    <option value="payment">Payment</option>
                    <option value="purchase">Purchase</option>
                    <option value="expense">Expense</option>
                    <option value="payroll">Payroll</option>
                  </select>
                </>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button type="button" onClick={closeEditModal} style={{ padding: '0.6rem 1rem', background: '#FFFFFF', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  Cancel
                </button>
                <button type="submit" disabled={saving} style={{ padding: '0.6rem 1rem', background: C.s1, color: '#FFFFFF', border: 'none', borderRadius: '0.5rem', cursor: 'pointer' }}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VOUCHERS TAB */}
      {activeTab === 'vouchers' && (
        <VoucherTab
          token={token}
          user={user}
          accounts={accounts}
          customers={customers}
          vendors={vendors}
          currencies={currencies}
        />
      )}

      {/* DIRECT DEALS TAB */}
      {activeTab === 'direct-deals' && (
        <DirectDealsTab
          token={token}
          customers={customers}
          currencies={currencies}
          canManage={isSuperAdmin || isFinance || isSalesRole}
          isSuperAdmin={isSuperAdmin}
        />
      )}

      {/* TEST MAPPING MODAL */}
      {showMappingTest && testMapping && (
        <div style={modalBackdropStyle} onClick={() => setShowMappingTest(false)}>
          <div style={modalCardStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem', color: C.ink, fontWeight: '700' }}>
              Test Mapping: {testMapping.mappingType}
            </h3>
            <div style={{ background: '#F9FAFB', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
              <p style={{ color: C.inkSoft, marginBottom: '0.75rem' }}>
                <strong>Usage Count:</strong> {testMapping.usageCount || 0} times used
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '0.75rem' }}>
                <div>
                  <p style={{ color: C.t3, fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>DEBIT ACCOUNT</p>
                  <p style={{ color: C.ink, fontWeight: '600' }}>{testMapping.debitAccountId?.accountCode}</p>
                  <p style={{ color: C.t3, fontSize: '0.875rem' }}>{testMapping.debitAccountId?.accountName}</p>
                </div>
                <div>
                  <p style={{ color: C.t3, fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>CREDIT ACCOUNT</p>
                  <p style={{ color: C.ink, fontWeight: '600' }}>{testMapping.creditAccountId?.accountCode}</p>
                  <p style={{ color: C.t3, fontSize: '0.875rem' }}>{testMapping.creditAccountId?.accountName}</p>
                </div>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${C.t2}` }}>
                <p style={{ color: C.t3, fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.25rem' }}>DESCRIPTION</p>
                <p style={{ color: C.ink }}>{testMapping.description || '(No description)'}</p>
              </div>
              <div style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${C.t2}`, background: '#ECFDF5', padding: '0.75rem', borderRadius: '0.375rem' }}>
                <p style={{ color: '#065F46', fontSize: '0.875rem', fontWeight: '600', marginBottom: '0.5rem' }}>✓ Sample Transaction</p>
                <p style={{ color: '#047857', fontSize: '0.875rem' }}>When this mapping is applied:</p>
                <ul style={{ color: '#047857', fontSize: '0.875rem', marginTop: '0.5rem', paddingLeft: '1.5rem' }}>
                  <li>Debit: {testMapping.debitAccountId?.accountCode}</li>
                  <li>Credit: {testMapping.creditAccountId?.accountCode}</li>
                  <li>Amount: Enter any amount</li>
                </ul>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowMappingTest(false)} style={{ padding: '0.6rem 1rem', background: '#FFFFFF', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCOUNT SUMMARY POPUP MODAL - TRADING PLATFORM STYLE */}
      {showEnquiryModal && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setShowEnquiryModal(false) }}
          style={{ position: 'fixed', inset: 0, background: enquiryBackdropColor, transition: 'background 120ms ease', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div style={{ background: '#fff', borderRadius: '8px', width: 'min(1100px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 42px rgba(0,0,0,0.35)', transform: `translate(${enquiryModalOffset.x}px, ${enquiryModalOffset.y}px)` }}>

            {/* Header - Dark Green Bar */}
            <div
              onMouseDown={beginEnquiryModalDrag}
              style={{ background: '#3F4B2E', color: '#FFFFFF', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', cursor: enquiryModalDrag.active ? 'grabbing' : 'grab', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Account Details — Statement of Account</span>
                {enquiryLoading && <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>(Loading…)</span>}
              </div>
              <button onClick={() => setShowEnquiryModal(false)} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', fontSize: '20px', padding: '0', lineHeight: 1 }}>✕</button>
            </div>

            {/* Scrollable Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.2rem 1.5rem' }}>

              {/* Account lookup row */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.95rem', color: '#374151', fontWeight: '600' }}>Account Number</label>
                  <select
                    value={accountEnquiryCode}
                    onChange={(e) => {
                      setAccountEnquiryCode(e.target.value)
                      setEnquiryStatus({ type: '', message: '' })
                    }}
                    style={{ border: '1px solid #CBD5E0', padding: '0.6rem 0.8rem', fontSize: '0.95rem', width: '340px', borderRadius: '0.5rem', background: '#FFFFFF' }}
                  >
                    <option value="">Select account</option>
                    {groupedSummaryAccounts.map((group) => (
                      <optgroup key={group.type} label={group.type}>
                        {group.accounts.map((account) => (
                          <option key={account._id} value={account.accountCode}>
                            {account.accountCode} - {account.accountName}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <button
                    onClick={() => fetchAccountEnquiryByCode(accountEnquiryCode)}
                    disabled={enquiryLoading}
                    style={{ padding: '0.6rem 1.2rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '0.5rem', cursor: enquiryLoading ? 'not-allowed' : 'pointer', fontWeight: '700', fontSize: '0.95rem', opacity: enquiryLoading ? 0.7 : 1 }}
                  >
                    {enquiryLoading ? 'Loading…' : 'Load Summary'}
                  </button>
                </div>
              </div>

              {enquiryStatus.message && !enquiryLoading && (
                <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: enquiryStatus.type === 'success' ? '#047857' : '#c0392b', fontWeight: '600' }}>{enquiryStatus.message}</p>
              )}

              {!accountEnquiryData ? (
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '0.6rem', background: '#F9FAFB', padding: '1.5rem', color: '#6B7280', fontSize: '0.95rem', textAlign: 'center' }}>
                  {enquiryLoading ? '⟳ Loading account statement...' : '→ Enter account number and click Load Summary to view position'}
                </div>
              ) : (
                <>
                  {/* 2-Column Layout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

                    {/* LEFT COLUMN - Account Details Box with Position Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>

                      {/* Account Details Panel */}
                      <div style={{ border: '2px solid #3F4B2E', borderRadius: '0.6rem', background: '#F5F7F0', padding: '1rem', position: 'relative' }}>
                        <div style={{ borderBottom: '1px solid #D1D5DB', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
                          <h3 style={{ margin: '0 0 0.4rem', color: '#111827', fontWeight: '800', fontSize: '1.1rem' }}>{accountEnquiryData.account.accountName || 'Account'}</h3>
                          <p style={{ margin: 0, color: '#6B7280', fontSize: '0.9rem', lineHeight: '1.4' }}>{accountEnquiryData.account.description || accountEnquiryData.account.accountName}</p>
                          {accountEnquiryData.account.description && (
                            <p style={{ margin: '0.4rem 0 0', color: '#6B7280', fontSize: '0.85rem' }}>Code: {accountEnquiryData.account.accountCode}</p>
                          )}
                        </div>
                      </div>

                      {/* Position Table with Tabs */}
                      <div style={{ border: '1px solid #CBD5E0', borderRadius: '0.6rem', overflow: 'hidden', background: '#FFFFFF' }}>
                        {/* Tab Header */}
                        <div style={{ background: '#3F4B2E', padding: '0', display: 'flex', borderBottom: '1px solid #2D3620' }}>
                          <button
                            type="button"
                            onClick={() => setAccountSummaryView('position')}
                            style={{
                              flex: 1,
                              padding: '0.7rem 1rem',
                              color: accountSummaryView === 'position' ? '#FFFFFF' : '#6B7280',
                              background: accountSummaryView === 'position' ? '#3F4B2E' : '#EEEEEE',
                              border: 'none',
                              fontWeight: accountSummaryView === 'position' ? '700' : '600',
                              fontSize: '0.95rem',
                              cursor: 'pointer',
                              borderRight: '1px solid #2D3620',
                            }}
                          >
                            Position
                          </button>
                          <button
                            type="button"
                            onClick={() => setAccountSummaryView('unfixed')}
                            style={{
                              flex: 1,
                              padding: '0.7rem 1rem',
                              color: accountSummaryView === 'unfixed' ? '#FFFFFF' : '#6B7280',
                              background: accountSummaryView === 'unfixed' ? '#3F4B2E' : '#EEEEEE',
                              border: 'none',
                              fontWeight: accountSummaryView === 'unfixed' ? '700' : '600',
                              fontSize: '0.95rem',
                              cursor: 'pointer',
                            }}
                          >
                            Unfixed
                          </button>
                        </div>
                        
                        {/* Position / Unfixed Table */}
                        <div style={{ overflowX: 'auto' }}>
                          {accountSummaryView === 'position' ? (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ background: '#E8EBE0', borderBottom: '2px solid #CBD5E0' }}>
                                  <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Type</th>
                                  <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Limits</th>
                                  <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Balance</th>
                                  <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Price</th>
                                  <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Current Value</th>
                                  <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Break Even</th>
                                </tr>
                              </thead>
                              <tbody>
                                {modalPositionRows.map((row, index) => (
                                  <tr key={row.key} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                    <td style={{ padding: '0.7rem', fontWeight: '700', color: '#111827' }}>{row.type}</td>
                                    <td style={{ padding: '0.7rem', textAlign: 'right', color: '#374151', fontSize: '0.85rem' }}>{formatStatementValue(row.limits, 0)}</td>
                                    <td style={{ padding: '0.7rem', textAlign: 'right', color: getSignedColor(row.balance), fontWeight: '600' }}>{formatStatementValue(row.balance, 6)}</td>
                                    <td style={{ padding: '0.7rem', textAlign: 'right', color: '#374151', fontSize: '0.85rem' }}>{formatStatementValue(row.price, 4)}</td>
                                    <td style={{ padding: '0.7rem', textAlign: 'right', color: getSignedColor(row.currentValue), fontWeight: '700' }}>{formatStatementValue(row.currentValue, 2)}</td>
                                    <td style={{ padding: '0.7rem', textAlign: 'right', color: '#374151', fontSize: '0.85rem' }}>{formatStatementValue(row.breakEven, 4)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                              <thead>
                                <tr style={{ background: '#E8EBE0', borderBottom: '2px solid #CBD5E0' }}>
                                  <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Date</th>
                                  <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Deal</th>
                                  <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Metal</th>
                                  <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Amount</th>
                                </tr>
                              </thead>
                              <tbody>
                                {unfixedMetalEntries.length ? unfixedMetalEntries.slice(0, 8).map((row, index) => (
                                  <tr key={row._id || `${row.date}-${index}`} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                    <td style={{ padding: '0.7rem', color: '#111827' }}>{formatStatementDate(row.date)}</td>
                                    <td style={{ padding: '0.7rem', color: '#111827', fontWeight: '600', textTransform: 'capitalize' }}>{row.dealSide}</td>
                                    <td style={{ padding: '0.7rem', color: '#111827' }}>{row.metalCode}</td>
                                    <td style={{ padding: '0.7rem', textAlign: 'right', color: '#111827', fontWeight: '700' }}>{formatStatementValue(row.amount, 2)}</td>
                                  </tr>
                                )) : (
                                  <tr>
                                    <td colSpan={4} style={{ padding: '0.8rem', textAlign: 'center', color: '#6B7280', fontSize: '0.86rem' }}>
                                      No unfixed metal sale/purchase rows found in the selected filters.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </div>

                      <div style={{ border: '1px solid #CBD5E0', borderRadius: '0.6rem', background: '#F8FAFC', padding: '0.85rem 0.95rem' }}>
                        <p style={{ margin: 0, color: '#111827', fontWeight: '800', fontSize: '0.92rem' }}>Fixing / Unfixing Metal Sales & Purchases</p>
                        <p style={{ margin: '0.3rem 0 0', color: '#475569', fontSize: '0.8rem', lineHeight: 1.45 }}>
                          Fixed means price locked and finalized. Unfixed means price is pending and should remain in the Unfixed tab until fixed.
                        </p>
                        <div style={{ marginTop: '0.65rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                          <div style={{ border: '1px solid #BBF7D0', background: '#ECFDF5', borderRadius: '0.45rem', padding: '0.55rem' }}>
                            <p style={{ margin: 0, color: '#166534', fontWeight: '800', fontSize: '0.8rem' }}>Fixed</p>
                            <p style={{ margin: '0.2rem 0 0', color: '#166534', fontSize: '0.76rem' }}>Sales: {fixedMetalSummary.saleCount} ({formatStatementValue(fixedMetalSummary.saleAmount, 2)})</p>
                            <p style={{ margin: '0.15rem 0 0', color: '#166534', fontSize: '0.76rem' }}>Purchases: {fixedMetalSummary.purchaseCount} ({formatStatementValue(fixedMetalSummary.purchaseAmount, 2)})</p>
                          </div>
                          <div style={{ border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: '0.45rem', padding: '0.55rem' }}>
                            <p style={{ margin: 0, color: '#92400E', fontWeight: '800', fontSize: '0.8rem' }}>Unfixed</p>
                            <p style={{ margin: '0.2rem 0 0', color: '#92400E', fontSize: '0.76rem' }}>Sales: {unfixedMetalSummary.saleCount} ({formatStatementValue(unfixedMetalSummary.saleAmount, 2)})</p>
                            <p style={{ margin: '0.15rem 0 0', color: '#92400E', fontSize: '0.76rem' }}>Purchases: {unfixedMetalSummary.purchaseCount} ({formatStatementValue(unfixedMetalSummary.purchaseAmount, 2)})</p>
                          </div>
                        </div>
                        {unknownFixMetalEntries.length > 0 && (
                          <p style={{ margin: '0.55rem 0 0', color: '#6B7280', fontSize: '0.75rem' }}>
                            {unknownFixMetalEntries.length} metal sale/purchase entries are missing explicit fixing keywords.
                          </p>
                        )}
                      </div>

                    </div>

                    {/* RIGHT COLUMN - Financial Metrics */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: '#F9FAFB', borderRadius: '0.6rem', border: '1px solid #E5E7EB' }}>
                      {/* Total Funds */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Total Funds</span>
                        <span style={{ color: '#111827', fontWeight: '700', fontSize: '1rem' }}>
                          {formatDirectionalBalance(modalTotalFunds, { preferredDirection: accountEnquiryData?.balances?.netDirection })}
                        </span>
                      </div>

                      {/* Revaluation */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Revaluation</span>
                        <span style={{ color: getSignedColor(modalRevaluation), fontWeight: '700', fontSize: '1rem' }}>{formatStatementValue(modalRevaluation, 2)}</span>
                      </div>

                      {/* Net Equity */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Net Equity</span>
                        <span style={{ color: '#111827', fontWeight: '700', fontSize: '1rem' }}>{formatStatementValue(modalNetEquity, 2)}</span>
                      </div>

                      {/* Margin Amt @ 2% */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Margin Amt @ 2.0%</span>
                        <span style={{ color: getSignedColor(modalMarginAmt), fontWeight: '700', fontSize: '1rem' }}>{formatStatementValue(modalMarginAmt, 2)}</span>
                      </div>

                      {/* Excess with Currency Dropdown */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <label style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Excess</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <select value={excessCurrency} onChange={(e) => setExcessCurrency(e.target.value)} style={{ border: '1px solid #CBD5E0', borderRadius: '0.4rem', background: '#FFFFFF', fontSize: '0.85rem', padding: '0.3rem 0.5rem', fontWeight: '600' }}>
                            <option value="USD">USD</option>
                          </select>
                          <span style={{ color: '#1565c0', fontWeight: '800', fontSize: '1.05rem', minWidth: '80px', textAlign: 'right' }}>{formatStatementValue(modalExcess, 2)}</span>
                        </div>
                      </div>

                      {/* Margin % */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Margin %</span>
                        <span style={{ color: '#1565c0', fontWeight: '800', fontSize: '1.1rem' }}>{formatStatementValue(modalMarginPct, 2)}%</span>
                      </div>
                    </div>

                  </div>

                  {/* Full Statement Table */}
                  <div style={{ marginTop: '1.25rem', border: '1px solid #CBD5E0', borderRadius: '0.65rem', overflow: 'hidden', background: '#FFFFFF' }}>
                    <div style={{ padding: '0.85rem 1rem', background: '#F5F7F0', borderBottom: '1px solid #D1D5DB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: '#111827', fontWeight: '800' }}>Full Statement of Account</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#6B7280' }}>{filteredStatementEntries.length} entries shown</p>
                      </div>
                      {recentPaymentReceiptEntry && (
                        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '0.45rem', padding: '0.45rem 0.6rem' }}>
                          <p style={{ margin: 0, fontSize: '0.73rem', color: '#065F46', fontWeight: '700' }}>Recent Payment/Receipt</p>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#065F46', fontWeight: '700' }}>
                            {formatStatementDate(recentPaymentReceiptEntry.date)} · {String(recentPaymentReceiptEntry.referenceType || '').toUpperCase()} · #{recentPaymentReceiptEntry.sourceTransactionNumber || recentPaymentReceiptEntry.sourceTransactionId || '-'}
                          </p>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #E5E7EB', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.55rem' }}>
                      <input
                        type="date"
                        value={statementFilters.startDate}
                        onChange={(e) => setStatementFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                        style={modalInputStyle}
                      />
                      <input
                        type="date"
                        value={statementFilters.endDate}
                        onChange={(e) => setStatementFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                        style={modalInputStyle}
                      />
                      <select
                        value={statementFilters.referenceType}
                        onChange={(e) => setStatementFilters((prev) => ({ ...prev, referenceType: e.target.value }))}
                        style={modalInputStyle}
                      >
                        <option value="">All Types</option>
                        {statementReferenceTypes.map((type) => (
                          <option key={type} value={type}>{type}</option>
                        ))}
                      </select>
                      <select
                        value={statementFilters.department}
                        onChange={(e) => setStatementFilters((prev) => ({ ...prev, department: e.target.value }))}
                        style={modalInputStyle}
                      >
                        <option value="">All Departments</option>
                        {statementDepartments.map((department) => (
                          <option key={department} value={department}>{department}</option>
                        ))}
                      </select>
                      <select
                        value={statementFilters.fixStatus}
                        onChange={(e) => setStatementFilters((prev) => ({ ...prev, fixStatus: e.target.value }))}
                        style={modalInputStyle}
                      >
                        <option value="">All Fixing Status</option>
                        <option value="fixed">Fixed Only</option>
                        <option value="unfixed">Unfixed Only</option>
                        <option value="unknown">Unknown Only</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => setStatementFilters({ startDate: '', endDate: '', referenceType: '', department: '', fixStatus: '' })}
                        style={{ padding: '0.65rem 0.75rem', background: '#E5E7EB', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer', height: 'fit-content' }}
                      >
                        Reset
                      </button>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontSize: '0.82rem', fontWeight: '600', background: '#F8FAFC', border: '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.62rem 0.7rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showStatementAuditIds}
                          onChange={(e) => setShowStatementAuditIds(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        Show Transaction ID
                      </label>
                    </div>

                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ background: '#E8EBE0', borderBottom: '1px solid #CBD5E0' }}>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Date</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Receipt No</th>
                            {showStatementAuditIds && <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Transaction ID</th>}
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Type</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Deal</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Fixing</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Description</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Offset Account</th>
                            <th colSpan={3} style={{ padding: '0.6rem', textAlign: 'center', color: '#111827', fontWeight: '800', borderLeft: '1px solid #CBD5E0' }}>Amount In USD</th>
                            <th colSpan={3} style={{ padding: '0.6rem', textAlign: 'center', color: '#111827', fontWeight: '800', borderLeft: '1px solid #CBD5E0' }}>Pure WT In Grams</th>
                          </tr>
                          <tr style={{ background: '#EEF1E8', borderBottom: '2px solid #CBD5E0' }}>
                            <th colSpan={showStatementAuditIds ? 8 : 7} style={{ padding: 0, border: 0 }} />
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700', borderLeft: '1px solid #CBD5E0' }}>Debit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Credit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Balance</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700', borderLeft: '1px solid #CBD5E0' }}>Debit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Credit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStatementEntries.length === 0 ? (
                            <tr>
                              <td colSpan={showStatementAuditIds ? 15 : 14} style={{ padding: '1rem', textAlign: 'center', color: '#6B7280', fontStyle: 'italic' }}>
                                No statement entries found for selected filters.
                              </td>
                            </tr>
                          ) : (
                            (() => {
                              let runningPureWeight = Number(accountEnquiryData?.metals?.goldBalance || 0)
                              return filteredStatementEntries.map((entry, index) => {
                              const receiptNo = entry.sourceTransactionNumber || entry.sourceTransactionId || entry.referenceId || entry._id || '-'
                              const rowExchangeRate = Number(entry.exchangeRate || 1)
                              const debitUsd = Number(entry.debitAmount || 0) * rowExchangeRate
                              const creditUsd = Number(entry.creditAmount || 0) * rowExchangeRate
                              const balanceUsd = Number(entry.runningBalance || 0) * rowExchangeRate
                              const sourceType = String(entry.sourceTransactionType || entry.referenceType || '').toLowerCase()
                              const isMetalRow = entry.isMetalTrade || sourceType === 'sale' || sourceType === 'purchase'
                              const signedPureWeight = Number(entry.metalSignedWeight || 0)
                              const debitPureWeight = isMetalRow && signedPureWeight > 0 ? signedPureWeight : (isMetalRow ? 0 : null)
                              const creditPureWeight = isMetalRow && signedPureWeight < 0 ? Math.abs(signedPureWeight) : (isMetalRow ? 0 : null)
                              const balancePureWeight = isMetalRow ? runningPureWeight : null
                              if (isMetalRow) runningPureWeight -= signedPureWeight
                              return (
                                <tr key={entry._id || `${entry.date}-${index}`} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                  <td style={{ padding: '0.6rem', color: '#374151' }}>{formatStatementDate(entry.date)}</td>
                                  <td style={{ padding: '0.6rem', color: '#111827', fontFamily: 'monospace', fontSize: '0.8rem' }}>{receiptNo}</td>
                                  {showStatementAuditIds && <td style={{ padding: '0.6rem', color: '#475569', fontFamily: 'monospace', fontSize: '0.78rem' }}>{entry.sourceTransactionId || '-'}</td>}
                                  <td style={{ padding: '0.6rem', color: '#374151' }}>{String(entry.referenceType || 'journal').toUpperCase()}</td>
                                  <td style={{ padding: '0.6rem', color: '#374151', textTransform: 'capitalize' }}>{entry.metalDealType || '-'}</td>
                                  <td style={{ padding: '0.6rem' }}>
                                    {(sourceType === 'sale' || sourceType === 'purchase') && (entry.metalFixStatus === 'fixed' || entry.metalFixStatus === 'unfixed') ? (
                                      <span style={{ background: entry.metalFixStatus === 'fixed' ? '#DCFCE7' : '#FEF3C7', color: entry.metalFixStatus === 'fixed' ? '#166534' : '#92400E', borderRadius: '999px', padding: '0.12rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'capitalize' }}>
                                        {entry.metalFixStatus}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td style={{ padding: '0.6rem', color: '#374151' }}>{entry.description || '-'}</td>
                                  <td style={{ padding: '0.6rem', color: '#374151' }}>
                                    {entry.offsetAccountCode ? `${entry.offsetAccountCode}${entry.offsetAccountName ? ` - ${entry.offsetAccountName}` : ''}` : '-'}
                                  </td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#065F46', fontWeight: '600', borderLeft: '1px solid #E5E7EB' }}>{formatStatementValue(debitUsd, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#B91C1C', fontWeight: '600' }}>{formatStatementValue(creditUsd, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: getSignedColor(balanceUsd), fontWeight: '700' }}>
                                    {formatDirectionalBalance(balanceUsd)}
                                  </td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#065F46', fontWeight: '600', borderLeft: '1px solid #E5E7EB' }}>{formatStatementNullableValue(debitPureWeight, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#B91C1C', fontWeight: '600' }}>{formatStatementNullableValue(creditPureWeight, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: getSignedColor(balancePureWeight), fontWeight: '700' }}>
                                    {balancePureWeight === null ? '-' : formatDirectionalBalance(balancePureWeight)}
                                  </td>
                                </tr>
                              )
                              })
                            })()
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

            </div>

            {/* Footer */}
            <div style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {canExportAccountSummary && accountEnquiryData && (
                <>
                  <button onClick={handleExportEnquiryPdf} style={{ padding: '0.6rem 1.2rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '700' }}>Export PDF</button>
                </>
              )}
              <button onClick={() => setShowEnquiryModal(false)} style={{ padding: '0.6rem 1.2rem', background: '#6B7280', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '700' }}>Close</button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}

export default ERPTab
