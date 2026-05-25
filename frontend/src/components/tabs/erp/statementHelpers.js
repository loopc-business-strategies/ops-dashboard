const STANDARD_METAL_CODES = new Set(['XAU', 'XAG', 'XPT', 'XPD'])

export const DEFAULT_STATEMENT_METAL_OPTIONS = [
  'Gold',
  'Silver',
  'Platinum',
  'Palladium',
  'Other',
]

export function isMetalStatementEntry(entry = {}) {
  const sourceType = String(entry?.sourceTransactionType || entry?.referenceType || entry?.metalDealType || '').toLowerCase()
  return Boolean(
    entry?.isMetalTrade
    || entry?.isMetalTransfer
    || ['sale', 'purchase', 'metal_receipt', 'metal_payment'].includes(sourceType),
  )
}

export function resolveMetalCodeFromStockName(name) {
  const normalized = String(name || '').trim().toLowerCase()
  if (normalized === 'xau' || normalized === 'gold') return 'XAU'
  if (normalized === 'xag' || normalized === 'silver') return 'XAG'
  if (normalized === 'xpt' || normalized === 'platinum') return 'XPT'
  if (normalized === 'xpd' || normalized === 'palladium') return 'XPD'
  if (normalized === 'other' || normalized === 'others' || normalized === 'misc') return 'OTHER'
  return normalized.toUpperCase()
}

export function resolveStatementMetalCode(entry = {}) {
  const explicit = String(entry?.metalCode || '').trim().toUpperCase()
  if (explicit) return explicit

  const text = `${String(entry?.description || '')} ${String(entry?.offsetAccountName || '')} ${String(entry?.offsetAccountCode || '')}`.toLowerCase()
  if (/\bxau\b|\bgold\b/.test(text)) return 'XAU'
  if (/\bxag\b|\bsilver\b/.test(text)) return 'XAG'
  if (/\bxpt\b|\bplatinum\b/.test(text)) return 'XPT'
  if (/\bxpd\b|\bpalladium\b/.test(text)) return 'XPD'

  return Number(entry?.metalSignedWeight || 0) !== 0 ? 'OTHER' : '-'
}

export function isOtherStatementMetalCode(metalCode) {
  const normalized = String(metalCode || '').trim().toUpperCase()
  return Boolean(normalized && normalized !== '-' && !STANDARD_METAL_CODES.has(normalized))
}

export function matchesStatementMetal(entry = {}, selectedMetal) {
  const selected = resolveMetalCodeFromStockName(selectedMetal)
  if (!selected) return true
  const entryMetalCode = resolveStatementMetalCode(entry)
  if (selected === 'OTHER') return isOtherStatementMetalCode(entryMetalCode)
  return entryMetalCode === selected
}

export function resolveStatementMetalBalance(metals = {}, selectedMetalCode, entries = []) {
  const metalCode = String(selectedMetalCode || '').trim().toUpperCase()
  if (metalCode === 'XAG') return Number(metals?.silverBalance || 0)
  if (metalCode === 'XAU') return Number(metals?.goldBalance || 0)

  return entries.reduce((sum, entry) => {
    if (!matchesStatementMetal(entry, metalCode)) return sum
    return sum + Number(entry?.metalSignedWeight || 0)
  }, 0)
}

export function normalizeStatementCurrencyCode(value = '') {
  const code = String(value || '').trim().toUpperCase()
  if (['SOM', 'SOMS', 'SUM'].includes(code)) return 'UZS'
  return code
}

export function buildStatementCurrencyOptions({
  currencies = [],
  accountCurrency = '',
  rateCurrency = '',
  baseCurrency = '',
  modalCurrency = 'USD',
  includeAll = false,
} = {}) {
  const values = [
    includeAll ? 'ALL' : '',
    accountCurrency,
    rateCurrency,
    baseCurrency,
    modalCurrency,
    ...currencies.map((currency) => currency?.code),
  ]

  return Array.from(new Set(values
    .map((value) => normalizeStatementCurrencyCode(value))
    .filter(Boolean)))
}

export function buildStatementMetalOptions(stockTypeOptions = []) {
  const inventoryOptions = Array.from(new Map(
    (stockTypeOptions || [])
      .map((stock) => String(stock?.mainStock || '').trim())
      .filter(Boolean)
      .map((mainStock) => [mainStock.toLowerCase(), mainStock]),
  ).values())

  return Array.from(new Map(
    [...inventoryOptions, ...DEFAULT_STATEMENT_METAL_OPTIONS]
      .map((name) => [String(name).trim().toLowerCase(), String(name).trim()])
      .filter(([, name]) => Boolean(name)),
  ).values())
}

export function resolveExposureDirection(value) {
  const amount = Number(value || 0)
  if (amount > 0) return 'Debit'
  if (amount < 0) return 'Credit'
  return 'Flat'
}

export function calculateAccountSummaryMetrics({
  totalFunds = 0,
  revaluation = 0,
  marginAmount = 0,
} = {}) {
  const signedFunds = Number(totalFunds || 0)
  const revaluationValue = Number(revaluation || 0)
  const marginValue = Math.abs(Number(marginAmount || 0))
  const fundsExposure = Math.abs(signedFunds)
  const netEquity = signedFunds + revaluationValue
  const excess = netEquity - marginValue
  const marginPercent = marginValue > 0 ? (fundsExposure / marginValue) * 100 : 0

  return {
    fundsExposure,
    netEquity,
    excess,
    marginPercent,
  }
}
