import { filterActiveAccounts } from '../components/tabs/erp/accountDropdownHelpers'

const CACHE_TTL_MS = 5 * 60 * 1000

function cacheKey(tenant) {
  return `erp-summary-accounts:${String(tenant || 'default').toLowerCase()}`
}

export function readSummaryAccountsCache(tenant) {
  try {
    const raw = sessionStorage.getItem(cacheKey(tenant))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.accounts || !parsed?.savedAt) return null
    if (Date.now() - Number(parsed.savedAt) > CACHE_TTL_MS) return null
    return filterActiveAccounts(parsed.accounts)
  } catch {
    return null
  }
}

export function writeSummaryAccountsCache(tenant, accounts) {
  try {
    sessionStorage.setItem(cacheKey(tenant), JSON.stringify({
      accounts: filterActiveAccounts(Array.isArray(accounts) ? accounts : []),
      savedAt: Date.now(),
    }))
  } catch {
    /* ignore quota errors */
  }
}
