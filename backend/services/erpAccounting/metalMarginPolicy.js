/**
 * Central rules for ERP margin rows and account-enquiry spot MTM.
 * Keep vendor AP / creditor liability behaviour aligned across APIs and UI
 * (see backend/tests/metalMarginPolicy.test.js).
 */

/**
 * @param {string} [accountType]
 * @returns {boolean}
 */
function shouldSuppressSpotMetalMtmForCustomerDashboard(accountType) {
  return String(accountType || '').trim().toLowerCase() === 'liability'
}

/** Supplier / vendor margin APIs: AP in currency; grams are informational only. */
function shouldSuppressSpotMetalMtmForSupplierDashboard() {
  return true
}

/**
 * Account enquiry modal: hide misleading spot×grams for creditor/vendor AP.
 * @param {{ accountType?: string, accountName?: string, description?: string } | null | undefined} account
 */
function shouldSuppressSpotMetalMtmForAccountEnquiry(account) {
  if (!account || typeof account !== 'object') return false
  const accountTypeLower = String(account.accountType || '').trim().toLowerCase()
  if (accountTypeLower !== 'liability') return false
  const acctName = String(account.accountName || '')
  const acctDesc = String(account.description || '')
  const combined = `${acctName} ${acctDesc}`.toLowerCase()
  return Boolean(
    /\(creditor\)/i.test(acctName)
      || /\bcreditor\b/i.test(acctName)
      || /\bvendor\b/i.test(acctDesc)
      || /payable account for vendor/i.test(combined),
  )
}

/**
 * Raw margin math (numbers). Callers apply `toMoney` / formatting.
 *
 * @param {{
 *   totalFunds?: number|string,
 *   goldPosition?: number|string,
 *   silverPosition?: number|string,
 *   goldPrice?: number|string,
 *   silverPrice?: number|string,
 *   suppressMetalSpotMtm?: boolean,
 *   revaluationOverride?: number|string|null,
 *   fundsMode?: 'asIs' | 'customerAbsIfNegative',
 * }} params
 */
function computeMarginMetricsRaw({
  totalFunds,
  goldPosition,
  silverPosition,
  goldPrice,
  silverPrice,
  suppressMetalSpotMtm = false,
  revaluationOverride = null,
  fundsMode = 'asIs',
}) {
  const rawFunds = Number(totalFunds || 0)
  const funds = fundsMode === 'customerAbsIfNegative' && rawFunds < 0 ? Math.abs(rawFunds) : rawFunds

  let revaluation
  if (revaluationOverride !== null && revaluationOverride !== undefined) {
    revaluation = Number(revaluationOverride || 0)
  } else if (suppressMetalSpotMtm) {
    revaluation = 0
  } else {
    revaluation = (Number(goldPosition || 0) * Number(goldPrice || 0))
      + (Number(silverPosition || 0) * Number(silverPrice || 0))
  }

  const margin = Math.abs(revaluation) * 0.02
  const equity = funds + revaluation
  const excess = equity - margin
  const marginPercent = margin > 0 ? (Math.abs(funds) / margin) * 100 : 0
  const status = equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL'

  return {
    funds,
    revaluation,
    margin,
    equity,
    excess,
    marginPercent,
    status,
  }
}

const UNFIXED_FIXING_TYPES = new Set(['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'])

function normalizeUnfixedFixingStatus(value = '') {
  const normalized = String(value || '').trim().toLowerCase()
  return UNFIXED_FIXING_TYPES.has(normalized) ? 'unfixed' : ''
}

function resolveBookedExposureSign(dealType = '', signedAmount = 0) {
  const dealSide = String(dealType || '').trim().toLowerCase()
  if (dealSide === 'purchase') return 1
  if (dealSide === 'sale') return -1
  const signed = Number(signedAmount || 0)
  if (signed < 0) return -1
  if (signed > 0) return 1
  return 0
}

function resolveBookedLedgerAmountFromRow(row = {}) {
  const postedAmount = Math.abs(Number(
    row?.signedAmount || row?.debitAmount || row?.creditAmount || 0,
  ))
  const voucherAmount = Math.abs(Number(row?.unfixedVoucherAmount || 0))
  if (Number.isFinite(postedAmount) && postedAmount > 0) return postedAmount
  if (Number.isFinite(voucherAmount) && voucherAmount > 0) return voucherAmount
  return 0
}

/**
 * Sum booked unfixed exposure from account-enquiry statement rows.
 * Uses ledger debit/credit on the account, not raw transaction totals.
 *
 * @param {Array<object>} rows
 * @returns {{ gold: number, silver: number, total: number }}
 */
function computeBookedUnfixedRevaluationFromStatementRows(rows = []) {
  const grouped = new Map()

  for (const row of rows) {
    if (normalizeUnfixedFixingStatus(row?.metalFixStatus) !== 'unfixed') continue
    if (!row?.isMetalTrade) continue

    const dealType = String(
      row?.sourceTransactionType || row?.metalDealType || row?.referenceType || '',
    ).trim().toLowerCase()
    if (dealType !== 'sale' && dealType !== 'purchase') continue

    const txKey = String(row?.sourceTransactionId || row?._id || '').trim()
      || `${String(row?.date || '')}:${dealType}:${String(row?.metalCode || 'XAU')}`
    const bucket = grouped.get(txKey) || {
      dealType,
      metalCode: String(row?.metalCode || 'XAU').trim().toUpperCase() || 'XAU',
      posted: 0,
      voucher: 0,
      signedAmount: 0,
    }
    bucket.posted += Math.abs(Number(
      row?.signedAmount || row?.debitAmount || row?.creditAmount || 0,
    ))
    bucket.voucher = Math.max(
      bucket.voucher,
      Math.abs(Number(row?.unfixedVoucherAmount || 0)),
    )
    if (!bucket.signedAmount && Number(row?.signedAmount || 0)) {
      bucket.signedAmount = Number(row.signedAmount || 0)
    }
    if (row?.metalCode) bucket.metalCode = String(row.metalCode).trim().toUpperCase()
    grouped.set(txKey, bucket)
  }

  let gold = 0
  let silver = 0
  for (const bucket of grouped.values()) {
    const bookedAmount = bucket.posted > 0 ? bucket.posted : bucket.voucher
    if (!Number.isFinite(bookedAmount) || bookedAmount <= 0) continue
    const sign = resolveBookedExposureSign(bucket.dealType, bucket.signedAmount)
    if (!sign) continue
    const signedAmount = bookedAmount * sign
    if (bucket.metalCode === 'XAG') silver += signedAmount
    else gold += signedAmount
  }

  return { gold, silver, total: gold + silver }
}

/**
 * @deprecated Prefer computeBookedUnfixedRevaluationFromStatementRows for account enquiry.
 */
function computeBookedUnfixedRevaluationFromTransactions(transactions = []) {
  return computeBookedUnfixedRevaluationFromStatementRows(
    transactions.map((tx) => {
      const txType = String(tx?.type || '').trim().toLowerCase()
      const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
      const metalCode = lines.some((line) => {
        const stockText = String(line?.stockCode || '').trim().toUpperCase()
        return stockText.includes('XAG') || stockText.includes('SILV')
      }) ? 'XAG' : 'XAU'
      return {
        sourceTransactionId: String(tx?._id || ''),
        sourceTransactionType: txType,
        metalDealType: txType,
        metalFixStatus: normalizeUnfixedFixingStatus(tx?.voucherMeta?.fixingType || tx?.metalFixStatus),
        isMetalTrade: true,
        metalCode,
        unfixedVoucherAmount: Math.abs(
          Number(tx?.amount || tx?.voucherMeta?.grandTotal || 0) * Number(tx?.exchangeRate || 1),
        ),
        signedAmount: 0,
        debitAmount: 0,
        creditAmount: 0,
      }
    }),
  )
}

module.exports = {
  shouldSuppressSpotMetalMtmForCustomerDashboard,
  shouldSuppressSpotMetalMtmForSupplierDashboard,
  shouldSuppressSpotMetalMtmForAccountEnquiry,
  computeMarginMetricsRaw,
  computeBookedUnfixedRevaluationFromStatementRows,
  computeBookedUnfixedRevaluationFromTransactions,
}
