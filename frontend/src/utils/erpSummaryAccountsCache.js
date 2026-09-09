import { filterActiveAccounts } from '../components/tabs/erp/accountDropdownHelpers'

const CACHE_TTL_MS = 5 * 60 * 1000
const SUMMARY_PREFIX = 'erp-summary-accounts:'

function cacheKey(tenant) {
  return `${SUMMARY_PREFIX}${String(tenant || 'default').toLowerCase()}`
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

export function clearSummaryAccountsCache() {
  try {
    const storage = sessionStorage
    const keys = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith(SUMMARY_PREFIX)) keys.push(key)
    }
    keys.forEach((key) => storage.removeItem(key))
  } catch {
    /* ignore */
  }
}

/** Clears ERP dashboard widget layout keys (`erp_dash_*`). */
export function clearErpDashLayoutCache() {
  try {
    const keys = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && key.startsWith('erp_dash_')) keys.push(key)
    }
    keys.forEach((key) => localStorage.removeItem(key))
  } catch {
    /* ignore */
  }
}
