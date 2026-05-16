import { useState, useEffect, useCallback, useRef } from 'react'
import AccountCombobox from '../AccountCombobox'
import axios from 'axios'
import { useLanguage } from '../../context/LanguageContext'
import { ACCOUNT_TYPES } from '../../constants/accountTypes'
import { getTenantBranding } from '../../config/tenantBranding'
import DocumentPrintHeader from './erp/DocumentPrintHeader'
import MGVoucherPrintLayout from './erp/MGVoucherPrintLayout'
import { resolveDocumentBranding } from './erp/documentBranding'

const BASE = '/api/erp-accounting'
const cfg = () => ({ withCredentials: true })

const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const today = () => new Date().toISOString().slice(0, 10)

const S = {
  // Colours
  green: 'var(--purple-light)',
  greenDark: 'var(--purple)',
  danger: '#DC2626',
  ink: '#111827',
  muted: '#6B7280',
  border: '#D1D5DB',
  bg: '#F9FAFB',
  white: '#FFFFFF',
  blueSoft: '#EFF6FF',
  headerBg: '#F3F4F6',
}

const fieldRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '0.6rem 1rem',
  marginBottom: '0.5rem',
}

const fieldGroup = (label, children, span) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  gridColumn: span ? `span ${span}` : undefined,
})

const labelStyle = { fontSize: '0.72rem', fontWeight: '600', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }

const inputStyle = {
  padding: '0.35rem 0.6rem',
  border: `1px solid ${S.border}`,
  borderRadius: '0.3rem',
  fontSize: '0.875rem',
  background: S.white,
  color: S.ink,
  width: '100%',
  boxSizing: 'border-box',
}

const readInput = { ...inputStyle, background: S.bg, color: S.muted }

const sectionBox = {
  border: `1px solid ${S.border}`,
  borderRadius: '0.5rem',
  marginBottom: '1rem',
  overflow: 'visible',
}

const sectionHeader = {
  background: S.headerBg,
  padding: '0.4rem 0.8rem',
  fontWeight: '700',
  fontSize: '0.8rem',
  color: S.ink,
  borderBottom: `1px solid ${S.border}`,
  letterSpacing: '0.03em',
}

const sectionBody = { padding: '0.75rem' }

const btn = (variant = 'primary') => ({
  padding: '0.45rem 1rem',
  borderRadius: '0.375rem',
  fontSize: '0.85rem',
  fontWeight: '600',
  cursor: 'pointer',
  border: 'none',
  ...(variant === 'primary' ? { background: S.green, color: S.white } :
     variant === 'secondary' ? { background: S.white, color: S.ink, border: `1px solid ${S.border}` } :
     variant === 'danger' ? { background: S.danger, color: S.white } :
     variant === 'gray' ? { background: '#E5E7EB', color: S.ink } : {}),
})

const tabBtn = (active) => ({
  padding: '0.42rem 1rem',
  fontSize: '0.78rem',
  fontWeight: '700',
  color: active ? 'var(--purple)' : '#374151',
  background: active
    ? 'linear-gradient(180deg, #FFF7F0 0%, #FFE8D0 100%)'
    : 'linear-gradient(180deg, #FFFFFF 0%, #ECECEC 100%)',
  border: `1px solid ${active ? 'var(--purple)' : '#BFC5CB'}`,
  borderTop: '1px solid #F8FAFC',
  borderLeft: '1px solid #EEF2F7',
  boxShadow: active
    ? 'inset 0 1px 0 rgba(255,255,255,0.95), 0 1px 2px rgba(15,23,42,0.08)'
    : 'inset 0 1px 0 rgba(255,255,255,0.9)',
  borderRadius: '0.24rem 0.24rem 0 0',
  cursor: 'pointer',
  minWidth: '88px',
})

const classicHeaderShell = {
  padding: '0.1rem 0',
}

const classicHeaderGrid = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.65rem',
  alignItems: 'start',
}

const classicPanel = {
  border: '1px solid #C9CED6',
  borderRadius: '0.25rem',
  background: '#FFFFFF',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88)',
  overflow: 'visible',
  alignSelf: 'start',
  height: 'fit-content',
}

const classicPanelTitle = {
  background: 'linear-gradient(180deg, #F3F4F6 0%, #D8DCE2 100%)',
  borderBottom: '1px solid #C9CED6',
  color: '#4B5563',
  fontSize: '0.72rem',
  fontWeight: '700',
  letterSpacing: '0.04em',
  padding: '0.42rem 0.65rem',
  textTransform: 'uppercase',
}

const classicPartyGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1.25fr) minmax(140px, 0.75fr)',
  gap: '0.38rem 0.5rem',
  padding: '0.38rem 0.55rem 0.4rem',
  alignItems: 'end',
}

const classicPartyCard = {
  margin: '0 0.55rem 0.55rem',
  border: '1px solid #C9CED6',
  borderRadius: '0.2rem',
  background: '#FBFCFE',
  overflow: 'hidden',
}

const classicPartyCardHeader = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  borderBottom: '1px solid #D7DCE3',
  background: 'linear-gradient(180deg, #F8FBFF 0%, #E6ECF5 100%)',
}

const classicPartyCardTitle = {
  padding: '0.46rem 0.68rem',
  fontSize: '0.82rem',
  fontWeight: '700',
  color: '#F9FAFB',
  borderRight: '1px solid #D7DCE3',
  background: 'linear-gradient(180deg, #B8C4D6 0%, #94A3B8 100%)',
  textShadow: '0 1px 0 rgba(15,23,42,0.18)',
}

const classicPartyCardCodeWrap = {
  display: 'grid',
  gridTemplateColumns: 'minmax(96px, auto) 28px',
  background: '#FFFFFF',
}

const classicPartyCardCode = {
  padding: '0.42rem 0.55rem',
  fontSize: '0.78rem',
  fontWeight: '700',
  color: '#374151',
  background: '#FFFFFF',
  borderRight: '1px solid #D7DCE3',
  minWidth: '96px',
  textAlign: 'left',
}

const classicPartyCardCodeInput = {
  width: '100%',
  border: 0,
  outline: 'none',
  background: '#FFFFFF',
  padding: '0.42rem 0.55rem',
  fontSize: '0.78rem',
  fontWeight: '700',
  color: '#374151',
  boxSizing: 'border-box',
}

const classicPartyCardSearch = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.9rem',
  color: '#6B7280',
  background: 'linear-gradient(180deg, #FFFFFF 0%, #E5E7EB 100%)',
  border: 0,
  width: '100%',
  height: '100%',
  cursor: 'pointer',
}

const classicPartyCardName = {
  padding: '0.55rem 0.68rem',
  fontSize: '1.12rem',
  fontWeight: '800',
  color: '#243B53',
  borderBottom: '1px solid #E5E7EB',
  minHeight: '2.55rem',
  display: 'flex',
  alignItems: 'center',
  letterSpacing: '0.01em',
  background: '#FFFFFF',
}

const classicPartyCardBody = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.55rem 0.7rem',
  padding: '0.55rem 0.6rem 0.65rem',
}

const classicPartyCardField = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.18rem',
  minWidth: 0,
}

const classicPartyCardFieldLabel = {
  fontSize: '0.66rem',
  fontWeight: '700',
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const classicPartyCardFieldValue = {
  fontSize: '0.8rem',
  color: '#111827',
  minHeight: '1rem',
  wordBreak: 'break-word',
}

const classicRightGrid = {
  display: 'grid',
  gridTemplateColumns: '96px minmax(0, 1fr)',
  gap: '0.32rem 0.5rem',
  padding: '0.38rem 0.55rem 0.4rem',
  alignItems: 'center',
}

const classicLabel = {
  fontSize: '0.7rem',
  fontWeight: '700',
  color: '#4B5563',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

const classicInput = {
  ...inputStyle,
  minHeight: '1.9rem',
  borderRadius: '0.12rem',
  borderColor: '#C8CED6',
  background: '#FFFFFF',
  boxShadow: 'inset 0 1px 1px rgba(15, 23, 42, 0.04)',
  padding: '0.28rem 0.45rem',
  fontSize: '0.82rem',
}

const classicReadInput = {
  ...classicInput,
  background: '#F8FAFB',
  color: '#4B5563',
}

const classicTextAreaRow = {
  borderTop: '1px solid #D4D8DE',
  display: 'grid',
  gridTemplateColumns: '96px 150px',
  gap: '0.4rem 0.55rem',
  padding: '0.5rem 0.65rem 0.65rem',
  alignItems: 'center',
}

const metalWin = {
  shell: {
    border: '2px solid #7B8798',
    borderRadius: '0.45rem',
    background: '#E6E8EC',
    boxShadow: '0 14px 26px rgba(15, 23, 42, 0.45)',
  },
  body: {
    padding: '0.5rem 0.6rem',
    background: '#ECEFF3',
  },
  tabLabel: {
    color: '#334155',
    background: 'linear-gradient(180deg, #F2F4F7 0%, #D9DEE5 100%)',
    border: '1px solid #B7C0CC',
    textShadow: 'none',
  },
  headerRow: {
    background: 'linear-gradient(180deg, #F8F9FB 0%, #E7EAF0 100%)',
    color: '#374151',
    borderBottom: '1px solid #C9CED6',
  },
  tableCell: {
    borderRight: '1px solid #E5E7EB',
    borderBottom: '1px solid #D7DBE0',
    background: '#FFFFFF',
  },
  summaryHeader: {
    background: 'linear-gradient(180deg, #E8EAED 0%, #D4D8DF 100%)',
    color: '#374151',
  },
}

const metalTopInlineRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '0.55rem',
  alignItems: 'end',
  marginBottom: '0.55rem',
}

const metalTopField = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
}

const emptyLine = () => ({
  branch: '',
  acCode: '',
  stockCode: '',
  productType: '',
  stockGroup: '',
  metalSymbol: '',
  metalName: 'Gold',
  location: '',
  pcs: '',
  grossWeight: '',
  purity: '',
  pureWeight: '',
  weightInOz: '',
  availStock: '',
  rateType: 'OZ',
  metalRate: '',
  metalAmount: '',
  totalAmount: '',
  purityDiff: '',
  premiumValue: '',
  premiumAmount: '',
  makingCharges: '',
  silverPurity: '0',
  vatType: 'VAT',
  remarks: '',
  type: 'Cash',
  typeCode: '',
  currCode: 'USD',
  currRate: '',
  currRateSource: 'manual',
  exp: '',
  vatNumber: '',
  vatInv: '',
  vatInvDate: '',
  hsnAc: '',
  vatRef: '',
  chqNo: '',
  chqDate: today(),
  chqBank: '',
  amountFC: '',
  amountLC: '',
  headerAmt: '',
  vatPer: '',
  vatAmountFC: '',
  vatAmountLC: '',
  amountWithVAT: '',
  headerAmountWithVAT: '',
  narration: '',
  referenceRate: '',
})

const emptyHeader = () => ({
  branch: '',
  partyCode: '',
  partyName: '',
  currCode: 'USD',
  currRate: '1.000000',
  currRateSource: 'currency_table',
  vocDate: today(),
  vocNo: '',
  salesman: '',
  docDate: today(),
  valueDate: today(),
  fixingType: 'fixing',
})

const DOC_PREFIX_BY_TYPE = {
  payment: 'Pay',
  receipt: 'Rec',
  purchase: 'Pur',
  sale: 'Sal',
}

const getDocYear = (dateValue) => {
  const dt = new Date(dateValue || Date.now())
  const year = Number.isFinite(dt.getTime()) ? dt.getFullYear() : new Date().getFullYear()
  return String(year)
}

const parseVoucherDocMeta = (docNo, voucherType) => {
  const raw = String(docNo || '').trim()
  if (!raw) return null

  const numericOnly = raw.match(/^(\d+)$/)
  if (numericOnly) {
    const seq = Number(numericOnly[1])
    if (Number.isFinite(seq) && seq > 0) {
      return { year: 0, seq, sortKey: seq }
    }
  }

  const prefix = DOC_PREFIX_BY_TYPE[String(voucherType || '').toLowerCase()] || ''
  if (!prefix) return null

  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const formatted = raw.match(new RegExp(`^${escapedPrefix}/(\\d{4})/(\\d+)$`, 'i'))
  if (!formatted) return null

  const year = Number(formatted[1])
  const seq = Number(formatted[2])
  if (!Number.isFinite(year) || !Number.isFinite(seq) || seq <= 0) return null
  return { year, seq, sortKey: year * 100000 + seq }
}

const buildVoucherDocNo = (voucherType, docDate, sequence) => {
  const prefix = DOC_PREFIX_BY_TYPE[String(voucherType || '').toLowerCase()] || 'Doc'
  const year = getDocYear(docDate)
  return `${prefix}/${year}/${String(sequence).padStart(4, '0')}`
}

const normalizeLookupValue = (value) => String(value || '').trim().toLowerCase()
const normalizeLineType = (value) => (value === 'Transfer' ? 'TT' : (value || 'Cash'))
const FIXED_AED_RATE = 3.674
const toFinitePositive = (value, fallback = 1) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const backendRateToDisplayRate = (backendRate, currCode, usePerUsdDisplay = false) => {
  const normalized = String(currCode || '').trim().toUpperCase()
  const r = toFinitePositive(backendRate, 1)
  if (normalized === 'USD') return 1
  if (usePerUsdDisplay) return 1 / r
  if (normalized === 'AED' && r < 2) return 1 / r
  return r
}

// Payment/receipt UI shows rates as "1 USD = FC" while backend stores "USD per FC".
const displayRateToBackendRate = (displayRate, currCode, usePerUsdDisplay = false) => {
  const normalized = String(currCode || '').trim().toUpperCase()
  const r = parseFloat(displayRate) || 1
  if (normalized === 'USD') return 1
  if (usePerUsdDisplay && r > 0) return 1 / r
  if (normalized === 'AED' && r > 1) return 1 / r
  return r
}
const normalizeRateType = (value) => {
  const normalized = String(value || '').trim().toUpperCase()
  if (!normalized || normalized === 'GOZ') return 'OZ'
  return normalized
}
const normalizeVoucherFixingType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (['fixing', 'fixed'].includes(normalized)) return 'fixing'
  if (['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)) return 'non-fixing'
  return 'fixing'
}
const formatPartyAddress = (...parts) => parts.map((part) => String(part || '').trim()).filter(Boolean).join(', ')

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

const normalizeMetalSymbol = (mainStock, metalType) => {
  const val = String(mainStock || metalType || '').trim().toLowerCase()
  if (val === 'gold') return 'XAU'
  if (val === 'silver') return 'XAG'
  if (val === 'platinum') return 'XPT'
  return 'XAU'
}

const normalizeStockGroup = (mainStock, metalType) => {
  const val = String(mainStock || metalType || '').trim().toLowerCase()
  if (val === 'gold') return 'G'
  if (val === 'silver') return 'S'
  if (val === 'platinum') return 'P'
  return 'M'
}

const toTitle = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).trim()

const decodeFullMeta = (category) => {
  const raw = String(category || '')
  const meta = {}
  raw.split(';').forEach((pair) => {
    const [key, ...rest] = pair.split('=')
    if (!key || rest.length === 0) return
    meta[key.trim()] = rest.join('=').trim()
  })
  return meta
}

const getAccountCodeValue = (account) => String(account?.code || account?.accountCode || '').trim()
const getAccountNameValue = (account) => String(account?.name || account?.accountName || '').trim().toLowerCase()

const isBankLikeAccount = (account) => {
  const name = getAccountNameValue(account)
  const type = String(account?.accountType || '').trim().toLowerCase()
  const category = String(account?.category || '').trim().toLowerCase()
  const code = getAccountCodeValue(account).toLowerCase()
  return name.includes('bank')
    || type.includes('bank')
    || category.includes('bank')
    || code.includes('bank')
}

const pickDefaultAccountCodeByType = (accounts, lineType) => {
  const normalizedType = normalizeLineType(lineType)
  const accountList = Array.isArray(accounts) ? accounts : []

  if (normalizedType === 'TT') {
    const bank = accountList.find((a) => {
      const name = getAccountNameValue(a)
      return name.includes('bank')
    })
    return getAccountCodeValue(bank)
  }

  if (normalizedType === 'Cash') {
    const cashOnHand = accountList.find((a) => {
      const name = getAccountNameValue(a)
      return name.includes('cash on hand')
    })
    if (cashOnHand) return getAccountCodeValue(cashOnHand)

    const petty = accountList.find((a) => {
      const name = getAccountNameValue(a)
      return name.includes('petty cash')
    })
    if (petty) return getAccountCodeValue(petty)

    const cash = accountList.find((a) => {
      const name = getAccountNameValue(a)
      return name.includes('cash')
    })
    return getAccountCodeValue(cash)
  }

  return ''
}

export default function VoucherTab({ token, user, accounts = [], customers: propCustomers = [], vendors: propVendors = [], currencies = [], reportBranding = null }) {
  const { t } = useLanguage()
  const role = user?.role || ''
  const dept = (user?.department || '').toLowerCase()
  const isSuperAdmin = role === 'super_admin'
  const isFinance = isSuperAdmin || (role === 'department_head' && dept === 'finance')
  const isSales = isSuperAdmin || (role === 'department_head' && dept === 'sales') || role === 'management'
  const isOperations = isSuperAdmin || (role === 'department_head' && dept === 'operations')
  const isProduction = isSuperAdmin || (role === 'department_head' && dept === 'production')
  const isManagementOnly = role === 'management'

  const canView = isFinance || isSales || isOperations || isProduction || isManagementOnly || isSuperAdmin
  const canCreatePayment = isFinance || isSuperAdmin
  const canCreateReceipt = isFinance || isSales || isSuperAdmin
  const canCreatePurchase = isFinance || isOperations || isProduction || isSuperAdmin
  const canCreateSale = isFinance || isSales || isSuperAdmin
  const isReadOnly = isManagementOnly && !isFinance

  // ─── top-level state ────────────────────────────────────────────────────────
  const [voucherType, setVoucherType] = useState('payment')

  // ─── own customers/vendors state (always fresh, not stale props) ─────────────
  const [localCustomers, setLocalCustomers] = useState(propCustomers)
  const [localVendors, setLocalVendors] = useState(propVendors)
  const [localCurrencies, setLocalCurrencies] = useState(Array.isArray(currencies) ? currencies : [])
  const [latestMetalRates, setLatestMetalRates] = useState({ goldPrice: 0, silverPrice: 0, priceCurrency: 'USD', updatedAt: null })
  const customers = localCustomers.length > 0 ? localCustomers : propCustomers
  const vendors = localVendors.length > 0 ? localVendors : propVendors
  const mergedCurrencies = localCurrencies.length > 0 ? localCurrencies : (Array.isArray(currencies) ? currencies : [])
  const currencyOptions = mergedCurrencies
    .filter((item) => String(item?.code || '').trim())
    .map((item) => ({
      code: String(item.code || '').trim().toUpperCase(),
      name: String(item.name || '').trim(),
      exchangeRate: Number(item.exchangeRate || 1),
      isActive: item.isActive !== false,
      baseCurrency: Boolean(item.baseCurrency),
    }))
    .sort((a, b) => {
      if (a.baseCurrency !== b.baseCurrency) return a.baseCurrency ? -1 : 1
      return a.code.localeCompare(b.code)
    })
  const baseCurrencyCode = String(currencyOptions.find((item) => item.baseCurrency)?.code || 'USD').trim().toUpperCase() || 'USD'

  const getCurrencyRateByCode = useCallback((code) => {
    const normalized = String(code || '').trim().toUpperCase()
    const selected = currencyOptions.find((item) => item.code === normalized)
    const rate = Number(selected?.exchangeRate || 1)
    return Number.isFinite(rate) && rate > 0 ? rate : 1
  }, [currencyOptions])

  const refreshParties = useCallback(async () => {
    try {
      const [custRes, vendRes] = await Promise.all([
        axios.get(`${BASE}/customers`, { ...cfg(), params: { limit: 500 } }),
        axios.get(`${BASE}/vendors`, { ...cfg(), params: { limit: 500 } }),
      ])
      setLocalCustomers(custRes.data.customers || [])
      setLocalVendors(vendRes.data.vendors || [])
    } catch {
      // silently ignore — props fallback still available
    }
  }, [])

  const refreshCurrencies = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/currencies`, cfg())
      const items = Array.isArray(res.data?.currencies) ? res.data.currencies : []
      if (items.length > 0) {
        setLocalCurrencies(items)
      }
    } catch {
      // silently ignore — fallback to prop currencies or USD-only defaults
    }
  }, [])

  const refreshMetalRates = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE}/metal-rates`, cfg())
      const rates = res.data?.rates || {}
      const goldPrice = Number(rates.goldPrice || 0)
      setLatestMetalRates({
        goldPrice: Number.isFinite(goldPrice) && goldPrice > 0 ? goldPrice : 0,
        silverPrice: Number(rates.silverPrice || 0),
        priceCurrency: String(rates.priceCurrency || 'USD').trim().toUpperCase() || 'USD',
        updatedAt: rates.updatedAt || null,
      })
    } catch {
      // silently ignore — payment vouchers can still use normal currency rates
    }
  }, [])

  useEffect(() => {
    if (canView) refreshParties()
  }, [canView, refreshParties])
  useEffect(() => {
    if (canView) refreshCurrencies()
  }, [canView, refreshCurrencies])
  useEffect(() => {
    if (canView) refreshMetalRates()
  }, [canView, refreshMetalRates])
  const [vouchers, setVouchers] = useState([])
  const [loadingList, setLoadingList] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mode, setMode] = useState('list')            // 'list' | 'create' | 'view'
  const formReadOnly = isReadOnly || mode === 'view'
  const [editingId, setEditingId] = useState(null)
  const [selectedStatus, setSelectedStatus] = useState('') // workflow filter
  const [menuTab, setMenuTab] = useState('header')        // 'header' | 'accounts' | 'lineItems' | 'attachments'
  const [workflowNote, setWorkflowNote] = useState('')
  const [selectedPartyId, setSelectedPartyId] = useState('')
  const [recentPartyVouchers, setRecentPartyVouchers] = useState([])
  const [loadingRecentPartyVouchers, setLoadingRecentPartyVouchers] = useState(false)
  const [modalOffset, setModalOffset] = useState({ x: 0, y: 0 })
  const [modalDrag, setModalDrag] = useState(null)
  const dragMetaRef = useRef({ moved: false })
  const lastViewedIdRef = useRef(null)  // tracks the voucher open before New was clicked
  const initialFormSnapshotRef = useRef('')

  // ─── header form ────────────────────────────────────────────────────────────
  const [header, setHeader] = useState(emptyHeader())
  const setHdr = (key, value) => setHeader((prev) => ({ ...prev, [key]: value }))

  const voucherConfigs = {
    payment: { key: 'payment', label: 'Payment Voucher', short: t('paymentVoucher'), code: 'PAY', docPrefix: 'Pay', icon: '💳', partySelectLabel: 'Vendor', partyPlaceholder: 'Auto from vendor' },
    receipt: { key: 'receipt', label: 'Receipt Voucher', short: t('receiptVoucher'), code: 'REC', docPrefix: 'Rec', icon: '🧾', partySelectLabel: 'Customer', partyPlaceholder: 'Auto from customer' },
    purchase: { key: 'purchase', label: 'Metal Purchase Voucher', short: 'Metal Purchase', code: 'PUR', docPrefix: 'Pur', icon: '🟫', partySelectLabel: 'Vendor', partyPlaceholder: 'Auto from vendor' },
    sale: { key: 'sale', label: 'Metal Sale Voucher', short: 'Metal Sale', code: 'SAL', docPrefix: 'Sal', icon: '🟨', partySelectLabel: 'Customer', partyPlaceholder: 'Auto from customer' },
  }

  const voucherPartyMode = voucherType === 'receipt' || voucherType === 'sale'
    ? 'customer'
    : 'vendor'

  const resolveVoucherParty = useCallback((partyCode) => {
    const lookupValue = normalizeLookupValue(partyCode)
    if (!lookupValue) return null

    // Search vendors first
    const vendor = vendors.find((item) => {
      if (item.ledgerAccountId && item.ledgerAccountId.isActive === false) return false
      const ledgerCode = normalizeLookupValue(item.ledgerAccountId?.accountCode)
      return lookupValue === normalizeLookupValue(item._id)
        || lookupValue === normalizeLookupValue(item.vendorCode)
        || lookupValue === ledgerCode
    })
    if (vendor) {
      return {
        customerId: '',
        vendorId: vendor._id,
        partyName: vendor.name || '',
        partyCode: vendor.vendorCode || vendor.ledgerAccountId?.accountCode || String(vendor._id),
        partyId: `vendor:${String(vendor._id)}`,
        partyType: 'vendor',
        accountCurrency: String(vendor.ledgerAccountId?.currency || vendor.currency || '').trim().toUpperCase(),
        email: vendor.email || '',
        phone: vendor.phone || '',
        address: formatPartyAddress(vendor.address, vendor.city, vendor.country, vendor.postalCode),
      }
    }

    // Then search customers
    const customer = customers.find((item) => {
      if (item.ledgerAccountId && item.ledgerAccountId.isActive === false) return false
      const ledgerCode = normalizeLookupValue(item.ledgerAccountId?.accountCode)
      return lookupValue === normalizeLookupValue(item._id) || lookupValue === ledgerCode
    })

    return customer
      ? {
          customerId: customer._id,
          vendorId: '',
          partyName: customer.name || '',
          partyCode: customer.ledgerAccountId?.accountCode || String(customer._id),
          partyId: `customer:${String(customer._id)}`,
          partyType: 'customer',
          accountCurrency: String(customer.ledgerAccountId?.currency || customer.currency || '').trim().toUpperCase(),
          email: customer.email || '',
          phone: customer.phone || '',
          address: customer.address || '',
        }
      : null
  }, [customers, vendors])

  const PARTY_TYPE_ORDER = ['Asset', 'Liability', 'Equity', 'Income', 'Expense']
  const partyOptions = (Array.isArray(accounts) ? accounts : [])
    .map((account) => {
      const code = getAccountCodeValue(account)
      const name = String(account?.accountName || account?.name || '').trim()
      return {
        id: `account:${String(account?._id || code)}`,
        accountId: String(account?._id || code),
        label: `${code}${name ? ` - ${name}` : ''}`,
        partyCode: code,
        partyName: name,
        accountType: String(account?.accountType || 'Other').trim() || 'Other',
      }
    })
    .filter((item) => Boolean(item.partyCode))
    .sort((a, b) => {
      const ai = PARTY_TYPE_ORDER.indexOf(a.accountType)
      const bi = PARTY_TYPE_ORDER.indexOf(b.accountType)
      const tc = (ai === -1 ? PARTY_TYPE_ORDER.length : ai) - (bi === -1 ? PARTY_TYPE_ORDER.length : bi)
      if (tc !== 0) return tc
      return String(a.partyCode).localeCompare(String(b.partyCode))
    })

  const partyGroupedOptions = partyOptions.reduce((groups, item) => {
    const type = item.accountType
    const existing = groups.find((g) => g.type === type)
    if (existing) existing.items.push(item)
    else groups.push({ type, items: [item] })
    return groups
  }, [])

  const partyComboGroups = partyGroupedOptions.map((g) => ({
    label: g.type,
    options: g.items.map((item) => ({ value: item.id, label: item.label })),
  }))

  const findPartyOptionByCode = useCallback((code) => {
    const lookupValue = normalizeLookupValue(code)
    if (!lookupValue) return null
    return partyOptions.find((item) => (
      lookupValue === normalizeLookupValue(item.partyCode)
      || lookupValue === normalizeLookupValue(item.partyName)
    )) || null
  }, [partyOptions])

  const voucherLineAccountOptions = (Array.isArray(accounts) ? accounts : [])
    .map((a) => ({ id: a?._id, code: getAccountCodeValue(a), name: a?.accountName || a?.name || '', raw: a }))
    .filter((a) => a.code)
    .filter((a) => isBankLikeAccount(a.raw))
    .sort((a, b) => a.code.localeCompare(b.code))

  const LINE_ACCOUNT_TYPE_ORDER = ACCOUNT_TYPES
  const lineAccountComboGroups = (() => {
    const accountList = (Array.isArray(accounts) ? accounts : [])
      .map((a) => ({
        code: getAccountCodeValue(a),
        name: String(a?.accountName || a?.name || '').trim(),
        accountType: String(a?.accountType || 'Other').trim(),
      }))
      .filter((a) => a.code)
      .sort((a, b) => {
        const ai = LINE_ACCOUNT_TYPE_ORDER.indexOf(a.accountType)
        const bi = LINE_ACCOUNT_TYPE_ORDER.indexOf(b.accountType)
        const tc = (ai === -1 ? LINE_ACCOUNT_TYPE_ORDER.length : ai) - (bi === -1 ? LINE_ACCOUNT_TYPE_ORDER.length : bi)
        if (tc !== 0) return tc
        return a.code.localeCompare(b.code)
      })
    const groupMap = {}
    accountList.forEach((item) => {
      if (!groupMap[item.accountType]) groupMap[item.accountType] = []
      groupMap[item.accountType].push({ value: item.code, label: `${item.code}${item.name ? ` - ${item.name}` : ''}` })
    })
    return LINE_ACCOUNT_TYPE_ORDER
      .filter((type) => groupMap[type])
      .map((type) => ({ label: type, options: groupMap[type] }))
  })()

  const loadRecentPartyVouchers = useCallback(async (resolvedParty) => {
    if (!resolvedParty || (!resolvedParty.customerId && !resolvedParty.vendorId)) {
      setRecentPartyVouchers([])
      return
    }

    setLoadingRecentPartyVouchers(true)
    try {
      const params = {
        limit: 5,
        type: voucherType,
      }
      if (resolvedParty.customerId) params.customerId = resolvedParty.customerId
      if (resolvedParty.vendorId) params.vendorId = resolvedParty.vendorId

      const response = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params,
      })

      const items = (response.data.transactions || [])
        .filter((item) => item.voucherMeta?.vocNo)
        .slice(0, 5)
        .map((item) => ({
          id: item._id,
          vocNo: item.voucherMeta?.vocNo || '-',
          date: item.date ? String(item.date).slice(0, 10) : '-',
          amount: Number(item.amount || 0),
          currency: item.currency || 'USD',
          type: item.type || '-',
          status: item.status || 'draft',
        }))

      setRecentPartyVouchers(items)
    } catch {
      setRecentPartyVouchers([])
    } finally {
      setLoadingRecentPartyVouchers(false)
    }
  }, [voucherType])

  // ─── help panel ─────────────────────────────────────────────────────────────
  const [showHelp, setShowHelp] = useState(false)

  // ─── line items ─────────────────────────────────────────────────────────────
  const [lineItems, setLineItems] = useState([])
  const [showLineForm, setShowLineForm] = useState(false)
  const [editingLineIdx, setEditingLineIdx] = useState(null)
  const [lineForm, setLineForm] = useState(emptyLine())
  const [inventoryProducts, setInventoryProducts] = useState([])
  const [loadingInventoryProducts, setLoadingInventoryProducts] = useState(false)
  const setLF = (k, v) => setLineForm(prev => ({ ...prev, [k]: k === 'rateType' ? normalizeRateType(v) : v }))

  const resolvePaymentRate = useCallback((currencyCode) => {
    const normalized = String(currencyCode || 'USD').trim().toUpperCase()
    if (normalized === 'USD') {
      return { rate: 1, source: 'base_currency' }
    }
    if (normalized === 'AED') {
      return { rate: FIXED_AED_RATE, source: 'fixed_aed' }
    }
    const fallbackRate = getCurrencyRateByCode(normalized)
    const displayRate = backendRateToDisplayRate(fallbackRate, normalized, true)
    return { rate: displayRate, source: 'currency_table' }
  }, [getCurrencyRateByCode])

  const buildFormSnapshot = useCallback((snapshotHeader, snapshotLineItems, snapshotPartyId) => JSON.stringify({
    header: {
      branch: String(snapshotHeader?.branch || ''),
      partyCode: String(snapshotHeader?.partyCode || ''),
      partyName: String(snapshotHeader?.partyName || ''),
      currCode: String(snapshotHeader?.currCode || ''),
      currRate: String(snapshotHeader?.currRate || ''),
      currRateSource: String(snapshotHeader?.currRateSource || ''),
      vocDate: String(snapshotHeader?.vocDate || ''),
      vocNo: String(snapshotHeader?.vocNo || ''),
      salesman: String(snapshotHeader?.salesman || ''),
      docDate: String(snapshotHeader?.docDate || ''),
      valueDate: String(snapshotHeader?.valueDate || ''),
      fixingType: String(snapshotHeader?.fixingType || ''),
    },
    selectedPartyId: String(snapshotPartyId || ''),
    lineItems: Array.isArray(snapshotLineItems)
      ? snapshotLineItems.map((line) => ({ ...line, type: normalizeLineType(line?.type) }))
      : [],
  }), [])

  const hasDraftLineFormData = useCallback(() => {
    if (!showLineForm) return false
    return Boolean(
      String(lineForm.acCode || '').trim()
      || String(lineForm.stockCode || '').trim()
      || String(lineForm.productType || '').trim()
      || Number(lineForm.amountLC || 0)
      || Number(lineForm.amountFC || 0)
      || Number(lineForm.totalAmount || 0)
      || Number(lineForm.metalAmount || 0)
      || Number(lineForm.grossWeight || 0)
      || Number(lineForm.pureWeight || 0)
      || Number(lineForm.premiumAmount || 0)
      || Number(lineForm.makingCharges || 0)
    )
  }, [showLineForm, lineForm])

  const hasUnsavedVoucherChanges = useCallback(() => {
    if (mode !== 'create') return false
    if (hasDraftLineFormData()) return true
    return buildFormSnapshot(header, lineItems, selectedPartyId) !== initialFormSnapshotRef.current
  }, [mode, hasDraftLineFormData, buildFormSnapshot, header, lineItems, selectedPartyId])

  const confirmExitVoucherForm = useCallback(() => {
    if (!hasUnsavedVoucherChanges()) return true
    return window.confirm('Close voucher form and discard unsaved changes?')
  }, [hasUnsavedVoucherChanges])

  const applyLineAutoCalc = useCallback((line) => {
    const next = { ...line }
    const grossWeight = parseFloat(next.grossWeight) || 0
    const purityValue = parseFloat(next.purity)
    const purityRatio = !Number.isFinite(purityValue) || purityValue <= 0
      ? 0
      : (purityValue > 1.2 ? purityValue / 1000 : purityValue)

    const pureWeight = grossWeight > 0 && purityRatio > 0
      ? Number((grossWeight * purityRatio).toFixed(3))
      : 0

    const weightInOz = pureWeight > 0
      ? Number((pureWeight / 31.1034768).toFixed(3))
      : 0

    const rateType = normalizeRateType(next.rateType)
    const metalRate = parseFloat(next.metalRate) || 0
    const rateQty = rateType === 'GRAM'
      ? pureWeight
      : rateType === 'KG'
        ? pureWeight / 1000
        : weightInOz

    const computedMetalAmount = rateQty > 0 && metalRate > 0
      ? Number((rateQty * metalRate).toFixed(2))
      : 0
    const existingMetalAmount = parseFloat(next.metalAmount) || 0
    const effectiveMetalAmount = computedMetalAmount > 0 ? computedMetalAmount : existingMetalAmount

    const premiumRate = parseFloat(next.premiumValue) || 0
    const computedPremiumAmount = rateQty > 0 && premiumRate !== 0
      ? Number((rateQty * premiumRate).toFixed(2))
      : 0
    const makingChargesAmt = parseFloat(next.makingCharges) || 0

    const baseTotal = Number((effectiveMetalAmount + computedPremiumAmount + makingChargesAmt).toFixed(2))
    const vatPer = parseFloat(next.vatPer) || 0
    const vatAmount = Number(((baseTotal * vatPer) / 100).toFixed(2))
    const amountWithVAT = Number((baseTotal + vatAmount).toFixed(2))
    const derivedMetalRate = rateQty > 0 && effectiveMetalAmount > 0
      ? Number((effectiveMetalAmount / rateQty).toFixed(2))
      : 0
    const effectiveMetalRate = metalRate > 0 ? metalRate : derivedMetalRate

    return {
      ...next,
      pureWeight: pureWeight > 0 ? pureWeight.toFixed(3) : '',
      weightInOz: weightInOz > 0 ? weightInOz.toFixed(3) : '',
      metalRate: effectiveMetalRate > 0 ? effectiveMetalRate.toFixed(2) : (next.metalRate || ''),
      metalAmount: effectiveMetalAmount > 0 ? effectiveMetalAmount.toFixed(2) : '',
      premiumAmount: computedPremiumAmount !== 0 ? computedPremiumAmount.toFixed(2) : '',
      totalAmount: baseTotal > 0 ? baseTotal.toFixed(2) : '',
      amountLC: baseTotal > 0 ? baseTotal.toFixed(2) : '',
      vatAmountLC: vatPer > 0 ? vatAmount.toFixed(2) : '',
      vatAmountFC: vatPer > 0 ? vatAmount.toFixed(2) : '',
      amountWithVAT: baseTotal > 0 ? amountWithVAT.toFixed(2) : '',
    }
  }, [])

  const applyProductTypeAutoFill = useCallback((line, productNameOverride) => {
    const productName = String(productNameOverride ?? (line.productType || '')).trim()
    if (!productName) return line

    const product = inventoryProducts.find(
      (item) => item.name === productName && String(item.category || '').includes('recordType=product')
    )
    if (!product) return line

    const meta = decodeFullMeta(product.category)
    const simMeta = decodeInventoryCategoryMeta(product.category)
    const unitWeight = parseFloat(meta.weight || product.weight || '') || 0
    const pcs = Math.max(0, parseFloat(line.pcs) || 0)
    const grossWeight = unitWeight > 0
      ? (pcs > 0 ? unitWeight * pcs : unitWeight)
      : (parseFloat(line.grossWeight) || 0)
    const rawPurity = parseFloat(meta.productPurity || simMeta.purity || '') || 0
    const productVatPer = parseFloat(meta.vatPercent || '') || 0
    const productTaxType = String(meta.taxType || 'VAT').trim()

    return applyLineAutoCalc({
      ...line,
      productType: productName,
      grossWeight: grossWeight > 0 ? String(Number(grossWeight.toFixed(3))) : line.grossWeight,
      purity: rawPurity > 0 ? String(rawPurity) : line.purity,
      vatType: productTaxType || line.vatType || 'VAT',
      vatPer: productVatPer > 0 ? String(productVatPer) : line.vatPer,
    })
  }, [applyLineAutoCalc, inventoryProducts])

  const handleStockSelection = useCallback((selectedStockCode) => {
    const normalizedStockCode = String(selectedStockCode || '').trim()
    const product = inventoryProducts.find((item) => String(item.sku || '').trim().toLowerCase() === normalizedStockCode.toLowerCase())

    if (!product) {
      setLineForm((prev) => ({ ...prev, stockCode: normalizedStockCode }))
      return
    }

    const fullMeta = decodeFullMeta(product.category)
    const meta = decodeInventoryCategoryMeta(product.category)
    const mainStock = meta.mainStock || meta.metalType || ''
    const symbol = normalizeMetalSymbol(mainStock, meta.metalType)
    const stockGroup = normalizeStockGroup(mainStock, meta.metalType)
    const defaultRate = voucherType === 'sale'
      ? Number(product.sellingPrice || 0)
      : Number(product.unitCost || 0)
    const storedPriceUnit = String(fullMeta.priceUnit || '').trim().toUpperCase()
    const resolvedRateType = normalizeRateType(storedPriceUnit || 'OZ')
    const storedCurrency = String(fullMeta.priceCurrency || product.currency || 'USD').toUpperCase()
    const productVatPer = parseFloat(fullMeta.vatPercent || '') || 0
    const productTaxType = String(fullMeta.taxType || 'VAT').trim()

    setLineForm((prev) => applyLineAutoCalc({
      ...prev,
      stockCode: String(product.sku || normalizedStockCode),
      stockGroup,
      metalSymbol: symbol,
      metalName: toTitle(mainStock || meta.metalType || product.name || 'Metal'),
      location: String(product.wipStage || prev.location || ''),
      availStock: `${Number(product.quantity || 0).toLocaleString()} ${String(product.unit || '').trim()}`.trim(),
      purity: String(meta.purity || prev.purity || ''),
      metalRate: defaultRate > 0 ? defaultRate.toFixed(2) : prev.metalRate,
      rateType: resolvedRateType,
      currCode: storedCurrency,
      vatType: productTaxType || prev.vatType || 'VAT',
      vatPer: productVatPer > 0 ? String(productVatPer) : prev.vatPer,
    }))
  }, [applyLineAutoCalc, inventoryProducts, voucherType])

  useEffect(() => {
    if (!canView) return
    let mounted = true

    const loadInventoryProducts = async () => {
      setLoadingInventoryProducts(true)
      try {
        const res = await axios.get(`${BASE}/inventory/products`, {
          ...cfg(),
          params: { page: 1, limit: 500 },
        })
        if (!mounted) return
        setInventoryProducts(res.data.products || [])
      } catch {
        if (mounted) setInventoryProducts([])
      } finally {
        if (mounted) setLoadingInventoryProducts(false)
      }
    }

    loadInventoryProducts()
    return () => { mounted = false }
  }, [canView])

  useEffect(() => {
    if (!showLineForm || (voucherType !== 'purchase' && voucherType !== 'sale')) return
    setLineForm((prev) => {
      const calculated = applyLineAutoCalc(prev)
      const keys = ['pureWeight', 'weightInOz', 'metalAmount', 'totalAmount', 'amountLC', 'vatAmountLC', 'vatAmountFC', 'amountWithVAT']
      const hasChanges = keys.some((key) => String(prev[key] || '') !== String(calculated[key] || ''))
      return hasChanges ? calculated : prev
    })
  }, [showLineForm, voucherType, lineForm.grossWeight, lineForm.purity, lineForm.metalRate, lineForm.rateType, lineForm.vatPer, lineForm.premiumValue, lineForm.makingCharges, applyLineAutoCalc])

  // ─── helpers ─────────────────────────────────────────────────────────────────
  const showMsg = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 4000) }
  const clearError = () => setError('')
  const runToolbarAction = useCallback((label, action) => {
    clearError()
    try {
      const result = action?.()
      if (result && typeof result.then === 'function') {
        result.catch((err) => {
          console.error(`[VoucherToolbar] ${label} failed`, err)
          setError(err?.message || `${label} failed. Please try again.`)
        })
      }
    } catch (err) {
      console.error(`[VoucherToolbar] ${label} failed`, err)
      setError(err?.message || `${label} failed. Please try again.`)
    }
  }, [clearError])

  const effectiveLineItems = (() => {
    if (!showLineForm) return lineItems

    const draftLine = {
      ...lineForm,
      type: normalizeLineType(lineForm.type),
      amountLC: lineForm.amountLC || lineForm.totalAmount || lineForm.metalAmount || '',
      amountWithVAT: lineForm.amountWithVAT || lineForm.amountLC || lineForm.amountFC || '',
    }

    if (editingLineIdx !== null) {
      return lineItems.map((item, index) => (index === editingLineIdx ? draftLine : item))
    }

    const hasDraftContent = Boolean(
      String(draftLine.stockCode || draftLine.acCode || draftLine.productType || '').trim()
      || parseFloat(draftLine.amountWithVAT)
      || parseFloat(draftLine.amountLC)
      || parseFloat(draftLine.metalAmount)
    )

    return hasDraftContent ? [...lineItems, draftLine] : lineItems
  })()

  const totals = {
    metalTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.metalAmount) || 0), 0),
    premiumTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.premiumAmount) || 0), 0),
    makingTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.makingCharges) || 0), 0),
    total: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.amountLC) || 0), 0),
    vatAmount: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.vatAmountLC) || 0), 0),
    grandTotal: effectiveLineItems.reduce((s, l) => s + (parseFloat(l.amountWithVAT) || parseFloat(l.amountLC) || 0), 0),
  }

  const canCreate = voucherType === 'payment'
    ? canCreatePayment
    : voucherType === 'receipt'
      ? canCreateReceipt
      : voucherType === 'purchase'
        ? canCreatePurchase
        : canCreateSale

  const sortVouchersByDocNo = useCallback((items, type) => {
    const src = Array.isArray(items) ? [...items] : []
    return src.sort((a, b) => {
      const am = parseVoucherDocMeta(a?.voucherMeta?.vocNo, type)
      const bm = parseVoucherDocMeta(b?.voucherMeta?.vocNo, type)
      const ak = am?.sortKey ?? 0
      const bk = bm?.sortKey ?? 0
      if (ak !== bk) return ak - bk
      return new Date(a?.date || 0).getTime() - new Date(b?.date || 0).getTime()
    })
  }, [])

  // ─── load vouchers ───────────────────────────────────────────────────────────
  const loadVouchers = useCallback(async () => {
    if (!canView) return
    setLoadingList(true)
    try {
      const res = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type: voucherType, limit: 200 },
      })
      const txs = sortVouchersByDocNo(
        (res.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
        voucherType
      )
      setVouchers(txs)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to load vouchers')
    } finally {
      setLoadingList(false)
    }
  }, [voucherType, canView, sortVouchersByDocNo])

  useEffect(() => { loadVouchers() }, [loadVouchers])

  useEffect(() => {
    if (!modalDrag) return

    const onMouseMove = (e) => {
      const dx = e.clientX - modalDrag.startX
      const dy = e.clientY - modalDrag.startY
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) {
        dragMetaRef.current.moved = true
      }
      setModalOffset({
        x: modalDrag.baseX + dx,
        y: modalDrag.baseY + dy,
      })
    }

    const onMouseUp = () => {
      setModalDrag(null)
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [modalDrag])

  // ─── next voucher number ─────────────────────────────────────────────────────
  const nextVocNo = (list, voucherTypeOverride = voucherType, docDateOverride = header.docDate) => {
    const src = Array.isArray(list) ? list : vouchers
    const normalizedType = String(voucherTypeOverride || voucherType || '').toLowerCase()
    const currentYear = Number(getDocYear(docDateOverride))
    const nos = src
      .map((v) => parseVoucherDocMeta(v?.voucherMeta?.vocNo, normalizedType))
      .filter(Boolean)
      .filter((meta) => meta.year === 0 || meta.year === currentYear)
      .map((meta) => meta.seq)
      .filter((n) => Number.isFinite(n) && n > 0)
    const next = nos.length ? Math.max(...nos) + 1 : 1
    return buildVoucherDocNo(normalizedType, docDateOverride, next)
  }

  // ─── open create ────────────────────────────────────────────────────────────
  const openCreate = (freshList, forcedType = voucherType) => {
    // If already filling a new form, ask before discarding
    if (mode === 'create' && !editingId) {
      const hasData = String(header.partyCode || '').trim() || lineItems.length > 0 || String(header.narration || '').trim()
      if (hasData && !window.confirm('Discard current unsaved form and open a new one?')) return
      // Don’t overwrite lastViewedIdRef — it already points to the voucher before the first New
    } else {
      // Only update the back-reference when coming from a real saved voucher
      if (editingId) lastViewedIdRef.current = editingId
    }
    const baseHeader = emptyHeader()
    const nextHeader = {
      ...baseHeader,
      vocNo: nextVocNo(freshList, forcedType, baseHeader.docDate),
    }
    setEditingId(null)
    setHeader(nextHeader)
    setSelectedPartyId('')
    setRecentPartyVouchers([])
    setLineItems([])
    setShowLineForm(false)
    setMenuTab('header')
    setWorkflowNote('')
    setModalOffset({ x: 0, y: 0 })
    setModalDrag(null)
    setError('')
    setMode('create')
    initialFormSnapshotRef.current = buildFormSnapshot(nextHeader, [], '')
  }

  // ─── open last voucher for a type, or blank form if none exist ───────────────
  const openLastOrCreate = async (type) => {
    try {
      const res = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type, limit: 200 },
      })
      const txs = sortVouchersByDocNo(
        (res.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
        type
      )
      setVouchers(txs)
      if (txs.length > 0) {
        // open the last (highest vocNo) voucher
        openVoucher(txs[txs.length - 1])
      } else {
        // Pass txs directly so nextVocNo uses the fresh list, not stale state
        openCreate(txs, type)
      }
    } catch {
      // fallback: just open blank form
      openCreate(undefined, type)
    }
  }

  const handleModalHeaderMouseDown = (e) => {
    if (mode !== 'create' || e.button !== 0) return
    if (e.target instanceof Element && e.target.closest('button')) return

    dragMetaRef.current.moved = false
    setModalDrag({
      startX: e.clientX,
      startY: e.clientY,
      baseX: modalOffset.x,
      baseY: modalOffset.y,
    })
  }

  const handleVoucherModalBackdropClick = () => {
    if (mode !== 'create' && mode !== 'view') return
    if (dragMetaRef.current.moved) {
      dragMetaRef.current.moved = false
      return
    }
    if (!confirmExitVoucherForm()) {
      return
    }
    setMode('list')
  }

  // ─── ERP toolbar navigation & delete ─────────────────────────────────────────
  const navFirst = () => {
    if (!vouchers.length) {
      setError('No vouchers available for this voucher type')
      return
    }
    openVoucher(vouchers[0])
  }
  const navPrev = () => {
    if (!vouchers.length) {
      setError('No vouchers available for this voucher type')
      return
    }
    const idx = vouchers.findIndex(v => v._id === editingId)
    if (idx === -1) {
      openVoucher(vouchers[vouchers.length - 1])
      return
    }
    if (idx > 0) {
      openVoucher(vouchers[idx - 1])
      return
    }
    showMsg('Already at first voucher')
  }
  const navNext = () => {
    if (!vouchers.length) {
      setError('No vouchers available for this voucher type')
      return
    }
    const idx = vouchers.findIndex(v => v._id === editingId)
    if (idx === -1) {
      openVoucher(vouchers[0])
      return
    }
    if (idx >= 0 && idx < vouchers.length - 1) {
      openVoucher(vouchers[idx + 1])
      return
    }
    showMsg('Already at last voucher')
  }
  const navLast = () => {
    if (!vouchers.length) {
      setError('No vouchers available for this voucher type')
      return
    }
    openVoucher(vouchers[vouchers.length - 1])
  }

  const handleEditUnlock = () => {
    if (isReadOnly) {
      setError('You have read-only access')
      return
    }
    if (!editingId) {
      if (mode !== 'create') {
        setError('Open a voucher first, then click Edit')
      } else {
        showMsg('Already in EDIT mode')
      }
      return
    }
    if (currentVoucherStatus === 'posted') {
      if (!window.confirm('Editing a posted voucher will reverse its ledger entries and reset it to Draft status. Proceed?')) return
    }
    setMode('create')
    clearError()
    showMsg('Mode: EDIT')
  }

  const handleCancelChanges = () => {
    if (mode === 'create') {
      if (window.confirm('Discard unsaved changes?')) {
        // If editing an existing voucher, revert to it
        if (editingId) {
          const existing = vouchers.find((v) => v._id === editingId)
          if (existing) {
            openVoucher(existing)
            showMsg('Changes discarded')
            return
          }
        }
        // New blank form — go back to last viewed voucher if available
        const prev = lastViewedIdRef.current
          ? vouchers.find(v => v._id === lastViewedIdRef.current)
          : null
        if (prev) {
          openVoucher(prev)
          showMsg('Cancelled — returned to last entry')
        } else if (vouchers.length > 0) {
          openVoucher(vouchers[vouchers.length - 1])
          showMsg('Cancelled — returned to last entry')
        } else {
          setMode('list')
        }
      }
      return
    }
    setMode('list')
  }

  const handleSearchFind = () => {
    const term = window.prompt('Search vouchers by voucher number, party code/name, or date (YYYY-MM-DD):', '')
    if (term === null) return
    const q = String(term || '').trim().toLowerCase()
    if (!q) {
      showMsg('Search cleared')
      return
    }

    const match = vouchers.find((v) => {
      const m = v.voucherMeta || {}
      const vocNo = String(m.vocNo || '').toLowerCase()
      const partyCode = String(m.partyCode || '').toLowerCase()
      const partyName = String(m.partyName || '').toLowerCase()
      const dt = String(v.date || '').slice(0, 10).toLowerCase()
      return vocNo.includes(q) || partyCode.includes(q) || partyName.includes(q) || dt.includes(q)
    })

    if (match) {
      openVoucher(match)
      showMsg(`Found voucher #${match.voucherMeta?.vocNo || '-'}`)
      return
    }

    setError('No voucher matched your search')
  }

  const handleBarcodeAction = () => {
    const activeLine = lineItems.find((line) => String(line.stockCode || '').trim())
    const stockCode = activeLine?.stockCode || 'N/A'
    const voucherNo = header.vocNo || 'NEW'
    alert(`Voucher: ${voucherNo}\nStock Barcode Ref: ${stockCode}`)
  }

  const handleExitVoucherForm = () => {
    setMode('list')
    showMsg('Closed voucher form')
  }

  const handleDeleteVoucher = async () => {
    if (isReadOnly) {
      setError('You have read-only access')
      return
    }

    if (!editingId && mode === 'create') {
      const hasData = String(header.partyCode || '').trim() || lineItems.length > 0 || String(header.narration || '').trim()
      if (!hasData) {
        showMsg('Nothing to delete')
        return
      }
      if (!window.confirm('Clear this unsaved voucher entry?')) return
      setHeader({ ...emptyHeader(), vocNo: nextVocNo() })
      setSelectedPartyId('')
      setRecentPartyVouchers([])
      setLineItems([])
      setShowLineForm(false)
      setEditingLineIdx(null)
      setWorkflowNote('')
      clearError()
      showMsg('Unsaved voucher cleared')
      return
    }

    if (!editingId) {
      setError('No saved voucher selected to delete')
      return
    }

    if (currentVoucherStatus === 'posted') {
      setError('Posted vouchers cannot be deleted because they already affect ledger and stock')
      return
    }

    if (!window.confirm(`Delete voucher #${header.vocNo}? This cannot be undone.`)) return
    try {
      const deletedId = editingId
      const deletedIdx = vouchers.findIndex(v => v._id === deletedId)
      await axios.delete(`${BASE}/transactions/${deletedId}`, cfg())
      showMsg('Voucher deleted')
      await loadVouchers()
      // After reload, vouchers state is stale here — re-fetch locally to navigate
      const res = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type: voucherType, limit: 200 },
      })
      const remaining = sortVouchersByDocNo(
        (res.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
        voucherType
      )
      setVouchers(remaining)
      if (remaining.length === 0) {
        // No vouchers left — open a blank new form
        openCreate()
      } else {
        // Try to open the next record (same index), else the one before it
        const nextIdx = Math.min(deletedIdx, remaining.length - 1)
        openVoucher(remaining[Math.max(nextIdx, 0)])
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to delete voucher')
    }
  }

  // ─── open view/edit ──────────────────────────────────────────────────────────
  const openVoucher = (v) => {
    const m = v.voucherMeta || {}
    const resolvedParty = resolveVoucherParty(m.partyCode || '')
    const voucherCurrency = String(v.currency || 'USD').trim().toUpperCase()
    const isAedVoucher = voucherCurrency === 'AED'
    const voucherKind = String(v?.type || voucherType || '').trim().toLowerCase()
    const isReceiptPaymentVoucher = voucherKind === 'receipt' || voucherKind === 'payment'
    const headerRateSource = m.currRateSource || m.rateMeta?.headerRateSource || 'manual'
    const loadedRate = parseFloat(v.exchangeRate)
    const normalizedHeaderRate = backendRateToDisplayRate(loadedRate, voucherCurrency, isReceiptPaymentVoucher)
    const nextHeader = {
      branch: m.branch || '',
      partyCode: m.partyCode || '',
      partyName: m.partyName || '',
      currCode: voucherCurrency,
      currRate: normalizedHeaderRate.toFixed(6),
      currRateSource: isAedVoucher ? 'fixed_aed' : headerRateSource,
      vocDate: v.date ? v.date.slice(0, 10) : today(),
      vocNo: m.vocNo || '',
      salesman: m.salesman || '',
      docDate: m.docDate ? m.docDate.slice(0, 10) : (v.date ? v.date.slice(0, 10) : today()),
      valueDate: m.valueDate ? m.valueDate.slice(0, 10) : (v.date ? v.date.slice(0, 10) : today()),
      fixingType: normalizeVoucherFixingType(m.fixingType),
    }
    const nextPartyId = m.partyAccountId
      ? `account:${String(m.partyAccountId)}`
      : (resolvedParty?.partyId || findPartyOptionByCode(m.partyCode || '')?.id || '')
    const nextLineItems = (m.lineItems || []).map((line) => {
      const lineCurrency = String(line?.currCode || voucherCurrency || 'USD').trim().toUpperCase()
      const lineRateSource = line?.currRateSource || 'manual'
      const lineRate = parseFloat(line?.currRate)
      const normalizedLineRate = backendRateToDisplayRate(lineRate, lineCurrency, isReceiptPaymentVoucher)
      return {
        ...line,
        type: normalizeLineType(line.type),
        currCode: lineCurrency,
        currRate: normalizedLineRate.toFixed(6),
        currRateSource: (lineCurrency === 'AED' && isReceiptPaymentVoucher) ? 'fixed_aed' : lineRateSource,
      }
    })
    setEditingId(v._id)
    setHeader(nextHeader)
    setSelectedPartyId(nextPartyId)
    setLineItems(nextLineItems)
    setShowLineForm(false)
    setMenuTab('header')
    setWorkflowNote('')
    setError('')
    setMode('view')
    initialFormSnapshotRef.current = buildFormSnapshot(nextHeader, nextLineItems, nextPartyId)
  }

  const handleWorkflowAction = async (action) => {
    if (!editingId) return
    if ((action === 'return' || action === 'reject') && !workflowNote.trim()) {
      setError(action === 'return' ? 'Return reason is required' : 'Rejection reason is required')
      return
    }

    setSaving(true)
    clearError()
    try {
      const requestAction = async (confirmVendorAdvance = false) => axios.post(
        `${BASE}/transactions/${editingId}/${action}`,
        { comment: workflowNote, ...(confirmVendorAdvance ? { confirmVendorAdvance: true } : {}) },
        cfg()
      )

      try {
        await requestAction(false)
      } catch (e) {
        const needsAdvanceConfirmation = action === 'post'
          && e?.response?.status === 409
          && e?.response?.data?.code === 'VENDOR_ADVANCE_CONFIRMATION_REQUIRED'

        if (!needsAdvanceConfirmation) throw e
        if (!window.confirm(e.response?.data?.message || 'This payment will create a vendor advance. Continue?')) return
        await requestAction(true)
      }
      await loadVouchers()
      setWorkflowNote('')
      const actionLabel = action === 'submit'
        ? 'submitted'
        : action === 'approve'
          ? 'approved'
          : action === 'return'
            ? 'returned for edit'
            : action === 'reject'
              ? 'rejected'
              : 'posted'
      showMsg(`Voucher ${actionLabel} successfully`)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} voucher`)
    } finally {
      setSaving(false)
    }
  }

  const handleListWorkflowAction = async (voucher, action) => {
    if (!voucher?._id) return
    let comment = ''

    if (action === 'return' || action === 'reject') {
      const promptLabel = action === 'return' ? 'Return reason' : 'Rejection reason'
      const value = window.prompt(`${promptLabel} (required):`, '')
      if (value === null) return
      if (!String(value).trim()) {
        setError(`${promptLabel} is required`)
        return
      }
      comment = String(value).trim()
    }

    setSaving(true)
    clearError()
    try {
      const requestAction = async (confirmVendorAdvance = false) => axios.post(
        `${BASE}/transactions/${voucher._id}/${action}`,
        { comment, ...(confirmVendorAdvance ? { confirmVendorAdvance: true } : {}) },
        cfg()
      )

      try {
        await requestAction(false)
      } catch (e) {
        const needsAdvanceConfirmation = action === 'post'
          && e?.response?.status === 409
          && e?.response?.data?.code === 'VENDOR_ADVANCE_CONFIRMATION_REQUIRED'

        if (!needsAdvanceConfirmation) throw e
        if (!window.confirm(e.response?.data?.message || 'This payment will create a vendor advance. Continue?')) return
        await requestAction(true)
      }
      await loadVouchers()
      const actionLabel = action === 'submit'
        ? 'submitted'
        : action === 'approve'
          ? 'approved'
          : action === 'return'
            ? 'returned for edit'
            : action === 'reject'
              ? 'rejected'
              : 'posted'
      showMsg(`Voucher #${voucher.voucherMeta?.vocNo || '-'} ${actionLabel}`)
    } catch (e) {
      setError(e.response?.data?.message || `Failed to ${action} voucher`)
    } finally {
      setSaving(false)
    }
  }

  const handleVoidVoucher = async (voucher) => {
    if (!voucher?._id) return
    if (!window.confirm(`Void Receipt/Payment #${voucher.voucherMeta?.vocNo || '-'}? This will soft-delete linked ledger entries and keep an audit trail.`)) return
    const reason = window.prompt('Reason/comment for voiding this voucher (min 8 characters):', '')
    if (!reason || reason.trim().length < 8) {
      setError('Void reason/comment must be at least 8 characters.')
      return
    }
    const confirmToken = window.prompt('Destructive action confirmation token:', '')
    if (!confirmToken) {
      setError('Confirmation token is required to void a voucher.')
      return
    }
    setSaving(true)
    clearError()
    try {
      await axios.post(`${BASE}/transactions/${voucher._id}/void`, { reason: reason.trim(), confirmToken: confirmToken.trim() }, cfg())
      await loadVouchers()
      showMsg(`Voucher #${voucher.voucherMeta?.vocNo || '-'} voided with audit trail`)
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to void voucher')
    } finally {
      setSaving(false)
    }
  }

  const formatFxRevalueSummary = (result, applied = false) => {
    const tx = result?.transaction || {}
    const counts = result?.counts || {}
    const candidate = (result?.journals || []).find((row) => row.status === 'update' || row.status === 'updated')
    const prefix = applied ? 'Revalued' : 'Preview'

    if (!counts.updateCandidates && !counts.updatedCount) {
      return `${prefix}: voucher #${tx.vocNo || '-'} already matches reference-rate FX valuation.`
    }

    const rowSummary = candidate ? ` ${fmt(candidate.currentAmount)} -> ${fmt(candidate.correctedAmount)}` : ''
    return `${prefix}: voucher #${tx.vocNo || '-'} ${counts.updatedCount || counts.updateCandidates || 0} FX journal row(s), reference rate ${Number(tx.referenceRate || 0).toFixed(6)}.${rowSummary}`
  }

  const handleRevalueFxJournal = async (voucher) => {
    if (!voucher?._id) return

    setSaving(true)
    clearError()
    try {
      const previewRes = await axios.post(`${BASE}/transactions/${voucher._id}/revalue-fx-journal`, { apply: false }, cfg())
      const preview = previewRes.data || {}
      const tx = preview.transaction || {}
      const counts = preview.counts || {}
      const candidate = (preview.journals || []).find((row) => row.status === 'update')
      const confirmMessage = counts.updateCandidates
        ? [
            `Voucher #${tx.vocNo || '-'} FX preview`,
            `Direction: ${tx.expectedDirection || '-'}`,
            `Reference rate: ${Number(tx.referenceRate || 0).toFixed(6)}`,
            `Line rate: ${Number(tx.lineRate || 0).toFixed(6)}`,
            candidate ? `Journal amount: ${fmt(candidate.currentAmount)} -> ${fmt(candidate.correctedAmount)}` : '',
            'Apply revaluation now?',
          ].filter(Boolean).join('\n')
        : formatFxRevalueSummary(preview, false)

      if (!counts.updateCandidates) {
        showMsg(formatFxRevalueSummary(preview, false))
        return
      }

      if (!window.confirm(confirmMessage)) {
        showMsg(formatFxRevalueSummary(preview, false))
        return
      }

      const applyRes = await axios.post(`${BASE}/transactions/${voucher._id}/revalue-fx-journal`, { apply: true }, cfg())
      showMsg(formatFxRevalueSummary(applyRes.data, true))
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to revalue FX journal')
    } finally {
      setSaving(false)
    }
  }

  // ─── save voucher ────────────────────────────────────────────────────────────
  const saveVoucher = async () => {
    clearError()

    if (formReadOnly) {
      setError('Click Edit to unlock the voucher before saving changes')
      return
    }

    let effectiveLineItems = [...lineItems]
    if (showLineForm) {
      const hasLineAmount = Boolean(lineForm.amountLC || lineForm.amountFC || lineForm.totalAmount || lineForm.metalAmount)
      if ((!isMetalVoucher && !lineForm.acCode.trim()) || !hasLineAmount) {
        setError('Complete line details and click Save Line, or cancel the open line before saving voucher')
        return
      }
      const draftLine = {
        ...lineForm,
        type: normalizeLineType(lineForm.type),
        amountLC: lineForm.amountLC || lineForm.totalAmount || lineForm.metalAmount || '',
        amountWithVAT: lineForm.amountWithVAT || lineForm.amountLC || lineForm.amountFC,
      }
      if (editingLineIdx !== null) {
        effectiveLineItems = effectiveLineItems.map((l, i) => (i === editingLineIdx ? draftLine : l))
      } else {
        effectiveLineItems.push(draftLine)
      }
      setLineItems(effectiveLineItems)
      setShowLineForm(false)
      setEditingLineIdx(null)
    }

    if (!header.partyCode.trim()) { setError('Party Code is required'); return }
    if (!effectiveLineItems.length) { setError('Add at least one line item'); return }
    const resolvedParty = resolveVoucherParty(header.partyCode)
    const selectedAccount = findPartyOptionByCode(header.partyCode)
    if (!resolvedParty && !selectedAccount) {
      setError('Party Code must match an existing chart account')
      return
    }

    const normalizedVoucherType = String(voucherType || '').toLowerCase()
    const normalizedHeaderCurrency = String(header.currCode || baseCurrencyCode || 'USD').trim().toUpperCase()
    const isReceiptPayment = ['receipt', 'payment'].includes(normalizedVoucherType)
    const backendHeaderRate = displayRateToBackendRate(header.currRate, normalizedHeaderCurrency, isReceiptPayment)
    const requiresReferenceRate = isReceiptPayment && normalizedHeaderCurrency !== String(baseCurrencyCode || 'USD').trim().toUpperCase()
    if (requiresReferenceRate && (!Number.isFinite(backendHeaderRate) || backendHeaderRate <= 0)) {
      setError(`Reference exchange rate is required for ${normalizedVoucherType} transactions in ${normalizedHeaderCurrency}`)
      return
    }

    const payload = {
      type: voucherType,
      amount: totals.grandTotal || 0.01,
      date: header.valueDate || header.vocDate,
      description: `${voucherType} voucher ${header.vocNo || ''}`.trim(),
      currency: isReceiptPayment ? normalizedHeaderCurrency : baseCurrencyCode,
      exchangeRate: isReceiptPayment ? backendHeaderRate : 1,
      customerId: resolvedParty?.customerId || undefined,
      vendorId: resolvedParty?.vendorId || undefined,
      voucherMeta: {
        partyCode: header.partyCode,
        partyName: header.partyName || resolvedParty?.partyName || '',
        partyAccountId: selectedAccount?.accountId || '',
        salesman: header.salesman,
        vocNo: header.vocNo,
        docDate: header.docDate || null,
        valueDate: header.valueDate || null,
        currRateSource: header.currRateSource || 'manual',
        rateMeta: {
          headerRateSource: header.currRateSource || 'manual',
          goldPrice: Number(latestMetalRates.goldPrice || 0),
          goldPriceCurrency: String(latestMetalRates.priceCurrency || 'USD').trim().toUpperCase() || 'USD',
          goldPriceUpdatedAt: latestMetalRates.updatedAt || null,
        },
        ...(requiresReferenceRate ? { referenceExchangeRate: backendHeaderRate } : {}),
        ...(( voucherType === 'purchase' || voucherType === 'sale') ? { fixingType: normalizeVoucherFixingType(header.fixingType) } : {}),
        lineItems: effectiveLineItems.map(l => ({
          ...l,
          currRateSource: l.currRateSource || 'manual',
          amountFC: parseFloat(l.amountFC) || 0,
          amountLC: parseFloat(l.amountLC) || 0,
          headerAmt: parseFloat(l.headerAmt) || 0,
          currRate: displayRateToBackendRate(l.currRate, l.currCode || header.currCode, isReceiptPayment),
          ...(l.referenceRate ? { referenceRate: displayRateToBackendRate(l.referenceRate, l.currCode || header.currCode, isReceiptPayment) } : {}),
          vatPer: parseFloat(l.vatPer) || 0,
          vatAmountFC: parseFloat(l.vatAmountFC) || 0,
          vatAmountLC: parseFloat(l.vatAmountLC) || 0,
          amountWithVAT: parseFloat(l.amountWithVAT) || parseFloat(l.amountLC) || 0,
          headerAmountWithVAT: parseFloat(l.headerAmountWithVAT) || 0,
        })),
      },
      ...((voucherType === 'purchase' || voucherType === 'sale')
        ? { metalFixStatus: normalizeVoucherFixingType(header.fixingType) === 'non-fixing' ? 'unfixed' : 'fixed' }
        : {}),
    }
    const payloadLineTotal = effectiveLineItems.reduce((s, l) => s + (parseFloat(l.amountWithVAT) || parseFloat(l.amountLC) || 0), 0)
    payload.amount = payloadLineTotal || 0.01
    setSaving(true)
    try {
      let savedId = editingId
      if (editingId) {
        await axios.put(`${BASE}/transactions/${editingId}`, payload, cfg())
        showMsg('Voucher updated successfully')
      } else {
        const res = await axios.post(`${BASE}/transactions`, payload, cfg())
        savedId = res.data?.transaction?._id || null
        showMsg('Voucher saved successfully')
      }
      await loadVouchers()
      // After save, reload list then open the exact voucher that was saved
      const res2 = await axios.get(`${BASE}/transactions`, {
        ...cfg(),
        params: { type: voucherType, limit: 200 },
      })
      const refreshed = sortVouchersByDocNo(
        (res2.data.transactions || []).filter(t => t.voucherMeta && t.voucherMeta.vocNo),
        voucherType
      )
      setVouchers(refreshed)
      // Open the voucher that was just saved/updated
      const toOpen = savedId
        ? refreshed.find(t => t._id === savedId)
        : refreshed[refreshed.length - 1]
      if (toOpen) {
        openVoucher(toOpen)
      } else if (refreshed.length > 0) {
        openVoucher(refreshed[refreshed.length - 1])
      } else {
        setMode('list')
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Failed to save voucher')
    } finally {
      setSaving(false)
    }
  }

  const getLineNetAmount = (line) => {
    const withTax = parseFloat(line?.amountWithVAT)
    if (Number.isFinite(withTax) && withTax > 0) return withTax
    const lc = parseFloat(line?.amountLC)
    if (Number.isFinite(lc) && lc > 0) return lc
    const fc = parseFloat(line?.amountFC)
    if (Number.isFinite(fc) && fc > 0) return fc
    return 0
  }

  const buildReceiptPaymentDefaultLine = (baseLine) => {
    const rate = parseFloat(header.currRate) || 1
    return {
      ...baseLine,
      currCode: header.currCode || 'USD',
      currRate: String(rate.toFixed(6)),
      currRateSource: header.currRateSource || 'currency_table',
      vatType: baseLine.vatType || 'VAT',
      narration: header.narration || '',
      amountFC: '',
      amountLC: '',
      amountWithVAT: '',
    }
  }

  // ─── line form actions ───────────────────────────────────────────────────────
  const openAddLine = () => {
    setEditingLineIdx(null)
    const defaultType = 'Cash'
    const defaultAccountCode = pickDefaultAccountCodeByType(accounts, defaultType)
    const baseLine = {
      ...emptyLine(),
      currCode: header.currCode || 'USD',
      currRate: header.currRate || '1.000000',
      currRateSource: header.currRateSource || 'currency_table',
      type: defaultType,
      typeCode: defaultType.toUpperCase(),
      acCode: defaultAccountCode || '',
    }

    setLineForm(isMetalVoucher ? baseLine : buildReceiptPaymentDefaultLine(baseLine))
    setShowLineForm(true)
  }

  const openEditLine = (idx) => {
    setEditingLineIdx(idx)
    const normalizedType = normalizeLineType(lineItems[idx]?.type)
    setLineForm({
      ...lineItems[idx],
      type: normalizedType,
      typeCode: normalizedType.toUpperCase(),
      rateType: normalizeRateType(lineItems[idx]?.rateType),
      currRateSource: lineItems[idx]?.currRateSource || 'manual',
      vatType: lineItems[idx]?.vatType || 'VAT',
    })
    setShowLineForm(true)
  }

  const deleteLine = (idx) => setLineItems(prev => prev.filter((_, i) => i !== idx))

  const ensureEditableForLineActions = () => {
    if (isReadOnly) {
      setError('You have read-only access')
      return false
    }
    if (mode === 'view') {
      setMode('create')
      clearError()
      showMsg('Mode: EDIT')
    }
    return true
  }

  const handleAddLineClick = () => {
    if (!ensureEditableForLineActions()) return
    openAddLine()
  }

  const handleEditLineClick = (idx) => {
    if (!ensureEditableForLineActions()) return
    openEditLine(idx)
  }

  const handleDeleteLineClick = (idx) => {
    if (!ensureEditableForLineActions()) return
    deleteLine(idx)
  }

  const cancelLine = () => { setShowLineForm(false); setEditingLineIdx(null); clearError() }

  const saveLine = () => {
    if (!isMetalVoucher && !lineForm.acCode.trim()) { setError('A/C Code is required'); return }
    if (isMetalVoucher && !lineForm.stockCode.trim()) { setError('Stock Code is required for metal vouchers'); return }
    if (!lineForm.amountLC && !lineForm.amountFC && !lineForm.totalAmount && !lineForm.metalAmount) { setError('Amount is required'); return }
    const computedLineForm = isMetalVoucher ? applyLineAutoCalc(lineForm) : lineForm
    const line = {
      ...computedLineForm,
      type: normalizeLineType(computedLineForm.type),
      amountLC: computedLineForm.amountLC || computedLineForm.totalAmount || computedLineForm.metalAmount || '',
      amountWithVAT: computedLineForm.amountWithVAT || computedLineForm.amountLC || computedLineForm.amountFC,
    }
    if (editingLineIdx !== null) {
      setLineItems(prev => prev.map((l, i) => i === editingLineIdx ? line : l))
    } else {
      setLineItems(prev => [...prev, line])
    }
    setShowLineForm(false)
    setEditingLineIdx(null)
    clearError()
  }

  // When type changes to Cash, clear cheque fields
  const handleLineTypeChange = (val) => {
    const normalized = normalizeLineType(val)
    setLF('type', normalized)
    setLF('typeCode', normalized.toUpperCase())

    const suggestedAccountCode = pickDefaultAccountCodeByType(accounts, normalized)
    if (suggestedAccountCode) {
      setLF('acCode', suggestedAccountCode)
    }

    if (normalized === 'Cash') {
      setLF('chqNo', '')
      setLF('chqDate', '')
      setLF('chqBank', '')
    }
  }

  // Payment/Receipt: simple FC ↔ LC conversion via exchange rate — no VAT/tax.
  // UI convention is "1 USD = FC" for non-USD currencies (e.g. UZS 12048.1928).
  //   → LC = FC / rate, and FC = LC * rate
  const recalcReceiptPaymentLine = (baseLine, source) => {
    const next = { ...baseLine }
    const parseEditableNumber = (value) => {
      const raw = String(value ?? '').trim()
      if (!raw || raw === '.' || raw === '-' || raw === '-.') return null
      const num = Number.parseFloat(raw)
      return Number.isFinite(num) ? num : null
    }

    const rawRate = String(next.currRate ?? '')
    const rawAmountFC = String(next.amountFC ?? '')
    const rawAmountLC = String(next.amountLC ?? '')

    const parsedRate = parseEditableNumber(rawRate)
    const headerRate = parseEditableNumber(header.currRate)
    const rate = parsedRate ?? headerRate ?? 1

    const parsedAmountFC = parseEditableNumber(rawAmountFC)
    const parsedAmountLC = parseEditableNumber(rawAmountLC)

    let nextAmountFC = rawAmountFC
    let nextAmountLC = rawAmountLC

    if ((source === 'amountFC' || source === 'rate') && parsedAmountFC !== null) {
      const computedLC = rate > 0 ? parsedAmountFC / rate : 0
      nextAmountLC = Number.isFinite(computedLC) ? computedLC.toFixed(2) : nextAmountLC
    } else if (source === 'amountLC' && parsedAmountLC !== null) {
      const computedFC = parsedAmountLC * rate
      nextAmountFC = Number.isFinite(computedFC) ? computedFC.toFixed(2) : nextAmountFC
    }

    const amountLCForTotal = parseEditableNumber(nextAmountLC)

    return {
      ...next,
      amountFC: nextAmountFC,
      amountLC: nextAmountLC,
      vatPer: '',
      vatAmountFC: '',
      vatAmountLC: '',
      amountWithVAT: amountLCForTotal !== null ? amountLCForTotal.toFixed(2) : '',
    }
  }

  const handleAmountFC = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, amountFC: val }, 'amountFC'))
  }

  const handleAmountLC = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, amountLC: val }, 'amountLC'))
  }

  const handleCurrRateChange = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, currRate: val, currRateSource: 'manual' }, 'rate'))
  }

  const handleHeaderCurrRateChange = (val) => {
    const normalizedHeaderCurrency = String(header.currCode || 'USD').trim().toUpperCase()
    if (normalizedHeaderCurrency === 'USD') {
      setHeader((prev) => ({
        ...prev,
        currRate: '1.000000',
        currRateSource: 'base_currency',
      }))
      return
    }
    setHeader((prev) => ({
      ...prev,
      currRate: val,
      currRateSource: 'manual',
    }))
  }

  const handleHeaderCurrencyChange = (nextCode) => {
    const normalized = String(nextCode || 'USD').trim().toUpperCase()
    const resolved = resolvePaymentRate(normalized)
    setHeader((prev) => ({
      ...prev,
      currCode: normalized,
      currRate: resolved.rate.toFixed(6),
      currRateSource: resolved.source,
    }))

    // Keep payment/receipt line entry aligned with header currency unless user changes line currency again.
    if (!isMetalVoucher && ['payment', 'receipt'].includes(String(voucherType || '').toLowerCase())) {
      setLineForm((prev) => recalcReceiptPaymentLine({
        ...prev,
        currCode: normalized,
        currRate: resolved.rate.toFixed(6),
        currRateSource: resolved.source,
      }, 'rate'))
    }
  }

  const applyPartyCurrency = useCallback((resolvedParty) => {
    if (!resolvedParty) return
    if (!['payment', 'receipt'].includes(String(voucherType || '').toLowerCase())) return

    const preferredCode = String(resolvedParty.accountCurrency || '').trim().toUpperCase()
    if (!preferredCode) return

    const hasCurrency = currencyOptions.some((item) => item.code === preferredCode)
    if (!hasCurrency) return
    if (String(header.currCode || '').trim().toUpperCase() === preferredCode) return

    const resolved = resolvePaymentRate(preferredCode)
    setHeader((prev) => ({
      ...prev,
      currCode: preferredCode,
      currRate: resolved.rate.toFixed(6),
      currRateSource: resolved.source,
    }))
  }, [voucherType, currencyOptions, header.currCode, resolvePaymentRate])

  const handleLineCurrencyChange = (nextCode) => {
    const normalized = String(nextCode || 'USD').trim().toUpperCase()
    const resolved = resolvePaymentRate(normalized)
    if (isMetalVoucher) {
      setLF('currCode', normalized)
      return
    }
    setLineForm((prev) => recalcReceiptPaymentLine({ ...prev, currCode: normalized, currRate: resolved.rate.toFixed(6), currRateSource: resolved.source }, 'rate'))
  }

  const handleVatPerChange = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, vatPer: val }, 'vatPer'))
  }

  const handleVatAmountFCChange = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, vatAmountFC: val }, 'vatAmountFC'))
  }

  const handleVatAmountLCChange = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, vatAmountLC: val }, 'vatAmountLC'))
  }

  const handleAmountWithVATChange = (val) => {
    setLineForm(prev => recalcReceiptPaymentLine({ ...prev, amountWithVAT: val }, 'amountWithVAT'))
  }

  const handleLineAmountEnter = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    if (!showLineForm) return
    saveLine()
  }

  // Lookup party name from the relevant customer/vendor master record.
  const lookupParty = (code) => {
    const resolvedParty = resolveVoucherParty(code)
    const selectedAccount = findPartyOptionByCode(code)
    setSelectedPartyId(selectedAccount?.id || resolvedParty?.partyId || '')
    setHdr('partyName', resolvedParty?.partyName || selectedAccount?.partyName || '')
    applyPartyCurrency(resolvedParty)
  }

  const searchPartyByCode = () => {
    const lookupCode = String(header.partyCode || '').trim()
    if (!lookupCode) {
      setSelectedPartyId('')
      setHdr('partyName', '')
      return
    }
    lookupParty(lookupCode)
  }

  const handlePartyCodeEnter = (e) => {
    if (e.key !== 'Enter') return
    e.preventDefault()
    searchPartyByCode()
  }

  const handlePartySelect = (partyId) => {
    setSelectedPartyId(partyId)
    const selected = partyOptions.find((item) => item.id === partyId)
    if (!selected) {
      setHdr('partyCode', '')
      setHdr('partyName', '')
      return
    }
    setHdr('partyCode', selected.partyCode)
    setHdr('partyName', selected.partyName)
    applyPartyCurrency(resolveVoucherParty(selected.partyCode))
  }

  useEffect(() => {
    if (menuTab !== 'accounts') return
    const resolvedParty = resolveVoucherParty(header.partyCode)
    if (!resolvedParty) {
      setRecentPartyVouchers([])
      return
    }
    loadRecentPartyVouchers(resolvedParty)
  }, [menuTab, header.partyCode, resolveVoucherParty, loadRecentPartyVouchers])

  // ─── filtered list ───────────────────────────────────────────────────────────
  const filteredVouchers = selectedStatus
    ? vouchers.filter(v => v.status === selectedStatus)
    : vouchers
  const currentVoucher = editingId ? vouchers.find(v => v._id === editingId) : null
  const currentVoucherStatus = currentVoucher?.status || 'draft'
  const canDeleteCurrentVoucher = Boolean(editingId) && !isReadOnly && currentVoucherStatus !== 'posted'
  const canSubmitWorkflow = Boolean(editingId) && !isReadOnly && ['draft', 'returned', 'rejected'].includes(currentVoucherStatus)
  const canApproveWorkflow = Boolean(editingId) && (isSuperAdmin || isFinance) && currentVoucherStatus === 'submitted'
  const canReturnWorkflow = Boolean(editingId) && (isSuperAdmin || isFinance) && ['submitted', 'approved'].includes(currentVoucherStatus)
  const canRejectWorkflow = Boolean(editingId) && (isSuperAdmin || isFinance) && ['submitted', 'approved', 'returned'].includes(currentVoucherStatus)
  const canPostWorkflow = Boolean(editingId) && (isSuperAdmin || isFinance) && ['submitted', 'approved'].includes(currentVoucherStatus)
  const canRevalueCurrentVoucher = Boolean(editingId) && isSuperAdmin && ['payment', 'receipt'].includes(voucherType) && currentVoucherStatus === 'posted'

  // ─── guard ───────────────────────────────────────────────────────────────────
  if (!canView) {
    return (
      <div style={{ padding: '2rem', background: '#FEE2E2', borderRadius: '0.5rem', color: S.danger, textAlign: 'center' }}>
        You do not have permission to access the Vouchers module.
      </div>
    )
  }

  const voucherConfig = voucherConfigs[voucherType] || voucherConfigs.payment
  const isMetalVoucher = voucherType === 'purchase' || voucherType === 'sale'
  const voucherLabel = voucherConfig.label
  const voucherCode = voucherConfig.code
  const voucherLabelT = voucherConfig.short
  const lineTableHeaders = isMetalVoucher
    ? ['No.', 'Stock Code', 'PCS', 'Gr. Wt.', 'Purity', 'Pure Wt.', 'Rate Type', 'Metal Rate', 'Metal Amount', 'Total', '']
    : ['No.', 'A/C Code', 'Type', 'Curr', 'Amount FC', 'Amount LC', '']
  const branding = user?.branding || {}
  const tenant = user?.tenant || {}
  const activeTenantBranding = getTenantBranding(user?.company || tenant?.key || tenant?.name)
  const documentBranding = resolveDocumentBranding({ reportBranding, user, tenantBranding: activeTenantBranding })
  const voucher = {
    currency: header?.currCode || 'USD',
    partyName: header?.partyName || '',
    partyAccount: header?.partyCode || '',
  }
  const companyName = documentBranding.companyName || branding?.displayName || tenant?.name || activeTenantBranding?.displayName || ''
  const companyAddress = documentBranding.address || branding?.address || tenant?.address || activeTenantBranding?.address || ''
  const companyPhone = documentBranding.phone || branding?.phone || tenant?.phone || activeTenantBranding?.phone || ''
  const companyTrn = documentBranding.trn || branding?.trn || tenant?.trn || activeTenantBranding?.trn || ''
  const companyLogoImage = documentBranding.logoUrl || branding?.logoImage || tenant?.logoImage || activeTenantBranding?.logoImage || ''
  const companyLogoText = branding?.logoText || tenant?.logoText || activeTenantBranding?.logoText || ''
  const companyPrimaryColor = documentBranding.primaryColor || branding?.colors?.brandPrimary || tenant?.colors?.brandPrimary || activeTenantBranding?.colors?.brandPrimary || '#374151'
  const currencyLabel = voucher?.currency || 'USD'
  const payNoValue = header?.vocNo || ''
  const payDateValue = header?.docDate || ''
  const preparedByValue = user?.name || ''
  const trnValue = companyTrn || ''
  const phoneValue = companyPhone || ''
  const inventoryStockOptions = inventoryProducts
    .filter((item) => String(item.sku || '').trim())
    // Keep mapped inventory records only, so legacy records do not show duplicate-like stock choices.
    .filter((item) => String(item.category || '').includes('mainStock='))
    .map((item) => {
      const meta = decodeInventoryCategoryMeta(item.category)
      const mainStock = toTitle(meta.mainStock || meta.metalType || 'Metal')
      return {
        code: String(item.sku || '').trim().toUpperCase(),
        metal: String(meta.mainStock || meta.metalType || 'zzzz').toLowerCase(),
        label: mainStock,
      }
    })
    .sort((a, b) => {
      const byMetal = a.metal.localeCompare(b.metal)
      if (byMetal !== 0) return byMetal
      return a.code.localeCompare(b.code)
    })

  const numberToWords = (amount) => {
    if (!amount || isNaN(amount)) return ''
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen']
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
    const numToWord = (n) => {
      if (n === 0) return ''
      if (n < 20) return `${ones[n]} `
      if (n < 100) return `${tens[Math.floor(n / 10)]} ${ones[n % 10]} `
      if (n < 1000) return `${ones[Math.floor(n / 100)]} Hundred ${numToWord(n % 100)}`
      if (n < 1000000) return `${numToWord(Math.floor(n / 1000))}Thousand ${numToWord(n % 1000)}`
      if (n < 1000000000) return `${numToWord(Math.floor(n / 1000000))}Million ${numToWord(n % 1000000)}`
      return `${numToWord(Math.floor(n / 1000000000))}Billion ${numToWord(n % 1000000000)}`
    }
    const intPart = Math.floor(Math.abs(amount))
    const decPart = Math.round((Math.abs(amount) - intPart) * 100)
    let words = numToWord(intPart).trim()
    if (decPart > 0) words += ` and ${numToWord(decPart).trim()} Cents`
    return words.trim()
  }

  const printTitleByType = {
    payment: 'Payment Voucher',
    receipt: 'Receipt Voucher',
    purchase: 'Metal Purchase Voucher',
    sale: 'Metal Sale Voucher',
  }
  const printTitle = printTitleByType[voucherType] || voucherLabel
  const printMeta = [
    { label: 'Doc No', value: payNoValue },
    { label: 'Doc Date', value: payDateValue },
    { label: 'Value Date', value: header?.valueDate || payDateValue },
    { label: 'Prepared By', value: preparedByValue },
    ...(isMetalVoucher ? [{ label: 'Fixing', value: normalizeVoucherFixingType(header?.fixingType) }] : []),
  ]
  const printAmountLabel = `Amount (${currencyLabel || 'USD'})`
  const printPostingDirection = voucherType === 'receipt' || voucherType === 'sale' ? 'CREDITED' : 'DEBITED'
  const accountNameByCode = (code) => (accounts || []).find((a) => getAccountCodeValue(a) === String(code || '').trim())?.accountName || ''
  const tenantIdentity = [
    activeTenantBranding?.key,
    tenant?.key,
    tenant?.name,
    user?.company,
    documentBranding?.companyName,
    branding?.displayName,
  ].map((value) => String(value || '').trim().toLowerCase()).join(' ')
  const isModernGoldTenant = /\bmg\b/.test(tenantIdentity) || tenantIdentity.includes('modern gold')
  const isMgCurrencyVoucher = isModernGoldTenant && ['payment', 'receipt'].includes(voucherType)
  const mgPrintTitle = voucherType === 'receipt' ? 'RECEIPT CURRENCY' : 'CURRENCY PAYMENT'
  const mgBranch = header?.branch || effectiveLineItems?.find((line) => line?.branch)?.branch || 'HO'
  const mgLogoImage = '/logos/mg-logo.svg'
  const mgCompanyName = 'MODERN GOLD JEWELRY MANUFACTURING'
  const mgCompanyAddress = '242, Girvonbulok Street, Davlatabad District,\nNamangan City, Namangan Region,\nRepublic of Uzbekistan.'
  const mgLineItems = Array.isArray(effectiveLineItems) ? effectiveLineItems : []
  const mgPrimaryLine = mgLineItems[0] || {}
  const mgSelectedParty = findPartyOptionByCode(voucher?.partyAccount)
  const mgPartyAccountCode = String(voucher?.partyAccount || mgSelectedParty?.partyCode || '').trim()
  const mgPartyAccountName = String(voucher?.partyName || mgSelectedParty?.partyName || accountNameByCode(mgPartyAccountCode) || '').trim()
  const mgAccountDescription = () => {
    const joined = `${mgPartyAccountName}${mgPartyAccountCode ? ` ${mgPartyAccountCode}` : ''}`.trim()
    return joined || mgPartyAccountCode || mgPartyAccountName || ''
  }
  const mgAmountCurrencyName = {
    AED: 'United Arab Emirates Dirham',
    USD: 'United States Dollar',
    EUR: 'Euro',
    GBP: 'Pound Sterling',
    UZS: 'Uzbekistani Som',
  }[String(currencyLabel || '').toUpperCase()] || currencyLabel || ''
  const mgAmountWords = totals.grandTotal > 0
    ? `${numberToWords(totals.grandTotal)} ${mgAmountCurrencyName} Only`
    : ''

  // ────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────────────────────────────────
  return (
    <>
    <style>{`
      @media print {
        @page { size: A4 portrait; margin: 5mm; }
        .voucher-screen-only { display: none !important; }
        .voucher-print-only { display: block !important; }
        body * { visibility: hidden; }
        .voucher-print-only, .voucher-print-only * { visibility: visible; }
        .voucher-print-only { position: absolute; top: 0; left: 0; width: 100%; }
      }
    `}</style>
    <div className="voucher-screen-only" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* Notifications */}
      {error && (
        <div style={{ background: '#FEE2E2', color: S.danger, padding: '0.65rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.875rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{error}</span>
          <button onClick={clearError} style={{ background: 'none', border: 'none', color: S.danger, cursor: 'pointer', fontWeight: '700', fontSize: '1rem' }}>×</button>
        </div>
      )}
      {success && (
        <div style={{ background: '#D1FAE5', color: '#065F46', padding: '0.65rem 1rem', borderRadius: '0.4rem', marginBottom: '1rem', fontSize: '0.875rem' }}>
          {success}
        </div>
      )}

      {/* ── Voucher type switcher ── */}
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          style={tabBtn(voucherType === 'payment')}
          onClick={() => { setVoucherType('payment'); openLastOrCreate('payment') }}
        >
          💳 {t('paymentVoucher')}
        </button>
        <button
          style={tabBtn(voucherType === 'receipt')}
          onClick={() => { setVoucherType('receipt'); openLastOrCreate('receipt') }}
        >
          🧾 {t('receiptVoucher')}
        </button>
        <button
          style={tabBtn(voucherType === 'purchase')}
          onClick={() => { setVoucherType('purchase'); openLastOrCreate('purchase') }}
        >
          🟫 Metal Purchase
        </button>
        <button
          style={tabBtn(voucherType === 'sale')}
          onClick={() => { setVoucherType('sale'); openLastOrCreate('sale') }}
        >
          🟨 Metal Sale
        </button>
        {mode !== 'list' && (
          <button style={btn('secondary')} onClick={() => setMode('list')}>
            ← Back to List
          </button>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════ LIST MODE */}
      {mode === 'list' && (
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: S.ink }}>
              {voucherLabel} — List
            </h3>
            <select
              value={selectedStatus}
              onChange={e => setSelectedStatus(e.target.value)}
              style={{ ...inputStyle, width: '140px' }}
            >
              <option value="">{t('all')} {t('status')}</option>
              <option value="draft">{t('statusDraft')}</option>
              <option value="submitted">{t('statusSubmitted')}</option>
              <option value="approved">{t('statusApproved')}</option>
              <option value="posted">{t('statusPosted')}</option>
              <option value="returned">{t('statusReturned')}</option>
              <option value="rejected">{t('statusRejected')}</option>
            </select>
            <button style={btn('gray')} onClick={loadVouchers}>↺ Refresh</button>
            {canCreate && (
              <button style={{ ...btn('primary'), marginLeft: 'auto' }} onClick={() => openCreate()}>+ New</button>
            )}
          </div>

          {loadingList ? (
            <p style={{ color: S.muted }}>{t('loading')}</p>
          ) : filteredVouchers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: S.muted, border: `2px dashed ${S.border}`, borderRadius: '0.5rem' }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
              <p>No {voucherLabel.toLowerCase()}s found.</p>
              {canCreate && (
                <button style={{ ...btn('primary'), marginTop: '1rem' }} onClick={() => openCreate()}>
                  + New {voucherLabel}
                </button>
              )}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ background: S.headerBg }}>
                    {['Doc No', 'Doc Date', 'Value Date', 'Party Code', 'Party Name', ...((voucherType === 'purchase' || voucherType === 'sale') ? ['Fixing'] : []), 'Currency', 'Grand Total', 'Status', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '0.6rem 0.75rem', textAlign: 'left', fontWeight: '700', color: S.ink, borderBottom: `2px solid ${S.border}`, whiteSpace: 'nowrap' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredVouchers.map((v, i) => {
                    const m = v.voucherMeta || {}
                    const grand = (m.lineItems || []).reduce((s, l) => s + (l.amountWithVAT || l.amountLC || 0), 0)
                    const statusColors = {
                      draft: { bg: '#FEF3C7', color: '#92400E' },
                      submitted: { bg: '#DBEAFE', color: '#1D4ED8' },
                      approved: { bg: '#DCFCE7', color: '#166534' },
                      posted: { bg: '#D1FAE5', color: '#065F46' },
                      returned: { bg: '#FCE7F3', color: '#9D174D' },
                      rejected: { bg: '#FEE2E2', color: '#B91C1C' },
                    }
                    const sc = statusColors[v.status] || { bg: '#F3F4F6', color: '#374151' }
                    const fixingDisplay = m.fixingType === 'non-fixing' ? 'Unfixed' : 'Fixed'
                    return (
                      <tr key={v._id} style={{ background: i % 2 === 0 ? S.white : S.bg, borderBottom: `1px solid ${S.border}` }}>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: '700', color: S.green }}>{m.vocNo}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>{m.docDate ? String(m.docDate).slice(0, 10) : (v.date ? v.date.slice(0, 10) : '-')}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>{m.valueDate ? String(m.valueDate).slice(0, 10) : (v.date ? v.date.slice(0, 10) : '-')}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>{m.partyCode || '-'}</td>
                        <td style={{ padding: '0.55rem 0.75rem', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.partyName || '-'}</td>
                        {(voucherType === 'purchase' || voucherType === 'sale') && (
                          <td style={{ padding: '0.55rem 0.75rem' }}>
                            <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', background: fixingDisplay === 'Unfixed' ? '#FEE2E2' : '#DCFCE7', color: fixingDisplay === 'Unfixed' ? '#B91C1C' : '#166534' }}>
                              {fixingDisplay}
                            </span>
                          </td>
                        )}
                        
                        <td style={{ padding: '0.55rem 0.75rem' }}>{v.currency}</td>
                        <td style={{ padding: '0.55rem 0.75rem', fontWeight: '700', textAlign: 'right' }}>{fmt(grand)}</td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>
                          <span style={{ padding: '0.2rem 0.5rem', borderRadius: '9999px', fontSize: '0.75rem', fontWeight: '700', background: sc.bg, color: sc.color }}>
                            {v.status}
                          </span>
                        </td>
                        <td style={{ padding: '0.55rem 0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                            <button style={{ ...btn('secondary'), padding: '0.25rem 0.6rem', fontSize: '0.78rem' }} onClick={() => openVoucher(v)}>
                              {isReadOnly ? 'View' : 'Open'}
                            </button>
                            {!isReadOnly && ['draft', 'returned', 'rejected'].includes(v.status) && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleListWorkflowAction(v, 'submit')}
                                style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#F59E0B', color: '#111827' }}
                              >
                                {t('submit')}
                              </button>
                            )}
                            {(isSuperAdmin || isFinance) && v.status === 'submitted' && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleListWorkflowAction(v, 'approve')}
                                style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#0EA5E9', color: '#FFFFFF' }}
                              >
                                {t('approve')}
                              </button>
                            )}
                            {(isSuperAdmin || isFinance) && ['submitted', 'approved'].includes(v.status) && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleListWorkflowAction(v, 'return')}
                                style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#F472B6', color: '#831843' }}
                              >
                                {t('returnForEdit')}
                              </button>
                            )}
                            {(isSuperAdmin || isFinance) && ['submitted', 'approved', 'returned'].includes(v.status) && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleListWorkflowAction(v, 'reject')}
                                style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#FEE2E2', color: '#B91C1C' }}
                              >
                                {t('reject')}
                              </button>
                            )}
                            {(isSuperAdmin || isFinance) && ['submitted', 'approved'].includes(v.status) && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleListWorkflowAction(v, 'post')}
                                style={{ ...btn('primary'), padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                              >
                                {t('post')}
                              </button>
                            )}
                            {(isSuperAdmin || isFinance) && v.status === 'posted' && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleVoidVoucher(v)}
                                style={{ ...btn('danger'), padding: '0.25rem 0.6rem', fontSize: '0.78rem' }}
                              >
                                Void
                              </button>
                            )}
                            {isSuperAdmin && ['receipt', 'payment'].includes(String(v.type || voucherType).toLowerCase()) && v.status === 'posted' && (
                              <button
                                type="button"
                                disabled={saving}
                                onClick={() => handleRevalueFxJournal(v)}
                                style={{ ...btn('gray'), padding: '0.25rem 0.6rem', fontSize: '0.78rem', background: '#E0F2FE', color: '#0C4A6E' }}
                              >
                                Revalue FX
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p style={{ marginTop: '0.5rem', color: S.muted, fontSize: '0.8rem' }}>{filteredVouchers.length} voucher(s)</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════ CREATE / VIEW MODE */}
      {(mode === 'create' || mode === 'view') && (
        <div
          style={(mode === 'create' || mode === 'view')
            ? {
                position: 'fixed',
                inset: 0,
                background: 'rgba(15, 23, 42, 0.45)',
                zIndex: 1200,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
              }
            : undefined}
          onClick={(mode === 'create' || mode === 'view') ? handleVoucherModalBackdropClick : undefined}
        >
          <div
            style={(mode === 'create' || mode === 'view')
              ? {
                  width: isMetalVoucher ? 'min(1160px, 96vw)' : 'min(1180px, 96vw)',
                  maxHeight: '92vh',
                  overflowY: 'auto',
                  background: isMetalVoucher ? '#E3E6EB' : S.white,
                  borderRadius: '0.7rem',
                  border: isMetalVoucher ? metalWin.shell.border : '2px solid #4F73AB',
                  boxShadow: '0 16px 32px rgba(15, 23, 42, 0.48), inset 0 1px 0 rgba(255,255,255,0.2)',
                  padding: '0',
                  transform: `translate(${modalOffset.x}px, ${modalOffset.y}px)`,
                }
              : undefined}
            onClick={(mode === 'create' || mode === 'view') ? (e) => e.stopPropagation() : undefined}
          >
          {/* ── Top title bar ── */}
          {/* ── ERP-style Title Bar (draggable) ── */}
          <div
            style={{
              background: 'var(--grad-brand)',
              color: '#fff',
              padding: '4px 8px 5px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(0,0,0,0.15)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)',
              borderRadius: '0.5rem 0.5rem 0 0',
              marginBottom: 0,
              flexShrink: 0,
              cursor: mode === 'create' ? (modalDrag ? 'grabbing' : 'grab') : 'default',
              userSelect: mode === 'create' ? 'none' : 'auto',
            }}
            onMouseDown={mode === 'create' ? handleModalHeaderMouseDown : undefined}
          >
            <div style={{ width: 60 }} />
            <span style={{ fontSize: 13, fontWeight: 700, flex: 1, textAlign: 'center', letterSpacing: '.2px', textShadow: '0 1px 0 rgba(0,0,0,0.28)' }}>
              {voucherLabelT}{header.vocNo ? ` — #${header.vocNo}` : ''}
            </span>
            <div style={{ display: 'flex', gap: 2 }}>
              {['─', '□'].map((ch) => (
                <button key={ch} type="button" style={{ width: 18, height: 15, background: 'linear-gradient(180deg,#D8DCE3,#A9B2C1)', border: '1px solid #6F7B8B', borderTop: '1px solid #EFF3F8', borderLeft: '1px solid #E5EAF1', borderRadius: 2, cursor: 'pointer', fontSize: 9, color: '#1F2937', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }}>{ch}</button>
              ))}
              <button
                type="button"
                title="Close"
                onMouseDown={(e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  e.stopPropagation()
                  handleExitVoucherForm()
                }}
                onClick={(e) => {
                  e.preventDefault()
                }}
                style={{ width: 18, height: 15, background: 'linear-gradient(180deg,#E3D8D8,#C4A0A0)', border: '1px solid #8A6F6F', borderTop: '1px solid #F4E9E9', borderLeft: '1px solid #EFDDDD', borderRadius: 2, cursor: 'pointer', fontSize: 9, color: '#3F1D1D', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.7)' }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* ── ERP Classic Toolbar ── */}
          {(() => {
            const compactMetalTb = false
            const tbS = {
              minWidth: compactMetalTb ? 24 : 68,
              width: compactMetalTb ? 24 : undefined,
              height: compactMetalTb ? 22 : 24,
              background: 'linear-gradient(180deg,#FBFBFB 0%,#E5E5E5 48%,#CACACA 100%)',
              border: '1px solid #A9A9A9',
              borderTop: '1px solid #F8F8F8',
              borderLeft: '1px solid #ECECEC',
              borderRadius: 2,
              cursor: 'pointer',
              fontSize: compactMetalTb ? 10 : 10.5,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 0 rgba(255,255,255,0.9) inset, 1px 1px 1px rgba(0,0,0,0.22)',
              color: '#222',
              padding: compactMetalTb ? 0 : '0 7px',
              flexShrink: 0,
              whiteSpace: compactMetalTb ? 'normal' : 'nowrap',
            }
            const TbBtn = ({ tip, label, icon, onClick, style: extra = {}, disabled = false }) => (
              <button
                type="button"
                title={tip}
                onMouseDown={disabled ? undefined : (e) => {
                  if (e.button !== 0) return
                  e.preventDefault()
                  e.stopPropagation()
                  runToolbarAction(label || tip || 'Action', () => onClick?.(e))
                }}
                onClick={(e) => {
                  e.preventDefault()
                }}
                disabled={disabled}
                style={{ ...tbS, ...extra, ...(disabled ? { opacity: 0.35, cursor: 'default', pointerEvents: 'none' } : { pointerEvents: 'auto' }) }}
              >
                {compactMetalTb ? icon : label}
              </button>
            )
            const Sep = () => <div style={{ width: 1, height: 20, background: '#b0b0b0', margin: '0 3px', flexShrink: 0 }} />
            const curIdx = vouchers.findIndex(v => v._id === editingId)
            return (
              <div style={{
                background: isMetalVoucher
                  ? 'linear-gradient(180deg,#F0F0F0,#D7D7D7)'
                  : 'linear-gradient(180deg,#F0F0F0,#D7D7D7)',
                borderBottom: isMetalVoucher ? '2px solid #9C9C9C' : '2px solid #9C9C9C',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.85)',
                padding: '3px 6px',
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                flexWrap: 'nowrap',
                overflowX: 'auto',
                marginBottom: '0.6rem',
              }}>
                <TbBtn tip="New — opens a blank form to enter a new voucher" label="New" onClick={() => openCreate()} disabled={!canCreate} />
                <TbBtn tip="Edit — unlocks the current record for modification" label="Edit" onClick={handleEditUnlock} disabled={isReadOnly || (!editingId && mode !== 'create')} />
                <TbBtn tip="Delete — removes the current voucher" label="Delete" onClick={handleDeleteVoucher} style={{ color: '#b00020' }} disabled={isReadOnly || (Boolean(editingId) && !canDeleteCurrentVoucher)} />
                <TbBtn tip="Save — saves your data permanently" label="Save" onClick={saveVoucher} style={{ color: '#065f46' }} disabled={formReadOnly} />
                <TbBtn tip="Cancel — discards unsaved changes" label="Cancel" onClick={handleCancelChanges} />
                <Sep />
                <TbBtn tip="|◀ First — jumps to the very first voucher on record" label="|◀ First" icon="⏮" onClick={navFirst} disabled={curIdx <= 0} />
                <TbBtn tip="◀ Previous — goes one record back" label="◀ Previous" icon="◀" onClick={navPrev} disabled={curIdx <= 0} />
                <TbBtn tip="▶ Next — goes one record forward" label="▶ Next" icon="▶" onClick={navNext} disabled={curIdx < 0 || curIdx >= vouchers.length - 1} />
                <TbBtn tip="▶| Last — jumps to the most recent voucher" label="▶| Last" icon="⏭" onClick={navLast} disabled={curIdx < 0 || curIdx >= vouchers.length - 1} />
                <Sep />
                <TbBtn tip="Print/Preview — prints or previews the current invoice" label="Print/Preview" onClick={() => window.print()} />
                <TbBtn tip="Search/Find — search by voucher number, party, or date" label="Search/Find" onClick={handleSearchFind} />
                <TbBtn tip="Barcode — scan or view an item barcode linked to stock" label="Barcode" onClick={handleBarcodeAction} />
                <TbBtn tip="Refresh Parties — reload customer and vendor list" label="↺ Parties" onClick={refreshParties} />
                <Sep />
                <TbBtn tip="Exit — closes the voucher form and returns to the main menu" label="Exit" icon="■" onClick={handleExitVoucherForm} style={{ color: '#b00020' }} />
                <div style={{ flex: 1 }} />
              </div>
            )
          })()}

          {/* ── Body padding wrapper ── */}
          <div style={isMetalVoucher ? metalWin.body : { padding: '0.75rem 0.9rem' }}>

          {/* ── Voucher section menu ── */}
          <div style={{ display: 'flex', gap: '0.35rem', marginBottom: '0', flexWrap: 'wrap', alignItems: 'flex-end', padding: '0 0.15rem', borderBottom: '1px solid #BFC5CB' }}>
            <button style={tabBtn(menuTab === 'header')} onClick={() => setMenuTab('header')}>
              {isMetalVoucher ? 'Stock Details' : 'Header Details'}
            </button>
            <button style={tabBtn(menuTab === 'attachments')} onClick={() => setMenuTab('attachments')}>
              {isMetalVoucher ? 'Other Charges' : t('attachments')}
            </button>
          </div>

          {/* ── Header Details ── */}
          {menuTab === 'header' && (
            <div style={sectionBox}>
              <div style={sectionBody}>
                {isMetalVoucher && (
                  <div style={metalTopInlineRow}>
                    <div style={metalTopField}>
                      <label style={classicLabel}>Party Account</label>
                      <AccountCombobox
                        groups={partyComboGroups}
                        value={selectedPartyId}
                        onChange={(val) => handlePartySelect(val)}
                        placeholder="Type account name or code…"
                        style={formReadOnly ? classicReadInput : classicInput}
                        disabled={formReadOnly}
                      />
                    </div>
                  </div>
                )}
                <div style={classicHeaderShell}>
                  <div style={classicHeaderGrid}>
                    <div style={{ ...classicPanel, flex: '0 1 640px', minWidth: '320px' }}>
                      <div style={classicPanelTitle}>Party Details</div>
                      <div style={classicPartyGrid}>
                        {!isMetalVoucher && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            <label style={classicLabel}>Party Account</label>
                            <AccountCombobox
                              groups={partyComboGroups}
                              value={selectedPartyId}
                              onChange={(val) => handlePartySelect(val)}
                              placeholder="Type account name or code…"
                              style={formReadOnly ? classicReadInput : classicInput}
                              disabled={formReadOnly}
                            />
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                          <label style={classicLabel}>Party Code</label>
                          <input
                            style={formReadOnly ? classicReadInput : classicInput}
                            value={header.partyCode}
                            onChange={e => setHdr('partyCode', e.target.value)}
                            onKeyDown={handlePartyCodeEnter}
                            placeholder={voucherConfig.partyPlaceholder}
                            readOnly={formReadOnly}
                          />
                        </div>
                      </div>
                      {(() => {
                        const resolvedParty = resolveVoucherParty(header.partyCode)
                        const partyCardTitle = resolvedParty?.partyType === 'vendor'
                          ? 'Vendor Details'
                          : resolvedParty?.partyType === 'customer'
                            ? 'Customer Details'
                            : 'Party Details'
                        const partyDisplayName = resolvedParty?.partyName || header.partyName || 'No party selected'
                        const partyEmail = resolvedParty?.email || '—'
                        const partyPhone = resolvedParty?.phone || '—'
                        const partyAddress = resolvedParty?.address || '—'

                        return (
                          <div style={classicPartyCard}>
                            <div style={classicPartyCardHeader}>
                              <div style={classicPartyCardTitle}>{partyCardTitle}</div>
                              <div style={classicPartyCardCodeWrap}>
                                <div style={classicPartyCardCode}>
                                  <input
                                    style={classicPartyCardCodeInput}
                                    value={header.partyCode}
                                    onChange={e => setHdr('partyCode', e.target.value)}
                                    onKeyDown={handlePartyCodeEnter}
                                    placeholder="Code"
                                    readOnly={formReadOnly}
                                  />
                                </div>
                                <button
                                  type="button"
                                  style={classicPartyCardSearch}
                                  onClick={searchPartyByCode}
                                  disabled={formReadOnly}
                                  title="Search party by code"
                                >
                                  ⌕
                                </button>
                              </div>
                            </div>
                            <div style={classicPartyCardName}>{partyDisplayName}</div>
                            <div style={classicPartyCardBody}>
                              <div style={classicPartyCardField}>
                                <span style={classicPartyCardFieldLabel}>Email</span>
                                <span style={classicPartyCardFieldValue}>{partyEmail}</span>
                              </div>
                              <div style={classicPartyCardField}>
                                <span style={classicPartyCardFieldLabel}>Phone</span>
                                <span style={classicPartyCardFieldValue}>{partyPhone}</span>
                              </div>
                              <div style={{ ...classicPartyCardField, gridColumn: '1 / -1' }}>
                                <span style={classicPartyCardFieldLabel}>Address</span>
                                <span style={classicPartyCardFieldValue}>{partyAddress}</span>
                              </div>
                            </div>
                          </div>
                        )
                      })()}
                    </div>

                    <div style={{ ...classicPanel, flex: '0 1 430px', minWidth: '300px' }}>
                      <div style={classicRightGrid}>
                        <label style={classicLabel}>Doc No :</label>
                        <input
                          style={formReadOnly ? classicReadInput : classicInput}
                          value={header.vocNo}
                          onChange={e => setHdr('vocNo', e.target.value)}
                          readOnly={formReadOnly}
                        />

                        {(voucherType === 'purchase' || voucherType === 'sale') ? (
                          <>
                            <label style={classicLabel}>Fixing Type :</label>
                            <select
                              style={formReadOnly ? classicReadInput : classicInput}
                              value={header.fixingType}
                              onChange={e => setHdr('fixingType', e.target.value)}
                              disabled={formReadOnly}
                            >
                              <option value="fixing">Fixed</option>
                              <option value="non-fixing">UnFixed</option>
                            </select>
                          </>
                        ) : (
                          <>
                            <label style={classicLabel}>Voc Type :</label>
                            <input style={classicReadInput} value={voucherCode} readOnly />
                          </>
                        )}

                        <label style={classicLabel}>Doc Date :</label>
                        <input
                          style={formReadOnly ? classicReadInput : classicInput}
                          type="date"
                          value={header.docDate}
                          onChange={e => setHdr('docDate', e.target.value)}
                          readOnly={formReadOnly}
                        />

                        <label style={classicLabel}>Value Date :</label>
                        <input
                          style={formReadOnly ? classicReadInput : classicInput}
                          type="date"
                          value={header.valueDate}
                          onChange={e => setHdr('valueDate', e.target.value)}
                          readOnly={formReadOnly}
                        />

                        <label style={classicLabel}>Curr. Code :</label>
                        <select
                          style={formReadOnly ? classicReadInput : classicInput}
                          value={header.currCode}
                          onChange={e => handleHeaderCurrencyChange(e.target.value)}
                          disabled={formReadOnly}
                        >
                          {currencyOptions.length === 0 ? (
                            <option value="USD">USD</option>
                          ) : currencyOptions.map((item) => (
                            <option key={item.code} value={item.code}>
                              {item.code}{item.name ? ` - ${item.name}` : ''}{item.isActive ? '' : ' (Inactive)'}
                            </option>
                          ))}
                        </select>

                        <label style={classicLabel}>Curr. Rate :</label>
                        <input
                          style={formReadOnly ? classicReadInput : classicInput}
                          value={header.currRate}
                          onChange={e => handleHeaderCurrRateChange(e.target.value)}
                          type="number"
                          step="0.000001"
                          title="AED auto-default: 3.674 (you can edit manually)"
                          readOnly={formReadOnly}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Account Details tab ── */}
          {false && (
            <div style={sectionBox}>
              <div style={sectionBody}>
                <div style={{ marginBottom: '0.85rem', border: `1px solid ${S.border}`, borderRadius: '0.45rem', padding: '0.6rem 0.7rem', background: '#FAFAFA' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', marginBottom: '0.45rem' }}>
                    <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: '700', color: S.ink }}>
                      Recent {voucherLabel} (Last 5)
                    </p>
                    {loadingRecentPartyVouchers && <span style={{ fontSize: '0.75rem', color: S.muted }}>Loading...</span>}
                  </div>
                  {!recentPartyVouchers.length ? (
                    <p style={{ margin: 0, fontSize: '0.8rem', color: S.muted }}>
                      No recent vouchers found for this account.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                        <thead>
                          <tr style={{ background: S.headerBg }}>
                            {['Doc No', 'Date', 'Type', 'Amount', 'Status'].map((headerCell) => (
                              <th key={headerCell} style={{ padding: '0.38rem 0.5rem', textAlign: headerCell === 'Amount' ? 'right' : 'left', borderBottom: `1px solid ${S.border}`, color: S.ink }}>{headerCell}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {recentPartyVouchers.map((item, idx) => (
                            <tr key={item.id} style={{ background: idx % 2 === 0 ? S.white : S.bg, borderBottom: `1px solid ${S.border}` }}>
                              <td style={{ padding: '0.35rem 0.5rem', fontWeight: '700', color: S.green }}>{item.vocNo}</td>
                              <td style={{ padding: '0.35rem 0.5rem' }}>{item.date}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textTransform: 'capitalize' }}>{item.type}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textAlign: 'right', fontWeight: '700' }}>{item.currency} {fmt(item.amount)}</td>
                              <td style={{ padding: '0.35rem 0.5rem', textTransform: 'capitalize' }}>{item.status}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {lineItems.length === 0 ? (
                  <p style={{ color: S.muted, fontSize: '0.875rem' }}>No line items added yet. Switch to Line Items tab to add entries.</p>
                ) : (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ background: S.headerBg }}>
                        {(isMetalVoucher
                          ? ['Stock Code', 'PCS', 'Gross Wt.', 'Purity', 'Pure Wt.', 'Rate Type', 'Metal Rate', 'Metal Amount', 'Total', 'Narration']
                          : ['A/C Code', 'Type', 'Currency', 'Amount FC', 'Amount LC', 'Narration']
                        ).map(h => (
                          <th key={h} style={{ padding: '0.5rem 0.75rem', textAlign: 'left', fontWeight: '700', color: S.ink, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((l, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${S.border}`, background: i % 2 === 0 ? S.white : S.bg }}>
                          {isMetalVoucher ? (
                            <>
                              <td style={{ padding: '0.5rem 0.75rem', fontWeight: '600' }}>{l.stockCode || '-'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{l.pcs || '-'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{l.grossWeight || '-'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{l.purity || '-'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{l.pureWeight || '-'}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.rateType || '-'}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(parseFloat(l.metalRate) || ((parseFloat(l.weightInOz) || 0) > 0 ? ((parseFloat(l.metalAmount) || 0) / (parseFloat(l.weightInOz) || 0)) : 0))}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.metalAmount)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right', fontWeight: '700' }}>{fmt(l.totalAmount || l.amountLC)}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.narration || l.remarks || '-'}</td>
                            </>
                          ) : (
                            <>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.acCode}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.type}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.currCode}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.amountFC)}</td>
                              <td style={{ padding: '0.5rem 0.75rem', textAlign: 'right' }}>{fmt(l.amountLC)}</td>
                              <td style={{ padding: '0.5rem 0.75rem' }}>{l.narration}</td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ── Line Items panel ── */}
          {(menuTab === 'header' || menuTab === 'lineItems') && (
            <div style={sectionBox}>
              <div style={{ ...(isMetalVoucher ? { ...classicPanelTitle, ...metalWin.tabLabel } : classicPanelTitle), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{isMetalVoucher ? 'Stock Details' : 'LINE ITEMS'}</span>
              </div>

              {/* Line items table */}
              <div style={{ overflowX: 'auto', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #C9CED6', background: '#FFFFFF' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                  <thead>
                    <tr style={isMetalVoucher ? metalWin.headerRow : { background: 'linear-gradient(180deg, #F8F9FB 0%, #E7EAF0 100%)' }}>
                      {lineTableHeaders.map(h => (
                        <th key={h} style={{ padding: '0.34rem 0.48rem', textAlign: ['Amount FC', 'Amount LC', 'Metal Rate', 'Metal Amount', 'Total', 'PCS', 'Gr. Wt.', 'Purity', 'Pure Wt.'].includes(h) ? 'right' : 'left', fontWeight: '700', color: isMetalVoucher ? '#374151' : '#374151', borderBottom: isMetalVoucher ? '1px solid #C9CED6' : '1px solid #C9CED6', borderRight: isMetalVoucher ? '1px solid #E5E7EB' : '1px solid #E5E7EB', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.length === 0 ? (
                      <tr>
                        <td colSpan={lineTableHeaders.length} style={{ padding: '1rem', textAlign: 'center', color: S.muted, borderBottom: '1px solid #D7DBE0' }}>
                          {formReadOnly ? 'No line items.' : 'Click "Add" below to add entries.'}
                        </td>
                      </tr>
                    ) : lineItems.map((l, i) => (
                      <tr key={i} style={{ background: i % 2 === 0 ? '#FFFFFF' : '#FBFBFC', borderBottom: isMetalVoucher ? metalWin.tableCell.borderBottom : '1px solid #D7DBE0' }}>
                        <td style={{ padding: '0.28rem 0.48rem', borderRight: isMetalVoucher ? metalWin.tableCell.borderRight : '1px solid #EEF1F4', background: isMetalVoucher ? metalWin.tableCell.background : undefined }}>{i + 1}</td>
                        {isMetalVoucher ? (
                          <>
                            <td style={{ padding: '0.28rem 0.48rem', fontWeight: '600', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.stockCode || '-'}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.pcs || '-'}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.grossWeight || '-'}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.purity || '-'}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.pureWeight || '-'}</td>
                            <td style={{ padding: '0.28rem 0.48rem', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{l.rateType || '-'}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{fmt(parseFloat(l.metalRate) || ((parseFloat(l.weightInOz) || 0) > 0 ? ((parseFloat(l.metalAmount) || 0) / (parseFloat(l.weightInOz) || 0)) : 0))}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{fmt(l.metalAmount)}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', fontWeight: '700', borderRight: metalWin.tableCell.borderRight, background: metalWin.tableCell.background }}>{fmt(l.totalAmount || l.amountLC)}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: '0.28rem 0.48rem', fontWeight: '600', borderRight: '1px solid #EEF1F4' }}>{l.acCode}</td>
                            <td style={{ padding: '0.28rem 0.48rem', borderRight: '1px solid #EEF1F4' }}>
                              <span style={{ padding: '0.08rem 0.28rem', borderRadius: '0.2rem', fontSize: '0.68rem', fontWeight: '700', background: normalizeLineType(l.type) === 'Cash' ? '#D1FAE5' : normalizeLineType(l.type) === 'Cheque' || normalizeLineType(l.type) === 'TT' ? '#DBEAFE' : '#FEF3C7', color: normalizeLineType(l.type) === 'Cash' ? '#065F46' : normalizeLineType(l.type) === 'Cheque' || normalizeLineType(l.type) === 'TT' ? '#1D4ED8' : '#92400E' }}>
                                {normalizeLineType(l.type) === 'TT' ? 'TT' : normalizeLineType(l.type)}
                              </span>
                            </td>
                            <td style={{ padding: '0.28rem 0.48rem', borderRight: '1px solid #EEF1F4' }}>{l.currCode}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', borderRight: '1px solid #EEF1F4' }}>{fmt(l.amountFC)}</td>
                            <td style={{ padding: '0.28rem 0.48rem', textAlign: 'right', fontWeight: '700', borderRight: '1px solid #EEF1F4' }}>{fmt(l.amountLC)}</td>
                          </>
                        )}
                        <td style={{ padding: '0.24rem 0.42rem' }}>
                          {!isReadOnly && (
                            <div style={{ display: 'flex', gap: '0.3rem' }}>
                              <button style={{ ...btn('secondary'), padding: '0.14rem 0.42rem', fontSize: '0.68rem', borderRadius: '0.18rem' }} onClick={() => handleEditLineClick(i)}>Edit</button>
                              <button style={{ ...btn('danger'), padding: '0.14rem 0.42rem', fontSize: '0.68rem', borderRadius: '0.18rem' }} onClick={() => handleDeleteLineClick(i)}>Del</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* ── Line Detail Add/Edit Form ── */}
              {showLineForm && (
                <div style={{ borderTop: '2px solid #A0A8B0', background: '#FAFBFC', padding: 0 }}>
                  <div style={{ ...classicPanelTitle }}>
                    {editingLineIdx !== null ? 'Edit Line Item' : 'Add Line Item'}
                  </div>
                  <div style={{ padding: '0.5rem 0.55rem' }}>

                  {isMetalVoucher ? (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '2.35fr 1.25fr auto', gap: '0.75rem', alignItems: 'start', marginBottom: '0.6rem' }}>
                        <div style={{ border: `1px solid ${S.border}`, background: S.white }}>
                          <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(180px, 1fr) 90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', color: S.ink, background: S.headerBg }}>Stock *</div>
                            <select
                              style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }}
                              value={lineForm.stockCode}
                              onChange={(e) => handleStockSelection(e.target.value)}
                            >
                              <option value="">{loadingInventoryProducts ? 'Loading stock...' : 'Select stock'}</option>
                              {inventoryStockOptions.map((option) => (
                                <option key={option.code} value={option.code}>{option.label}</option>
                              ))}
                            </select>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', color: S.ink, borderLeft: `1px solid ${S.border}`, background: S.headerBg }}>Location</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }} value={lineForm.location} onChange={e => setLF('location', e.target.value)} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', color: S.ink, background: S.headerBg }}>Product Type</div>
                            <select
                              style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }}
                              value={lineForm.productType}
                              onChange={e => {
                                const selectedName = e.target.value
                                setLineForm(prev => applyProductTypeAutoFill({ ...prev, productType: selectedName }, selectedName))
                              }}
                            >
                              <option value="">Select product type</option>
                              {inventoryProducts
                                .filter(p => String(p.category || '').includes('recordType=product'))
                                .map(p => <option key={p._id} value={p.name}>{p.name}</option>)
                              }
                            </select>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', borderLeft: `1px solid ${S.border}`, background: S.headerBg }}>PCS</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="1" value={lineForm.pcs} onChange={e => setLineForm(prev => applyProductTypeAutoFill({ ...prev, pcs: e.target.value }))} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', background: S.headerBg }}>Gross Weight</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.001" value={lineForm.grossWeight} onChange={e => setLineForm(prev => applyLineAutoCalc({ ...prev, grossWeight: e.target.value }))} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', background: S.headerBg }}>Purity</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.001" value={lineForm.purity} onChange={e => setLineForm(prev => applyLineAutoCalc({ ...prev, purity: e.target.value }))} />
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', borderLeft: `1px solid ${S.border}`, background: S.headerBg }}>Pure Weight</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.001" value={lineForm.pureWeight} onChange={e => { const pw = parseFloat(e.target.value) || 0; setLineForm(prev => ({ ...prev, pureWeight: e.target.value, weightInOz: pw > 0 ? (pw / 31.1034768).toFixed(3) : '' })) }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', background: S.headerBg }}>Weight In OZ.</div>
                            <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} value={lineForm.weightInOz || ((parseFloat(lineForm.pureWeight) || 0) > 0 ? ((parseFloat(lineForm.pureWeight) || 0) / 31.1034768).toFixed(3) : '')} onChange={e => setLF('weightInOz', e.target.value)} />
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', borderLeft: `1px solid ${S.border}`, background: S.headerBg }} />
                            <div style={{ borderLeft: `1px solid ${S.border}`, background: '#F9FAFB' }} />
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '110px minmax(90px, 1fr) 110px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', background: S.headerBg }}>Tax Type</div>
                            <select style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }} value={lineForm.vatType || 'VAT'} onChange={e => setLF('vatType', e.target.value)}>
                              <option value="VAT">VAT</option>
                              <option value="GST">GST</option>
                              <option value="Sales Tax">Sales Tax</option>
                              <option value="None">None</option>
                            </select>
                            <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', borderLeft: `1px solid ${S.border}`, background: S.headerBg }} />
                            <div style={{ borderLeft: `1px solid ${S.border}`, background: '#F9FAFB' }} />
                          </div>

                        </div>

                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          <div style={{ border: `1px solid ${S.border}`, background: S.white }}>
                            <div style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', borderBottom: `1px solid ${S.border}`, background: S.headerBg }}>Making / Margin</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate Type</div>
                              <select style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }} value={lineForm.rateType} onChange={e => setLF('rateType', e.target.value)}>
                                <option value="OZ">OZ</option>
                                <option value="GRAM">GRAM</option>
                                <option value="KG">KG</option>
                              </select>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate</div>
                              <input
                                style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }}
                                type="number"
                                step="0.01"
                                value={lineForm.metalRate}
                                onChange={e => setLF('metalRate', e.target.value)}
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)' }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Amount</div>
                              <input
                                style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', background: '#F9FAFB' }}
                                type="number"
                                step="0.01"
                                value={lineForm.metalAmount}
                                readOnly
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderTop: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Purity Diff</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.001" value={lineForm.purityDiff} onChange={e => setLF('purityDiff', e.target.value)} />
                            </div>
                          </div>

                          <div style={{ border: `1px solid ${S.border}`, background: S.white }}>
                            <div style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', borderBottom: `1px solid ${S.border}`, background: S.headerBg }}>Premium Values</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Premi. Curr.</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(44px, 1fr)' }}>
                                <select style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.25rem' }} value={lineForm.currCode} onChange={e => handleLineCurrencyChange(e.target.value)}>
                                  {currencyOptions.length === 0 ? (
                                    <option value="USD">USD</option>
                                  ) : currencyOptions.map((item) => (
                                    <option key={item.code} value={item.code}>{item.code}</option>
                                  ))}
                                </select>
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.35rem', textAlign: 'right' }} type="number" step="0.000001" value={lineForm.premiumValue} onChange={e => setLF('premiumValue', e.target.value)} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '58px minmax(44px, 1fr)' }}>
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.25rem' }} value={lineForm.rateType} onChange={e => setLF('rateType', e.target.value)} />
                                <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.35rem', textAlign: 'right' }} type="number" step="0.01" value={lineForm.metalRate} onChange={e => setLF('metalRate', e.target.value)} />
                              </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Total (FC)</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} readOnly value={lineForm.metalAmount || ''} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '98px minmax(80px, 1fr)' }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Total (LC)</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} readOnly value={lineForm.totalAmount || lineForm.amountLC || ''} />
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'grid', gap: '0.5rem' }}>
                          <div style={{ border: `1px solid ${S.border}`, background: S.white, minWidth: '180px' }}>
                            <div style={{ padding: '0.28rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', borderBottom: `1px solid ${S.border}`, background: S.headerBg }}>Metal Rate & Amount</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate Type</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem' }} value={lineForm.rateType} onChange={e => setLF('rateType', e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Rate</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.01" value={lineForm.metalRate} onChange={e => setLF('metalRate', e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Metal Amt</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', color: '#991B1B', fontWeight: '700', background: '#F9FAFB' }} type="number" step="0.01" value={lineForm.metalAmount} readOnly />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Premium Amt</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', background: '#F9FAFB' }} type="number" step="0.01" value={lineForm.premiumAmount || ''} readOnly />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem' }}>Making Chg.</div>
                              <input style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right' }} type="number" step="0.01" value={lineForm.makingCharges} onChange={e => setLF('makingCharges', e.target.value)} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)', borderBottom: `1px solid ${S.border}` }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700' }}>Total</div>
                              <input
                                style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', fontWeight: '700', background: '#F9FAFB' }}
                                type="number"
                                step="0.01"
                                value={lineForm.totalAmount}
                                readOnly
                              />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '90px minmax(90px, 1fr)' }}>
                              <div style={{ padding: '0.3rem 0.45rem', fontSize: '0.72rem', fontWeight: '700' }}>Total Amt+Tax</div>
                              <input
                                style={{ ...inputStyle, border: 0, borderRadius: 0, padding: '0.3rem 0.45rem', textAlign: 'right', fontWeight: '700' }}
                                readOnly
                                value={lineForm.amountWithVAT || ''}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gap: '0.35rem' }}>
                            <button style={{ ...btn('gray'), minWidth: '92px' }} onClick={() => {
                              saveLine()
                              if (!lineForm.stockCode.trim()) return
                              setTimeout(() => openAddLine(), 50)
                            }}>
                              Continue
                            </button>
                            <button style={{ ...btn('primary'), minWidth: '92px' }} onClick={saveLine}>Save</button>
                            <button style={{ ...btn('secondary'), minWidth: '92px' }} onClick={cancelLine}>Cancel</button>
                          </div>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 180px', gap: '0.55rem', marginBottom: '0.2rem' }}>
                        <div>
                          <label style={labelStyle}>Narration</label>
                          <input style={inputStyle} value={lineForm.narration} onChange={e => setLF('narration', e.target.value)} />
                        </div>
                        <div>
                          <label style={labelStyle}>Silver Purity %</label>
                          <input style={inputStyle} type="number" step="0.01" value={lineForm.silverPurity} onChange={e => setLF('silverPurity', e.target.value)} />
                        </div>
                      </div>
                    </>
                  ) : (
                    <div style={{ border: '1px solid #C9CED6', borderRadius: '0.15rem', overflow: 'visible', background: '#FFFFFF', fontSize: '0.78rem' }}>
                      {/* Row 1: Type | A/C Code | Curr | Rate */}
                      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 96px 1.6fr 58px 1fr 60px 1fr', borderBottom: '1px solid #E5E7EB' }}>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Type</div>
                        <select style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', borderRight: '1px solid #E5E7EB' }} value={lineForm.type} onChange={e => handleLineTypeChange(e.target.value)}>
                          <option value="Cash">Cash</option>
                          <option value="TT">TT</option>
                          <option value="Card">Card</option>
                        </select>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>A/C Code *</div>
                        <AccountCombobox
                          groups={lineAccountComboGroups}
                          value={lineForm.acCode || ''}
                          onChange={(val) => setLF('acCode', val)}
                          placeholder="— Select Account —"
                          style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', borderRight: '1px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }}
                          disabled={formReadOnly}
                        />
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Curr</div>
                        <select style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', borderRight: '1px solid #E5E7EB' }} value={lineForm.currCode} onChange={e => handleLineCurrencyChange(e.target.value)}>
                          {currencyOptions.length === 0 ? (
                            <option value="USD">USD</option>
                          ) : currencyOptions.map((item) => (
                            <option key={item.code} value={item.code}>{item.code}</option>
                          ))}
                        </select>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Rate</div>
                        <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', textAlign: 'right', width: '100%' }} type="text" inputMode="decimal" value={lineForm.currRate} onChange={e => handleCurrRateChange(e.target.value)} placeholder={header.currRate} />
                        </div>
                      {/* Ref Rate row - shows for payment/receipt with non-base foreign currency */}
                      {['payment', 'receipt'].includes(String(voucherType || '').toLowerCase()) &&
                        String(lineForm.currCode || 'USD').toUpperCase() !== baseCurrencyCode && (
                        <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px 1fr', borderBottom: '1px solid #E5E7EB', background: '#FFFBEB' }}>
                          <div style={{ padding: '0.26rem 0.45rem', background: '#FEF3C7', fontWeight: '700', fontSize: '0.7rem', color: '#92400E', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Ref Rate</div>
                          <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFFBEB', outline: 'none', textAlign: 'right', borderRight: '1px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }} type="text" inputMode="decimal" value={lineForm.referenceRate || ''} onChange={e => setLF('referenceRate', e.target.value)} placeholder="Original invoice rate" />
                          <div style={{ padding: '0.26rem 0.45rem', background: '#FEF3C7', fontSize: '0.68rem', color: '#92400E', borderRight: '1px solid #DDE1E8', display: 'flex', alignItems: 'center' }}></div>
                          <div style={{ padding: '0.26rem 0.45rem', fontSize: '0.68rem', color: '#92400E', fontStyle: 'italic', display: 'flex', alignItems: 'center' }}>Rate when obligation was created (for FX gain/loss)</div>
                        </div>
                      )}
                      {/* Amount row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '72px 1fr 72px 1fr', borderBottom: '1px solid #E5E7EB' }}>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Amt FC</div>
                        <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', textAlign: 'right', borderRight: '1px solid #E5E7EB', width: '100%', boxSizing: 'border-box' }} type="text" inputMode="decimal" value={lineForm.amountFC} onChange={e => handleAmountFC(e.target.value)} onKeyDown={handleLineAmountEnter} />
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Amt LC *</div>
                        <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', textAlign: 'right', width: '100%', boxSizing: 'border-box' }} type="text" inputMode="decimal" value={lineForm.amountLC} onChange={e => handleAmountLC(e.target.value)} onKeyDown={handleLineAmountEnter} />
                      </div>

                      {/* Narration row */}
                      <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr', borderBottom: '1px solid #E5E7EB' }}>
                        <div style={{ padding: '0.26rem 0.45rem', background: '#F3F4F6', fontWeight: '700', fontSize: '0.7rem', color: '#4B5563', textTransform: 'uppercase', display: 'flex', alignItems: 'center', borderRight: '1px solid #DDE1E8' }}>Narration</div>
                        <input style={{ border: 0, borderRadius: 0, padding: '0.26rem 0.45rem', fontSize: '0.78rem', background: '#FFF', outline: 'none', width: '100%', boxSizing: 'border-box' }} value={lineForm.narration} onChange={e => setLF('narration', e.target.value)} />
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: 'flex', gap: '0.4rem', padding: '0.32rem 0.55rem', background: 'linear-gradient(180deg, #F3F4F6 0%, #E8EAED 100%)', borderTop: '1px solid #D4D8DE' }}>
                        <button style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: 'linear-gradient(180deg, #FFFFFF 0%, #DCDCDC 100%)', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)' }} onClick={() => { saveLine(); if (!lineForm.acCode.trim()) return; setTimeout(() => openAddLine(), 50) }}>Continue</button>
                        <button style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: 'linear-gradient(180deg, #16A34A 0%, #059669 100%)', border: '1px solid #047857', borderRadius: '0.15rem', cursor: 'pointer', color: '#FFF', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2)' }} onClick={saveLine}>Save</button>
                        <button style={{ padding: '0.2rem 0.65rem', fontSize: '0.74rem', fontWeight: '700', background: 'linear-gradient(180deg, #FFFFFF 0%, #DCDCDC 100%)', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92)' }} onClick={cancelLine}>Cancel</button>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              )}

              {/* ── Bottom strip: Actions + Remarks + Amount Summary ── */}
              <div style={{ borderTop: '2px solid #B8BEC8', background: 'linear-gradient(180deg, #F4F5F7 0%, #E8EAED 100%)', padding: '0.38rem 0.55rem' }}>
                <div style={{ display: 'flex', gap: '0.55rem', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  {/* Left: Add/Edit/Delete + Remarks */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.38rem', flex: 1 }}>
                    {!isReadOnly && (
                      <div style={{ display: 'flex', gap: '0.3rem' }}>
                        <button
                          style={{ padding: '0.2rem 0.72rem', fontSize: '0.74rem', fontWeight: '700', background: 'linear-gradient(180deg, #FFFFFF 0%, #DCDCDC 100%)', border: '1px solid #9CA3AF', borderRadius: '0.15rem', cursor: 'pointer', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.92), 0 1px 1px rgba(0,0,0,0.06)' }}
                          onClick={handleAddLineClick}
                        >Add</button>
                      </div>
                    )}

                  </div>
                  {/* Right: Amount Summary */}
                  <div style={{ border: '1px solid #8EA0C5', borderRadius: '0.15rem', background: '#FFFFFF', minWidth: '245px', overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ ...(isMetalVoucher ? metalWin.summaryHeader : { background: 'linear-gradient(180deg, #E8EAED 0%, #D4D8DF 100%)', color: '#374151' }), borderBottom: isMetalVoucher ? `1px solid ${S.greenDark}` : '1px solid #8EA0C5', padding: '0.2rem 0.65rem', fontSize: '0.7rem', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Amount Summary</div>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.77rem' }}>
                      <tbody>
                        {isMetalVoucher && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Metal Amount :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.metalTotal)}</td>
                          </tr>
                        )}
                        {isMetalVoucher && totals.premiumTotal !== 0 && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Premium Amount :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.premiumTotal)}</td>
                          </tr>
                        )}
                        {isMetalVoucher && totals.makingTotal !== 0 && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Making Charges :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.makingTotal)}</td>
                          </tr>
                        )}
                        {isMetalVoucher && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>Gross Amount :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.total)}</td>
                          </tr>
                        )}
                        {isMetalVoucher && (
                          <tr style={{ borderBottom: '1px solid #E8EAED' }}>
                            <td style={{ padding: '0.18rem 0.65rem', color: '#374151' }}>VAT Amount :</td>
                            <td style={{ padding: '0.18rem 0.65rem', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.vatAmount)}</td>
                          </tr>
                        )}
                        <tr style={{ background: '#F1F3F6' }}>
                          <td style={{ padding: '0.24rem 0.65rem', color: '#111827', fontWeight: '700' }}>Net Amt ({header.currCode || 'USD'}) :</td>
                          <td style={{ padding: '0.24rem 0.65rem', textAlign: 'right', fontWeight: '800', color: S.green, fontSize: '0.87rem' }}>{fmt(totals.grandTotal)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Attachments panel ── */}
          {menuTab === 'attachments' && (
            <div style={sectionBox}>
              <div style={sectionHeader}>Attachments</div>
              <div style={{ ...sectionBody, color: S.muted, fontSize: '0.875rem', textAlign: 'center', padding: '2rem' }}>
                {editingId
                  ? 'Attachments can be managed via the Transactions tab.'
                  : 'Save the voucher first, then add attachments.'}
              </div>
            </div>
          )}

          {/* ── Voucher Workflow ── */}
          {editingId && (
            <div style={{ ...classicPanel, marginBottom: '0.75rem' }}>
              <div style={{ ...classicPanelTitle }}>{t('approvalWorkflow')}</div>
              <div style={{ padding: '0.5rem 0.65rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 1fr) minmax(320px, 1.6fr)', gap: '0.75rem', alignItems: 'start' }}>
                  <div>
                    <label style={labelStyle}>Workflow Note</label>
                    <textarea
                      value={workflowNote}
                      onChange={(e) => setWorkflowNote(e.target.value)}
                      rows={3}
                      placeholder="Optional note for submit / approve / post"
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '76px' }}
                      readOnly={isReadOnly || saving}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '999px', fontSize: '0.76rem', fontWeight: '700', background: currentVoucherStatus === 'draft' ? '#FEF3C7' : currentVoucherStatus === 'submitted' ? '#DBEAFE' : currentVoucherStatus === 'approved' ? '#DCFCE7' : currentVoucherStatus === 'posted' ? '#D1FAE5' : currentVoucherStatus === 'returned' ? '#FCE7F3' : '#FEE2E2', color: currentVoucherStatus === 'draft' ? '#92400E' : currentVoucherStatus === 'submitted' ? '#1D4ED8' : currentVoucherStatus === 'approved' ? '#166534' : currentVoucherStatus === 'posted' ? '#065F46' : currentVoucherStatus === 'returned' ? '#9D174D' : '#B91C1C' }}>
                      Current: {currentVoucherStatus}
                    </span>
                    {canSubmitWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('submit')} style={{ ...btn('gray'), background: '#F59E0B', color: '#111827' }}>
                        {t('submit')}
                      </button>
                    )}
                    {canApproveWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('approve')} style={{ ...btn('gray'), background: '#0EA5E9', color: '#FFFFFF' }}>
                        {t('approve')}
                      </button>
                    )}
                    {canReturnWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('return')} style={{ ...btn('gray'), background: '#F472B6', color: '#831843' }}>
                        {t('returnForEdit')}
                      </button>
                    )}
                    {canRejectWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('reject')} style={{ ...btn('gray'), background: '#FEE2E2', color: '#B91C1C' }}>
                        {t('reject')}
                      </button>
                    )}
                    {canPostWorkflow && (
                      <button type="button" disabled={saving} onClick={() => handleWorkflowAction('post')} style={{ ...btn('primary') }}>
                        {t('post')}
                      </button>
                    )}
                    {canRevalueCurrentVoucher && (
                      <button type="button" disabled={saving} onClick={() => handleRevalueFxJournal(currentVoucher)} style={{ ...btn('gray'), background: '#E0F2FE', color: '#0C4A6E' }}>
                        Revalue FX Journal
                      </button>
                    )}
                    {!canSubmitWorkflow && !canApproveWorkflow && !canReturnWorkflow && !canRejectWorkflow && !canPostWorkflow && (
                      <span style={{ color: S.muted, fontSize: '0.82rem' }}>No workflow action available for your role or current status.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Action buttons ── */}
          {!isReadOnly && (
            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', paddingTop: '1rem', borderTop: `1px solid ${S.border}` }}>
              <button
                style={{ ...btn('primary'), opacity: saving ? 0.7 : 1 }}
                onClick={saveVoucher}
                disabled={saving}
              >
                {saving ? 'Saving...' : (editingId ? '💾 Update Voucher' : '💾 Save Voucher')}
              </button>
              <button style={btn('secondary')} onClick={() => setMode('list')}>
                {t('cancel')}
              </button>
            </div>
          )}
          {isReadOnly && (
            <div style={{ marginTop: '0.75rem' }}>
              <button style={btn('secondary')} onClick={() => setMode('list')}>← Back</button>
            </div>
          )}
          </div>
          </div>
        </div>
      )}
    </div>

    <div className="voucher-print-only" style={{ display: 'none', padding: isMgCurrencyVoucher ? '0 10px' : '18px 24px', color: '#111827', fontFamily: 'Arial, sans-serif', fontSize: '12px' }}>
      {isMgCurrencyVoucher ? (
        <MGVoucherPrintLayout
          companyName={mgCompanyName}
          companyAddress={mgCompanyAddress}
          documentEmail={documentBranding?.email}
          phoneValue={phoneValue}
          logoImage={mgLogoImage}
          printTitle={mgPrintTitle}
          accountDescription={mgAccountDescription}
          trnValue={trnValue}
          docNoValue={payNoValue}
          branch={mgBranch}
          dateValue={payDateValue}
          preparedByValue={preparedByValue}
          amountLabel={printAmountLabel}
          currencyLabel={currencyLabel}
          lineItems={mgLineItems}
          primaryLine={mgPrimaryLine}
          totals={totals}
          amountWords={mgAmountWords}
          partyName={voucher?.partyName}
          normalizeLineType={normalizeLineType}
          fmt={fmt}
        />
      ) : (
      <>
      <DocumentPrintHeader branding={documentBranding} title={printTitle} meta={printMeta} />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: '12px', marginBottom: '10px' }}>
        <div style={{ border: '1px dashed #6B7280', padding: '8px' }}>
          <div>{voucher?.partyAccount || ''}</div>
          <div style={{ marginTop: '6px' }} />
          <div style={{ textAlign: 'center' }}>{trnValue ? `TRN - ${trnValue}` : ''}</div>
        </div>
        <div style={{ border: '1px dashed #6B7280', padding: '8px' }}>
          <div><strong>PAY NO</strong> : {payNoValue || ''}</div>
          <div><strong>Date</strong> : {payDateValue || ''}</div>
          <div><strong>Prepared By</strong> : {preparedByValue || ''}</div>
        </div>
      </div>

      {voucherType === 'payment' ? (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: '8px' }}>
          <thead>
            <tr style={{ background: '#E5E7EB' }}>
              <th style={{ border: '1px solid #111827', padding: '6px 4px', width: '42px' }}>No.</th>
              <th style={{ border: '1px solid #111827', padding: '6px 4px' }}>{isMetalVoucher ? 'Stock / Account Description' : 'Account Description'}</th>
              <th style={{ border: '1px solid #111827', padding: '6px 4px', width: '90px' }}>{isMetalVoucher ? 'Metal' : 'Type'}</th>
              <th style={{ border: '1px solid #111827', padding: '6px 4px', width: '110px' }}>{isMetalVoucher ? 'Pure Wt.' : 'Amount FC'}</th>
              <th style={{ border: '1px solid #111827', padding: '6px 4px', width: '110px' }}>{isMetalVoucher ? 'Total' : printAmountLabel}</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(effectiveLineItems) ? effectiveLineItems : []).map((line, idx) => {
              const accountCode = line?.acCode || ''
              const paymentType = normalizeLineType(line?.type) || ''
              return (
                <tr key={`print-line-${idx}`}>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', verticalAlign: 'top' }}>
                    <div>{accountCode || ''}</div>
                    <div style={{ fontSize: '9px', color: '#555' }}>
                      {paymentType || ''}
                    </div>
                  </td>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', verticalAlign: 'top' }}>{paymentType || ''}</td>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.amountFC || 0)}</td>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(line?.amountLC || 0)}</td>
                </tr>
              )
            })}
            {(Array.isArray(effectiveLineItems) ? effectiveLineItems : []).length === 0 && (
              <tr>
                <td colSpan={5} style={{ border: '1px solid #111827', padding: '8px', textAlign: 'center' }}>No line items</td>
              </tr>
            )}
          </tbody>
        </table>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed', marginBottom: '8px' }}>
          <thead>
            <tr style={{ background: '#E5E7EB' }}>
              <th style={{ border: '1px solid #111827', padding: '6px 4px', width: '42px' }}>No.</th>
              <th style={{ border: '1px solid #111827', padding: '6px 4px' }}>Account Description</th>
              <th style={{ border: '1px solid #111827', padding: '6px 4px', width: '90px' }}>Type</th>
              <th style={{ border: '1px solid #111827', padding: '6px 4px', width: '110px' }}>Amount FC</th>
              <th style={{ border: '1px solid #111827', padding: '6px 4px', width: '110px' }}>{`Amount (${currencyLabel || 'USD'})`}</th>
            </tr>
          </thead>
          <tbody>
            {(Array.isArray(effectiveLineItems) ? effectiveLineItems : []).map((line, idx) => {
              const accountCode = line?.acCode || ''
              const accountName = accountNameByCode(accountCode)
              const paymentType = normalizeLineType(line?.type) || ''
              const customerAccountNo = line?.partyAccount || voucher?.partyAccount || ''
              const metalLabel = line?.metalSymbol || line?.metalName || line?.productType || ''
              const lineTotal = Number(line?.totalAmount || line?.amountWithVAT || line?.amountLC || line?.amountFC || 0)
              return (
                <tr key={`print-line-${idx}`}>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', textAlign: 'center', verticalAlign: 'top' }}>{idx + 1}</td>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', verticalAlign: 'top' }}>
                    {isMetalVoucher ? (
                      <>
                        <div>{`${line?.stockCode || accountCode || ''}${line?.productType ? ` - ${line.productType}` : accountName ? ` - ${accountName}` : ''}`}</div>
                        <div style={{ fontSize: '9px', color: '#555' }}>{line?.remarks || line?.narration || customerAccountNo || ''}</div>
                      </>
                    ) : (
                      <>
                        <div>{`${accountCode || ''}${accountName ? ` - ${accountName}` : ''}`}</div>
                        <div>{customerAccountNo || ''}</div>
                        <div>{paymentType || ''}</div>
                      </>
                    )}
                  </td>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', verticalAlign: 'top' }}>{isMetalVoucher ? metalLabel : paymentType}</td>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{isMetalVoucher ? fmt(line?.pureWeight || 0) : fmt(line?.amountFC || 0)}</td>
                  <td style={{ border: '1px solid #111827', padding: '6px 4px', textAlign: 'right', verticalAlign: 'top' }}>{fmt(isMetalVoucher ? lineTotal : line?.amountLC || 0)}</td>
                </tr>
              )
            })}
            {(Array.isArray(effectiveLineItems) ? effectiveLineItems : []).length === 0 && (
              <tr>
                <td colSpan={5} style={{ border: '1px solid #111827', padding: '8px', textAlign: 'center' }}>No line items</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '8px' }}>
        <tbody>
          <tr>
            <td style={{ border: '1px solid #111827', padding: '4px 6px', textAlign: 'right', fontWeight: '700' }}>{`Total (${currencyLabel || 'USD'})`}</td>
            <td style={{ border: '1px solid #111827', padding: '4px 6px', textAlign: 'right', width: '110px', fontWeight: '700' }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #111827', padding: '4px 6px', textAlign: 'right', fontWeight: '700' }}>{`Total Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ border: '1px solid #111827', padding: '4px 6px', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
          <tr>
            <td style={{ border: '1px solid #111827', padding: '4px 6px', textAlign: 'right', fontWeight: '700' }}>{`Total Party Value (${currencyLabel || 'USD'})`}</td>
            <td style={{ border: '1px solid #111827', padding: '4px 6px', textAlign: 'right', fontWeight: '700' }}>{fmt(totals.grandTotal || 0)}</td>
          </tr>
        </tbody>
      </table>

      {/* ── DEBIT NOTICE ── */}
      <div style={{
        border: '1px solid #111827',
        padding: '6px 10px',
        fontSize: '10px',
        lineHeight: '1.75',
        marginTop: '4px'
      }}>
        <div style={{ marginBottom: '3px', color: '#555', fontSize: '9px' }}>
          Your account has been updated with :
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: '16px',
          flexWrap: 'wrap'
        }}>
          {/* LEFT — Currency + numeric amount + DEBITED */}
          <div style={{ fontWeight: '700', fontSize: '11px', color: '#111827', flexShrink: 0 }}>
            {currencyLabel || 'USD'} {fmt(totals.grandTotal || 0)} {printPostingDirection}
          </div>
          {/* RIGHT — Amount in words */}
          <div style={{
            fontStyle: 'italic',
            fontSize: '9px',
            color: '#333333',
            flex: 1,
            textAlign: 'right'
          }}>
            {totals.grandTotal > 0
              ? `${numberToWords(totals.grandTotal)} ${currencyLabel || 'USD'} Only`
              : ''}
          </div>
        </div>
      </div>

      {/* ── NARRATION / NOTE LINE ── */}
      <div style={{
        border: '1px solid #111827',
        borderTop: '1px solid #111827',
        padding: '5px 10px',
        fontSize: '9px',
        color: '#151111',
        minHeight: '22px'
      }}>
        {lineItems?.[0]?.narration || ''}
      </div>

      <div style={{ marginTop: '10px', fontSize: '11px' }}>Confirmed for & on behalf of</div>
      {voucherType === 'payment' ? (
        <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '20px' }}>
          <div style={{ fontWeight: '600', fontSize: '11px', color: '#111' }}>
            {voucher?.partyName || ''}
          </div>
          <div style={{ fontWeight: '600', fontSize: '11px', color: '#111' }}>
            {voucher?.partyAccount || ''}
          </div>
        </div>
      ) : (
        <div style={{ marginTop: '4px', display: 'flex', justifyContent: 'space-between', gap: '12px', minHeight: '20px' }}>
          <div>{voucher?.partyName || ''}</div>
          <div>{voucher?.partyAccount || ''}</div>
        </div>
      )}

      <div style={{ marginTop: '88px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '36px', textAlign: 'center', fontWeight: '700' }}>
        <div>
          <div style={{ borderTop: '1px solid #111827', paddingTop: '4px' }}>RECEIVER'S SIGNATURE</div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #111827', paddingTop: '4px' }}>CHECKED BY</div>
        </div>
        <div>
          <div style={{ borderTop: '1px solid #111827', paddingTop: '4px' }}>AUTHORISED SIGNATORY</div>
        </div>
      </div>
      </>
      )}
    </div>
    </>
  )
}
