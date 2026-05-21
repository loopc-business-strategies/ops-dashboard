/**
 * Mirrors backend/services/erpAccounting/metalMarginPolicy.js
 * `shouldSuppressSpotMetalMtmForAccountEnquiry` — keep behaviour in sync with tests there.
 */

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
