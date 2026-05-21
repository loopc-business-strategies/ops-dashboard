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

module.exports = {
  shouldSuppressSpotMetalMtmForCustomerDashboard,
  shouldSuppressSpotMetalMtmForSupplierDashboard,
  shouldSuppressSpotMetalMtmForAccountEnquiry,
  computeMarginMetricsRaw,
}
