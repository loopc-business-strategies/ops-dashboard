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

/**
 * Sum booked unfixed voucher currency exposure from posted sale/purchase transactions.
 * Used for creditor/vendor AP where spot × grams is misleading.
 *
 * @param {Array<{ type?: string, amount?: number|string, exchangeRate?: number|string, voucherMeta?: object }>} transactions
 * @returns {{ gold: number, silver: number, total: number }}
 */
function computeBookedUnfixedRevaluationFromTransactions(transactions = []) {
  let gold = 0
  let silver = 0
  const isUnfixed = (tx) => {
    const normalized = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || '').trim().toLowerCase()
    return ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)
  }
  const resolveMetalCode = (lines = []) => {
    for (const line of lines) {
      const stockText = String(line?.stockCode || '').trim().toUpperCase()
      if (stockText.includes('XAG') || stockText.includes('SILV')) return 'XAG'
      if (stockText.includes('XAU') || stockText.includes('GOLD')) return 'XAU'
    }
    return 'XAU'
  }

  for (const tx of transactions) {
    const txType = String(tx?.type || '').trim().toLowerCase()
    if (txType !== 'sale' && txType !== 'purchase') continue
    if (!isUnfixed(tx)) continue
    const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
    const voucherAmount = Math.abs(
      Number(tx?.amount || tx?.voucherMeta?.grandTotal || 0) * Number(tx?.exchangeRate || 1),
    )
    if (!Number.isFinite(voucherAmount) || voucherAmount <= 0) continue
    const sign = txType === 'purchase' ? 1 : -1
    const signedAmount = voucherAmount * sign
    const metalCode = resolveMetalCode(lines)
    if (metalCode === 'XAG') silver += signedAmount
    else gold += signedAmount
  }

  return { gold, silver, total: gold + silver }
}

module.exports = {
  shouldSuppressSpotMetalMtmForCustomerDashboard,
  shouldSuppressSpotMetalMtmForSupplierDashboard,
  shouldSuppressSpotMetalMtmForAccountEnquiry,
  computeMarginMetricsRaw,
  computeBookedUnfixedRevaluationFromTransactions,
}
