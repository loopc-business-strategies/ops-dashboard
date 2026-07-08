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

export const DEFAULT_STATEMENT_DISPLAY_CURRENCIES = ['USD', 'EUR', 'AED', 'UZS']

export function buildStatementCurrencyOptions({
  currencies = [],
  accountCurrency = '',
  rateCurrency = '',
  baseCurrency = '',
  modalCurrency = 'USD',
  includeAll = false,
} = {}) {
  const activeCurrencyCodes = (currencies || [])
    .filter((currency) => currency?.isActive !== false)
    .map((currency) => currency?.code)

  const configuredCodes = activeCurrencyCodes.length
    ? activeCurrencyCodes
    : DEFAULT_STATEMENT_DISPLAY_CURRENCIES

  const values = [
    includeAll ? 'ALL' : '',
    accountCurrency,
    rateCurrency,
    baseCurrency,
    modalCurrency,
    ...configuredCodes,
  ]

  const unique = Array.from(new Set(values
    .map((value) => normalizeStatementCurrencyCode(value))
    .filter(Boolean)))

  return unique.sort((left, right) => {
    if (left === 'ALL') return -1
    if (right === 'ALL') return 1
    if (left === 'USD') return -1
    if (right === 'USD') return 1
    return left.localeCompare(right)
  })
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

export function resolveUnfixedBookedExposureSign(entry = {}) {
  const dealSide = String(
    entry?.metalDealType || entry?.sourceTransactionType || entry?.referenceType || '',
  ).trim().toLowerCase()
  if (dealSide === 'purchase') return 1
  if (dealSide === 'sale') return -1
  const signedAmount = Number(entry?.signedAmount || 0)
  if (signedAmount < 0) return -1
  if (signedAmount > 0) return 1
  return 0
}

/** Prefer ledger debit/credit on this account over raw transaction totals. */
export function resolveBookedLedgerAmount(entry = {}) {
  const postedAmount = Math.abs(Number(
    entry?.signedAmount || entry?.debitAmount || entry?.creditAmount || 0,
  ))
  const voucherAmount = Math.abs(Number(entry?.unfixedVoucherAmount || 0))
  if (Number.isFinite(postedAmount) && postedAmount > 0) return postedAmount
  if (Number.isFinite(voucherAmount) && voucherAmount > 0) return voucherAmount
  return 0
}

/**
 * Sum unfixed metal voucher exposure by metal code.
 * - `unpriced`: only the voucher amount not yet posted to the ledger (debtor / trading).
 * - `booked`: ledger-posted amount on this account (creditor / vendor AP), falling back to voucher when unposted.
 */
export function accumulateUnfixedVoucherRevaluationByMetal(
  entries = [],
  {
    mode = 'unpriced',
    resolveFixStatus = () => '',
    isMetalEntry = () => false,
    resolveMetalCode = () => '-',
  } = {},
) {
  const seenBookedTransactions = new Set()

  return entries.reduce((acc, entry) => {
    if (resolveFixStatus(entry) !== 'unfixed') return acc
    if (!isMetalEntry(entry)) return acc

    const dealSide = String(
      entry?.metalDealType || entry?.sourceTransactionType || entry?.referenceType || '',
    ).trim().toLowerCase()
    if (dealSide !== 'sale' && dealSide !== 'purchase') return acc

    const voucherAmount = Math.abs(Number(entry?.unfixedVoucherAmount || 0))
    const postedAmount = Math.abs(Number(
      entry?.signedAmount || entry?.debitAmount || entry?.creditAmount || 0,
    ))

    let signedAmount = 0
    if (mode === 'booked') {
      const txKey = String(entry?.sourceTransactionId || entry?._id || '').trim()
      if (txKey) {
        if (seenBookedTransactions.has(txKey)) return acc
        seenBookedTransactions.add(txKey)
      }
      const bookedAmount = resolveBookedLedgerAmount(entry)
      if (!Number.isFinite(bookedAmount) || bookedAmount <= 0) return acc
      const sign = resolveUnfixedBookedExposureSign(entry)
      if (!sign) return acc
      signedAmount = bookedAmount * sign
    } else {
      if (!Number.isFinite(voucherAmount) || voucherAmount <= 0) return acc
      const unpricedAmount = Number(Math.max(voucherAmount - postedAmount, 0).toFixed(2))
      if (unpricedAmount <= 0) return acc
      const exposureSign = Number(entry?.signedAmount || 0) < 0 ? -1 : 1
      signedAmount = unpricedAmount * exposureSign
    }

    const metalCode = resolveMetalCode(entry)
    if (metalCode === 'XAG') acc.silver += signedAmount
    else if (metalCode === 'XAU') acc.gold += signedAmount
    else acc.other += signedAmount
    return acc
  }, { gold: 0, silver: 0, other: 0 })
}

export function resolveStatementSignedAmount(entry = {}) {
  const signed = Number(entry?.signedAmount)
  if (Number.isFinite(signed) && signed !== 0) return signed
  return Number(entry?.debitAmount || 0) - Number(entry?.creditAmount || 0)
}

const EXPORT_DEAL_RANK = {
  purchase: 10,
  sale: 20,
  metal_receipt: 30,
  metal_payment: 40,
}

export function resolveStatementExportDealRank(entry = {}) {
  const deal = String(
    entry?.metalDealType || entry?.sourceTransactionType || entry?.referenceType || '',
  ).trim().toLowerCase()
  return EXPORT_DEAL_RANK[deal] ?? 50
}

/** Oldest-first export order: date, then business deal sequence, then receipt/doc no. */
export function sortStatementEntriesForExport(entries = [], resolveReceiptNo = (entry) => String(entry?._id || '')) {
  return [...entries].sort((left, right) => {
    const leftDate = left?.date ? new Date(left.date).getTime() : 0
    const rightDate = right?.date ? new Date(right.date).getTime() : 0
    if (leftDate !== rightDate) return leftDate - rightDate
    const rankDiff = resolveStatementExportDealRank(left) - resolveStatementExportDealRank(right)
    if (rankDiff !== 0) return rankDiff
    return String(resolveReceiptNo(left)).localeCompare(
      String(resolveReceiptNo(right)),
      undefined,
      { numeric: true, sensitivity: 'base' },
    )
  })
}

/**
 * Derive Balance B/F for PDF/print export from closing balances minus in-period movement.
 * Avoids reusing API running balances that are computed newest-first.
 */
export function computeStatementExportOpeningBalances({
  exportEntries = [],
  closingNetBalance = 0,
  closingPureWeight = 0,
  matchesMetalEntry = () => true,
} = {}) {
  const totalSignedUsdMovement = exportEntries.reduce(
    (sum, entry) => sum + resolveStatementSignedAmount(entry),
    0,
  )
  const totalPureWeightMovement = exportEntries.reduce((sum, entry) => {
    if (!matchesMetalEntry(entry)) return sum
    return sum + Number(entry?.metalSignedWeight || 0)
  }, 0)

  const closingUsdBalance = Number(closingNetBalance || 0)
  const closingPure = Number(closingPureWeight || 0)

  return {
    openingUsdBalance: closingUsdBalance - totalSignedUsdMovement,
    openingPureWeight: closingPure - totalPureWeightMovement,
    closingUsdBalance,
    closingPureWeight: closingPure,
    totalSignedUsdMovement,
    totalPureWeightMovement,
  }
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

export function formatMarginExcessDisplay(value, formatValue = (amount) => String(amount)) {
  const num = Number(value || 0)
  if (Math.abs(num) < 0.005) return formatValue(0)
  if (num > 0) return `Excess ${formatValue(num)}`
  return `Short ${formatValue(Math.abs(num))}`
}

/** Below this, account enquiry treats margin as absent for Short/Favorable wording. */
export const ACCOUNT_ENQUIRY_NEGLIGIBLE_MARGIN = 0.005

export function normalizeAccountEnquiryNetDirection(netDirection) {
  const raw = String(netDirection || '').trim().toLowerCase()
  if (raw === 'credit' || raw === 'cr') return 'credit'
  if (raw === 'debit' || raw === 'dr') return 'debit'
  return 'flat'
}

/**
 * Account Details (enquiry) excess label: when margin @ 2% is ~zero, a credit-direction
 * ledger balance must not be labeled "Short" — that is favorable prepayment / liability credit.
 */
export function formatAccountEnquiryExcessDisplay({
  excess = 0,
  marginAmount = 0,
  netDirection = '',
  formatValue = (amount) => String(amount),
} = {}) {
  const marginValue = Math.abs(Number(marginAmount || 0))
  const excessNum = Number(excess || 0)
  if (marginValue >= ACCOUNT_ENQUIRY_NEGLIGIBLE_MARGIN) {
    return formatMarginExcessDisplay(excessNum, formatValue)
  }
  if (Math.abs(excessNum) < ACCOUNT_ENQUIRY_NEGLIGIBLE_MARGIN) return formatValue(0)
  if (normalizeAccountEnquiryNetDirection(netDirection) === 'credit' && excessNum < 0) {
    return `Favorable ${formatValue(Math.abs(excessNum))}`
  }
  return formatMarginExcessDisplay(excessNum, formatValue)
}

/** Color for signed enquiry metrics (net equity, excess): credit + no margin + negative signed => favorable green. */
export function getAccountEnquirySignedMetricColor(value, { marginAmount = 0, netDirection = '' } = {}) {
  const num = Number(value || 0)
  const marginValue = Math.abs(Number(marginAmount || 0))
  if (
    marginValue < ACCOUNT_ENQUIRY_NEGLIGIBLE_MARGIN
    && normalizeAccountEnquiryNetDirection(netDirection) === 'credit'
    && num < 0
  ) {
    return '#15803d'
  }
  return num >= 0 ? '#111827' : '#c0392b'
}
