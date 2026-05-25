/** Shared voucher UI constants and pure helpers (split from VoucherTab.jsx). */
export const BASE = '/api/erp-accounting'
export const cfg = () => ({ withCredentials: true })

export const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const today = () => new Date().toISOString().slice(0, 10)
export const S = {
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

export const fieldRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: '0.6rem 1rem',
  marginBottom: '0.5rem',
}

export const fieldGroup = (label, children, span) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: '2px',
  gridColumn: span ? `span ${span}` : undefined,
})

export const labelStyle = { fontSize: '0.72rem', fontWeight: '600', color: S.muted, textTransform: 'uppercase', letterSpacing: '0.04em' }

export const inputStyle = {
  padding: '0.35rem 0.6rem',
  border: `1px solid ${S.border}`,
  borderRadius: '0.3rem',
  fontSize: '0.875rem',
  background: S.white,
  color: S.ink,
  width: '100%',
  boxSizing: 'border-box',
}

export const readInput = { ...inputStyle, background: S.bg, color: S.muted }

export const sectionBox = {
  border: `1px solid ${S.border}`,
  borderRadius: '0.5rem',
  marginBottom: '1rem',
  overflow: 'visible',
}

export const sectionHeader = {
  background: S.headerBg,
  padding: '0.4rem 0.8rem',
  fontWeight: '700',
  fontSize: '0.8rem',
  color: S.ink,
  borderBottom: `1px solid ${S.border}`,
  letterSpacing: '0.03em',
}

export const sectionBody = { padding: '0.75rem' }

export const btn = (variant = 'primary') => ({
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

export const tabBtn = (active) => ({
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

export const classicHeaderShell = {
  padding: '0.1rem 0',
}

export const classicHeaderGrid = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '0.65rem',
  alignItems: 'start',
}

export const classicPanel = {
  border: '1px solid #C9CED6',
  borderRadius: '0.25rem',
  background: '#FFFFFF',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.88)',
  overflow: 'visible',
  alignSelf: 'start',
  height: 'fit-content',
}

export const classicPanelTitle = {
  background: 'linear-gradient(180deg, #F3F4F6 0%, #D8DCE2 100%)',
  borderBottom: '1px solid #C9CED6',
  color: '#4B5563',
  fontSize: '0.72rem',
  fontWeight: '700',
  letterSpacing: '0.04em',
  padding: '0.42rem 0.65rem',
  textTransform: 'uppercase',
}

export const classicPartyGrid = {
  display: 'grid',
  gridTemplateColumns: 'minmax(220px, 1.25fr) minmax(140px, 0.75fr)',
  gap: '0.38rem 0.5rem',
  padding: '0.38rem 0.55rem 0.4rem',
  alignItems: 'end',
}

export const classicPartyCard = {
  margin: '0 0.55rem 0.55rem',
  border: '1px solid #C9CED6',
  borderRadius: '0.2rem',
  background: '#FBFCFE',
  overflow: 'hidden',
}

export const classicPartyCardHeader = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) auto',
  borderBottom: '1px solid #D7DCE3',
  background: 'linear-gradient(180deg, #F8FBFF 0%, #E6ECF5 100%)',
}

export const classicPartyCardTitle = {
  padding: '0.46rem 0.68rem',
  fontSize: '0.82rem',
  fontWeight: '700',
  color: '#F9FAFB',
  borderRight: '1px solid #D7DCE3',
  background: 'linear-gradient(180deg, #B8C4D6 0%, #94A3B8 100%)',
  textShadow: '0 1px 0 rgba(15,23,42,0.18)',
}

export const classicPartyCardCodeWrap = {
  display: 'grid',
  gridTemplateColumns: 'minmax(96px, auto) 28px',
  background: '#FFFFFF',
}

export const classicPartyCardCode = {
  padding: '0.42rem 0.55rem',
  fontSize: '0.78rem',
  fontWeight: '700',
  color: '#374151',
  background: '#FFFFFF',
  borderRight: '1px solid #D7DCE3',
  minWidth: '96px',
  textAlign: 'left',
}

export const classicPartyCardCodeInput = {
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

export const classicPartyCardSearch = {
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

export const classicPartyCardName = {
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

export const classicPartyCardBody = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: '0.55rem 0.7rem',
  padding: '0.55rem 0.6rem 0.65rem',
}

export const classicPartyCardField = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.18rem',
  minWidth: 0,
}

export const classicPartyCardFieldLabel = {
  fontSize: '0.66rem',
  fontWeight: '700',
  color: '#6B7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

export const classicPartyCardFieldValue = {
  fontSize: '0.8rem',
  color: '#111827',
  minHeight: '1rem',
  wordBreak: 'break-word',
}

export const classicRightGrid = {
  display: 'grid',
  gridTemplateColumns: '96px minmax(0, 1fr)',
  gap: '0.32rem 0.5rem',
  padding: '0.38rem 0.55rem 0.4rem',
  alignItems: 'center',
}

export const classicLabel = {
  fontSize: '0.7rem',
  fontWeight: '700',
  color: '#4B5563',
  letterSpacing: '0.03em',
  textTransform: 'uppercase',
}

export const classicInput = {
  ...inputStyle,
  minHeight: '1.9rem',
  borderRadius: '0.12rem',
  borderColor: '#C8CED6',
  background: '#FFFFFF',
  boxShadow: 'inset 0 1px 1px rgba(15, 23, 42, 0.04)',
  padding: '0.28rem 0.45rem',
  fontSize: '0.82rem',
}

export const classicReadInput = {
  ...classicInput,
  background: '#F8FAFB',
  color: '#4B5563',
}

export const classicTextAreaRow = {
  borderTop: '1px solid #D4D8DE',
  display: 'grid',
  gridTemplateColumns: '96px 150px',
  gap: '0.4rem 0.55rem',
  padding: '0.5rem 0.65rem 0.65rem',
  alignItems: 'center',
}

export const metalWin = {
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

export const metalTopInlineRow = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
  gap: '0.55rem',
  alignItems: 'end',
  marginBottom: '0.55rem',
}

export const metalTopField = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.3rem',
}

export const emptyLine = () => ({
  branch: '',
  acCode: '',
  inventoryItemId: '',
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

/** Valid Mongo ObjectId string for API / Mongoose line fields; otherwise null (omit bad casts). */
export const normalizeMongoIdField = (value) => {
  const s = String(value ?? '').trim()
  return /^[a-f\d]{24}$/i.test(s) ? s : null
}

export const emptyHeader = () => ({
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

export const DOC_PREFIX_BY_TYPE = {
  payment: 'Pay',
  receipt: 'Rec',
  purchase: 'Pur',
  sale: 'Sal',
  metal_receipt: 'MRec',
  metal_payment: 'MPay',
}

export const METAL_STOCK_VOUCHER_TYPES = ['purchase', 'sale', 'metal_receipt', 'metal_payment']
export const METAL_STOCK_IN_VOUCHER_TYPES = ['purchase', 'metal_receipt']
export const METAL_STOCK_OUT_VOUCHER_TYPES = ['sale', 'metal_payment']

export const isMetalStockVoucherType = (type) => (
  METAL_STOCK_VOUCHER_TYPES.includes(String(type || '').toLowerCase())
)
export const isMetalStockInVoucherType = (type) => (
  METAL_STOCK_IN_VOUCHER_TYPES.includes(String(type || '').toLowerCase())
)
export const isMetalStockOutVoucherType = (type) => (
  METAL_STOCK_OUT_VOUCHER_TYPES.includes(String(type || '').toLowerCase())
)

export const getDocYear = (dateValue) => {
  const dt = new Date(dateValue || Date.now())
  const year = Number.isFinite(dt.getTime()) ? dt.getFullYear() : new Date().getFullYear()
  return String(year)
}

export const parseVoucherDocMeta = (docNo, voucherType) => {
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

export const buildVoucherDocNo = (voucherType, docDate, sequence) => {
  const prefix = DOC_PREFIX_BY_TYPE[String(voucherType || '').toLowerCase()] || 'Doc'
  const year = getDocYear(docDate)
  return `${prefix}/${year}/${String(sequence).padStart(4, '0')}`
}

export const normalizeLookupValue = (value) => String(value || '').trim().toLowerCase()
export const normalizeLineType = (value) => (value === 'Transfer' ? 'TT' : (value || 'Cash'))
export const FIXED_AED_RATE = 3.674
export const toFinitePositive = (value, fallback = 1) => {
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

export const backendRateToDisplayRate = (backendRate, currCode, usePerUsdDisplay = false) => {
  const normalized = String(currCode || '').trim().toUpperCase()
  const r = toFinitePositive(backendRate, 1)
  if (normalized === 'USD') return 1
  if (usePerUsdDisplay) return 1 / r
  if (normalized === 'AED' && r < 2) return 1 / r
  return r
}

// Payment/receipt UI shows rates as "1 USD = FC" while backend stores "USD per FC".
export const displayRateToBackendRate = (displayRate, currCode, usePerUsdDisplay = false) => {
  const normalized = String(currCode || '').trim().toUpperCase()
  const r = parseFloat(displayRate) || 1
  if (normalized === 'USD') return 1
  if (usePerUsdDisplay && r > 0) return 1 / r
  if (normalized === 'AED' && r > 1) return 1 / r
  return r
}
export const normalizeRateType = (value) => {
  const normalized = String(value || '').trim().toUpperCase()
  if (!normalized || normalized === 'GOZ') return 'OZ'
  return normalized
}
export const normalizeVoucherFixingType = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (['fixing', 'fixed'].includes(normalized)) return 'fixing'
  if (['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)) return 'non-fixing'
  return 'fixing'
}
export const formatPartyAddress = (...parts) => parts.map((part) => String(part || '').trim()).filter(Boolean).join(', ')

export const decodeInventoryCategoryMeta = (category) => {
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

export const normalizeMetalSymbol = (mainStock, metalType) => {
  const val = String(mainStock || metalType || '').trim().toLowerCase()
  if (val === 'gold') return 'XAU'
  if (val === 'silver') return 'XAG'
  if (val === 'platinum') return 'XPT'
  return 'XAU'
}

export const normalizeStockGroup = (mainStock, metalType) => {
  const val = String(mainStock || metalType || '').trim().toLowerCase()
  if (val === 'gold') return 'G'
  if (val === 'silver') return 'S'
  if (val === 'platinum') return 'P'
  return 'M'
}

export const toTitle = (value) => String(value || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase()).trim()

export const decodeFullMeta = (category) => {
  const raw = String(category || '')
  const meta = {}
  raw.split(';').forEach((pair) => {
    const [key, ...rest] = pair.split('=')
    if (!key || rest.length === 0) return
    meta[key.trim()] = rest.join('=').trim()
  })
  return meta
}

export const getAccountCodeValue = (account) => String(account?.code || account?.accountCode || '').trim()
export const getAccountNameValue = (account) => String(account?.name || account?.accountName || '').trim().toLowerCase()

export const isBankLikeAccount = (account) => {
  const name = getAccountNameValue(account)
  const type = String(account?.accountType || '').trim().toLowerCase()
  const category = String(account?.category || '').trim().toLowerCase()
  const code = getAccountCodeValue(account).toLowerCase()
  return name.includes('bank')
    || type.includes('bank')
    || category.includes('bank')
    || code.includes('bank')
}

export const pickDefaultAccountCodeByType = (accounts, lineType) => {
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
