import { backendRateToDisplayRate } from './voucherUtils'

export const DEFAULT_REPORT_MONEY_COLUMNS = { debit: true, credit: true, net: true }

export function defaultReportDisplayOptions(baseCurrencyCode = 'USD') {
  return {
    displayCurrency: String(baseCurrencyCode || 'USD').trim().toUpperCase() || 'USD',
    showNetOnly: false,
    hideNet: false,
    suppressSummary: false,
    reportTo: 'screen',
    showMetal: true,
    /** Created stock type value (`XAU::<id>::sku`) — scopes Trial Balance metal grams. Empty = all. */
    metalType: '',
    calculateClosingStock: false,
    /** When true with Calculate Closing Stock: Net uses live MT4/market rates (gold + silver book). */
    useLiveClosingPrice: true,
    closingStockValue: '',
    closingStockMetalCode: '',
    closingStockLabel: '',
    /** Manual USD / troy oz — used when useLiveClosingPrice is false. */
    closingStockPriceOz: null,
    showClosedAccounts: false,
    excludeHedging: false,
    selectedGroup: '',
  }
}

export function buildClosingStockTrialRow(revaluation) {
  if (!revaluation || revaluation.omitted) return null
  const marketValue = Math.round(Number(revaluation.marketValue || 0) * 100) / 100
  const gold = (revaluation.metals || []).find((row) => row.metal === 'gold')
  const silver = (revaluation.metals || []).find((row) => row.metal === 'silver')
  return {
    accountCode: '',
    accountName: 'Closing stock (open metal at live price)',
    accountType: 'Asset',
    debit: 0,
    credit: 0,
    net: marketValue,
    goldDebit: 0,
    goldCredit: 0,
    goldNet: Number(gold?.netGrams || 0),
    silverDebit: 0,
    silverCredit: 0,
    silverNet: Number(silver?.netGrams || 0),
    platinumDebit: 0,
    platinumCredit: 0,
    platinumNet: 0,
    alloyDebit: 0,
    alloyCredit: 0,
    alloyNet: 0,
    unposted: true,
  }
}

const GRAMS_PER_TROY_OZ = 31.1034768

const CLOSING_STOCK_GRAM_KEYS = {
  XAU: 'gold',
  GOLD: 'gold',
  XAG: 'silver',
  SILVER: 'silver',
  XPT: 'platinum',
  PLAT: 'platinum',
  PLATINUM: 'platinum',
  ALLOY: 'alloy',
  ALLO: 'alloy',
}

function metalGrams(revaluation, metal) {
  const row = (revaluation?.metals || []).find((item) => item.metal === metal)
  return Number(row?.netGrams || 0)
}

/** Unposted closing-stock line for one created stock at a typed USD price per troy ounce. */
export function buildManualClosingStockRow(revaluation, { metalCode = 'XAU', price, label = '' } = {}) {
  const pricePerOz = Number(price)
  if (!revaluation || revaluation.omitted || !Number.isFinite(pricePerOz) || pricePerOz <= 0) return null
  const code = String(metalCode || '').trim().toUpperCase()
  const key = CLOSING_STOCK_GRAM_KEYS[code] || String(metalCode || 'gold').trim().toLowerCase()
  const grams = metalGrams(revaluation, key)
  const stockName = String(label || key).trim().toLowerCase() || key
  return {
    accountCode: '',
    accountName: `Closing stock (open ${stockName} at entered price)`,
    accountType: 'Asset',
    debit: 0,
    credit: 0,
    net: Math.round((grams / GRAMS_PER_TROY_OZ) * pricePerOz * 100) / 100,
    goldDebit: 0,
    goldCredit: 0,
    goldNet: key === 'gold' ? grams : 0,
    silverDebit: 0,
    silverCredit: 0,
    silverNet: key === 'silver' ? grams : 0,
    alloyNet: key === 'alloy' ? grams : 0,
    platinumNet: key === 'platinum' ? grams : 0,
    unposted: true,
    closingStockMetalCode: code,
    manualPricePerOz: pricePerOz,
  }
}

/** Unposted gold closing-stock line at a typed USD price per troy ounce. Silver is left out. */
export function buildManualGoldClosingStockRow(revaluation, pricePerOz) {
  return buildManualClosingStockRow(revaluation, { metalCode: 'XAU', price: pricePerOz, label: 'gold' })
}

/**
 * Resolve the Trial Balance closing-stock Net row from live vs manual price options.
 * Live → open metal at system/live rates (API unposted row or revaluation). Manual → one stock × entered USD/oz.
 */
export function resolveTrialClosingStockRow({
  calculateClosingStock = false,
  useLiveClosingPrice = true,
  revaluation = null,
  apiUnpostedRow = null,
  metalCode = '',
  price = null,
  label = '',
} = {}) {
  if (!calculateClosingStock) return null
  if (useLiveClosingPrice) {
    if (apiUnpostedRow && apiUnpostedRow.unposted) return apiUnpostedRow
    return buildClosingStockTrialRow(revaluation)
  }
  return buildManualClosingStockRow(revaluation, { metalCode, price, label })
}

const ROW_METAL_NET_KEYS = [
  { kind: 'gold', netKey: 'goldNet' },
  { kind: 'silver', netKey: 'silverNet' },
  { kind: 'platinum', netKey: 'platinumNet' },
  { kind: 'alloy', netKey: 'alloyNet' },
]

function roundTrialMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100
}

/** USD per gram by metal for live (revaluation + spot fallback) or one manual stock. */
export function resolveTrialMetalPricePerGram({
  useLiveClosingPrice = true,
  revaluation = null,
  livePrices = null,
  metalCode = '',
  priceOz = null,
} = {}) {
  if (useLiveClosingPrice) {
    const prices = { gold: 0, silver: 0, platinum: 0, alloy: 0 }
    for (const row of revaluation?.metals || []) {
      const kind = String(row?.metal || '').trim().toLowerCase()
      const perGram = Number(row?.pricePerGram || 0)
      if (kind && Number.isFinite(perGram) && perGram > 0) prices[kind] = perGram
    }
    const liveGold = Number(livePrices?.gold || 0)
    const liveSilver = Number(livePrices?.silver || 0)
    if (!(prices.gold > 0) && liveGold > 0) prices.gold = liveGold
    if (!(prices.silver > 0) && liveSilver > 0) prices.silver = liveSilver
    if (!(prices.gold > 0 || prices.silver > 0)) return null
    return prices
  }
  const pricePerOz = Number(priceOz)
  if (!Number.isFinite(pricePerOz) || pricePerOz <= 0) return null
  const code = String(metalCode || '').trim().toUpperCase()
  const key = CLOSING_STOCK_GRAM_KEYS[code] || String(metalCode || 'gold').trim().toLowerCase()
  return { [key]: pricePerOz / GRAMS_PER_TROY_OZ }
}

/** Market Net for one TB row from signed metal grams × USD/g. Null when no priced metal. */
export function metalMarketNetFromTrialRow(row = {}, pricesByMetal = {}) {
  let total = 0
  let priced = false
  for (const { kind, netKey } of ROW_METAL_NET_KEYS) {
    const grams = Number(row?.[netKey] || 0)
    const price = Number(pricesByMetal?.[kind] || 0)
    if (!Number.isFinite(grams) || grams === 0 || !(price > 0)) continue
    total += grams * price
    priced = true
  }
  if (!priced) return null
  return roundTrialMoney(total)
}

/**
 * When Calculate Closing Stock + live/manual price is on, replace Net on metal-bearing
 * posted rows with grams × price. Debit/credit stay book so TB totals stay balanced.
 */
export function applyTrialMetalPriceNets(rows = [], {
  calculateClosingStock = false,
  useLiveClosingPrice = true,
  revaluation = null,
  livePrices = null,
  metalCode = '',
  priceOz = null,
} = {}) {
  if (!calculateClosingStock || revaluation?.omitted) return rows
  const prices = resolveTrialMetalPricePerGram({
    useLiveClosingPrice,
    revaluation,
    livePrices,
    metalCode,
    priceOz,
  })
  if (!prices) return rows
  return (rows || []).map((row) => {
    if (!row || row.unposted) return row
    const marketNet = metalMarketNetFromTrialRow(row, prices)
    if (marketNet == null) return row
    return {
      ...row,
      bookNet: Number(row.net || 0),
      net: marketNet,
      metalPriced: true,
    }
  })
}

export function reportAccountGroup(row = {}) {
  if (row?.unposted) return ''
  const name = String(row?.accountName || '')
  if (/\(debtor\)|\bdebtor\b/i.test(name)) return 'debtor'
  if (/\(creditor\)|\bcreditor\b/i.test(name)) return 'creditor'
  const type = String(row?.accountType || '').trim().toLowerCase()
  if (type === 'income' || type === 'expense') return ''
  const lower = name.toLowerCase()
  if (lower.includes('bank')) return 'bank'
  if (lower.includes('cash')) return 'cash'
  return ''
}

export function filterTrialRowsByGroup(rows = [], group = '') {
  const selected = String(group || '').trim().toLowerCase()
  if (!selected) return rows
  return rows.filter((row) => reportAccountGroup(row) === selected)
}

export function reportDisplayPerUsd(displayCurrency, currencies = [], baseCurrency = 'USD') {
  const code = String(displayCurrency || baseCurrency).trim().toUpperCase()
  const base = String(baseCurrency || 'USD').trim().toUpperCase()
  if (!code || code === base) return 1
  const row = (currencies || []).find((currency) => (
    String(currency?.code || '').trim().toUpperCase() === code && currency?.isActive !== false
  ))
  const backend = Number(row?.exchangeRate)
  if (!Number.isFinite(backend) || backend <= 0) return null
  return backendRateToDisplayRate(backend, code, true)
}

export function convertReportUsd(amount, displayCurrency, currencies = [], baseCurrency = 'USD') {
  const perUsd = reportDisplayPerUsd(displayCurrency, currencies, baseCurrency)
  const value = Number(amount || 0)
  if (!Number.isFinite(value)) return 0
  if (perUsd == null) return value
  return value * perUsd
}

export function reportCurrencyChoices(currencies = [], baseCurrency = 'USD') {
  const base = String(baseCurrency || 'USD').trim().toUpperCase() || 'USD'
  const codes = [base]
  ;(currencies || []).forEach((currency) => {
    if (currency?.isActive === false) return
    const code = String(currency?.code || '').trim().toUpperCase()
    if (!code || codes.includes(code)) return
    if (code !== base && reportDisplayPerUsd(code, currencies, base) == null) return
    codes.push(code)
  })
  return codes
}

/**
 * Currencies offered in Reports (and Report Options) display filters.
 * Base + every active Currency Master row that has a usable rate
 * (VB: USD/AED; MG/CG/LoopC: USD/AED/UZS/EUR when rates exist).
 */
export function reportSelectableCurrencies(currencies = [], baseCurrency = 'USD') {
  const base = String(baseCurrency || 'USD').trim().toUpperCase() || 'USD'
  const picked = reportCurrencyChoices(currencies, base)
  return picked.length ? picked : [base]
}

export function reportMoneyHeaderLabels(currencyCode = '') {
  const code = String(currencyCode || '').trim().toUpperCase()
  const suffix = code ? ` (${code})` : ''
  return {
    debit: `Debit${suffix}`,
    credit: `Credit${suffix}`,
    net: `Net${suffix}`,
  }
}

export function reportMoneyColumns({ showNetOnly = false, hideNet = false } = {}) {
  if (showNetOnly) return { debit: false, credit: false, net: true }
  return {
    debit: true,
    credit: true,
    net: !hideNet,
  }
}

export function trialMoneyHeaders(columns = DEFAULT_REPORT_MONEY_COLUMNS, labels = {}) {
  const names = { debit: 'Debit', credit: 'Credit', net: 'Net', ...labels }
  const headers = []
  if (columns.debit !== false) headers.push(names.debit)
  if (columns.credit !== false) headers.push(names.credit)
  if (columns.net !== false) headers.push(names.net)
  return headers
}

export function formatReportGrams(net) {
  const value = Number(net || 0)
  if (!Number.isFinite(value) || Math.abs(value) < 0.0005) return ''
  const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  return `${abs} ${value < 0 ? 'Cr' : 'Dr'}`
}

/** Metal codes that Trial Balance / Summary expose as gram columns. */
const TRIAL_METAL_GRAM_CODES = new Set(['XAU', 'XAG', 'XPT', 'ALLOY'])

export const TRIAL_METAL_KIND_DEFS = [
  { kind: 'gold', code: 'XAU', header: 'Gold g', netKey: 'goldNet' },
  { kind: 'silver', code: 'XAG', header: 'Silver g', netKey: 'silverNet' },
  { kind: 'platinum', code: 'XPT', header: 'Platinum g', netKey: 'platinumNet' },
  { kind: 'alloy', code: 'ALLOY', header: 'Alloy g', netKey: 'alloyNet' },
]

/** Stock-type options that can affect Trial/Summary metal gram columns. */
export function filterTrialMetalGramOptions(stockTypeOptions = []) {
  return (Array.isArray(stockTypeOptions) ? stockTypeOptions : []).filter((option) => (
    TRIAL_METAL_GRAM_CODES.has(String(option?.metalCode || '').trim().toUpperCase())
  ))
}

/** Clear metalType when it is not a supported trial gram metal. */
export function sanitizeTrialMetalType(metalType, stockTypeOptions = []) {
  const value = String(metalType || '').trim()
  if (!value) return ''
  const allowed = filterTrialMetalGramOptions(stockTypeOptions)
  return allowed.some((option) => option.value === value) ? value : ''
}

/** Which gram columns to show: all when empty, else only the selected metal. */
export function resolveVisibleTrialMetalKinds(metalType = '') {
  const code = String(metalType || '').split('::')[0].trim().toUpperCase()
  if (!code || code === 'ALL') return TRIAL_METAL_KIND_DEFS.map((def) => def.kind)
  const match = TRIAL_METAL_KIND_DEFS.find((def) => def.code === code)
  return match ? [match.kind] : TRIAL_METAL_KIND_DEFS.map((def) => def.kind)
}

export function trialMetalHeaders(showMetal = false, metalType = '') {
  if (!showMetal) return []
  const visible = new Set(resolveVisibleTrialMetalKinds(metalType))
  return TRIAL_METAL_KIND_DEFS.filter((def) => visible.has(def.kind)).map((def) => def.header)
}

export function trialMetalValues(row, showMetal = false, metalType = '') {
  if (!showMetal) return []
  const visible = new Set(resolveVisibleTrialMetalKinds(metalType))
  return TRIAL_METAL_KIND_DEFS
    .filter((def) => visible.has(def.kind))
    .map((def) => formatReportGrams(row?.[def.netKey]))
}

export function trialMoneyValues(row, columns = DEFAULT_REPORT_MONEY_COLUMNS, format = (value) => value) {
  const values = []
  if (columns.debit !== false) values.push(row?.unposted ? '' : format(row?.debit))
  if (columns.credit !== false) values.push(row?.unposted ? '' : format(row?.credit))
  if (columns.net !== false) values.push(format(row?.net))
  return values
}
