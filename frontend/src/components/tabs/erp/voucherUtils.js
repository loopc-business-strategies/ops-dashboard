/** Domain helpers shared by VoucherTab, VoucherListPanel, and print model (no UI tokens). */

export const fmt = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const today = () => new Date().toISOString().slice(0, 10)

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
export const METAL_TRANSFER_VOUCHER_TYPES = ['metal_receipt', 'metal_payment']

export const isMetalStockVoucherType = (type) => (
  METAL_STOCK_VOUCHER_TYPES.includes(String(type || '').toLowerCase())
)
export const isMetalTransferVoucherType = (type) => (
  METAL_TRANSFER_VOUCHER_TYPES.includes(String(type || '').toLowerCase())
)
export const hasMetalTransferLineQuantity = (line = {}) => (
  (parseFloat(line.grossWeight) || 0) > 0
  || (parseFloat(line.pureWeight) || 0) > 0
  || (parseFloat(line.pcs) || 0) > 0
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

export const parseAnyVoucherDocMeta = (docNo) => {
  const raw = String(docNo || '').trim()
  if (!raw) return null

  const numericOnly = raw.match(/^(\d+)$/)
  if (numericOnly) {
    const seq = Number(numericOnly[1])
    if (Number.isFinite(seq) && seq > 0) {
      return { prefix: '', year: 0, seq, sortKey: seq }
    }
  }

  const formatted = raw.match(/^([A-Za-z]+)\/(\d{4})\/(\d+)$/i)
  if (!formatted) return null

  const year = Number(formatted[2])
  const seq = Number(formatted[3])
  if (!Number.isFinite(year) || !Number.isFinite(seq) || seq <= 0) return null
  return {
    prefix: formatted[1],
    year,
    seq,
    sortKey: year * 100000 + seq,
  }
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

export const coerceVoucherDocNo = (voucherType, docNo, docDate) => {
  const type = String(voucherType || '').toLowerCase()
  const expectedPrefix = DOC_PREFIX_BY_TYPE[type]
  if (!expectedPrefix) return String(docNo || '').trim()

  const raw = String(docNo || '').trim()
  if (!raw) return buildVoucherDocNo(type, docDate, 1)

  const meta = parseAnyVoucherDocMeta(raw)
  if (!meta) return raw

  if (String(meta.prefix || '').toLowerCase() === expectedPrefix.toLowerCase()) {
    return raw
  }

  const year = meta.year === 0 ? getDocYear(docDate) : meta.year
  return buildVoucherDocNo(type, `${year}-01-01`, meta.seq)
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

export function sortVouchersByDocNo(items, type) {
  const src = Array.isArray(items) ? [...items] : []
  return src.sort((a, b) => {
    const am = parseAnyVoucherDocMeta(a?.voucherMeta?.vocNo) || parseVoucherDocMeta(a?.voucherMeta?.vocNo, type)
    const bm = parseAnyVoucherDocMeta(b?.voucherMeta?.vocNo) || parseVoucherDocMeta(b?.voucherMeta?.vocNo, type)
    const ak = am?.sortKey ?? 0
    const bk = bm?.sortKey ?? 0
    if (ak !== bk) return ak - bk
    return new Date(a?.date || 0).getTime() - new Date(b?.date || 0).getTime()
  })
}

export function nextVocNo(list, voucherType, docDateOverride, fallbackList = []) {
  const src = Array.isArray(list) ? list : fallbackList
  const normalizedType = String(voucherType || '').toLowerCase()
  const currentYear = Number(getDocYear(docDateOverride))
  const nos = src
    .map((v) => parseAnyVoucherDocMeta(v?.voucherMeta?.vocNo) || parseVoucherDocMeta(v?.voucherMeta?.vocNo, normalizedType))
    .filter(Boolean)
    .filter((meta) => meta.year === 0 || meta.year === currentYear)
    .map((meta) => meta.seq)
    .filter((n) => Number.isFinite(n) && n > 0)
  const next = nos.length ? Math.max(...nos) + 1 : 1
  return buildVoucherDocNo(normalizedType, docDateOverride, next)
}

export function displayVoucherDocNo(voucher, voucherType, docDateFallback = '') {
  const meta = voucher?.voucherMeta || {}
  const docDate = meta.docDate || voucher?.date || docDateFallback
  const voucherKind = String(voucher?.type || voucherType || '').toLowerCase()
  return coerceVoucherDocNo(voucherKind, meta.vocNo, docDate)
}

export function computeVoucherGrandTotal(voucher, voucherType) {
  const m = voucher?.voucherMeta || {}
  const isRpList = ['receipt', 'payment'].includes(String(voucherType || '').toLowerCase())
  return (m.lineItems || []).reduce((sum, line) => {
    if (isRpList) {
      const fc = parseFloat(line.amountFC)
      if (Number.isFinite(fc) && fc !== 0) return sum + fc
    }
    return sum + (parseFloat(line.amountWithVAT) || parseFloat(line.amountLC) || parseFloat(line.amountFC) || 0)
  }, 0)
}

export function numberToWords(amount) {
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
