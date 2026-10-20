/**
 * Mirrors backend/services/erpAccounting/metalMarginPolicy.js
 * Keep behaviour in sync with backend/tests/metalMarginPolicy.test.js
 */

/**
 * @param {string} [accountType]
 */
export function shouldSuppressSpotMetalMtmForCustomerDashboard(accountType) {
  return String(accountType || '').trim().toLowerCase() === 'liability'
}

/** Supplier / vendor margin: AP in currency; gram positions are informational only. */
export function shouldSuppressSpotMetalMtmForSupplierDashboard() {
  return true
}

/**
 * @param {{ accountType?: string, accountName?: string, description?: string } | null | undefined} account
 */
export function shouldSuppressSpotMetalMtmForAccountEnquiry(account) {
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
 * Historically used to flip Account Summary funds for debtor enquiry.
 * Account Summary now uses ledger net as-is; helper kept for Customer Margin cues / tests.
 *
 * @param {{ accountType?: string, accountName?: string, description?: string } | null | undefined} account
 */
export function shouldUseCustomerMarginFundsSignForAccountEnquiry(account) {
  if (!account || typeof account !== 'object') return false
  if (shouldSuppressSpotMetalMtmForAccountEnquiry(account)) return false
  const acctName = String(account.accountName || '')
  const acctDesc = String(account.description || '')
  const combined = `${acctName} ${acctDesc}`.toLowerCase()
  return Boolean(
    /\(debtor\)/i.test(acctName)
      || /\bdebtor\b/i.test(acctName)
      || /\bcustomer\b/i.test(combined)
      || /receivable account for customer/i.test(combined),
  )
}

/** Default required margin rate on Chart of Accounts (2 = 2%). */
export const DEFAULT_MARGIN_RATE_PERCENT = 2

/**
 * Resolve the account's required margin rate percent (2 → 2%).
 * Invalid / missing values fall back to the default.
 */
export function resolveMarginRatePercent(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return DEFAULT_MARGIN_RATE_PERCENT
  return n
}

/**
 * Raw margin math (numbers). Callers apply formatting.
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
 *   marginRatePercent?: number|string,
 * }} params
 */
export function computeMarginMetricsRaw({
  totalFunds,
  goldPosition,
  silverPosition,
  goldPrice,
  silverPrice,
  suppressMetalSpotMtm = false,
  revaluationOverride = null,
  fundsMode = 'asIs',
  marginRatePercent = DEFAULT_MARGIN_RATE_PERCENT,
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

  const ratePercent = resolveMarginRatePercent(marginRatePercent)
  const margin = Math.abs(revaluation) * (ratePercent / 100)
  const equity = funds + revaluation
  const excess = equity - margin
  const marginPercent = margin > 0 ? (equity / margin) * 100 : 0
  const status = equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL'

  return {
    funds,
    revaluation,
    margin,
    equity,
    excess,
    marginPercent,
    marginRatePercent: ratePercent,
    status,
  }
}
