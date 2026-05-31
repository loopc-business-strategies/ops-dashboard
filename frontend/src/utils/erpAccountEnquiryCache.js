const CACHE_TTL_MS = 3 * 60 * 1000

function cacheKey(tenant, accountCode) {
  const code = String(accountCode || '').trim().toUpperCase()
  return `erp-account-enquiry:${String(tenant || 'default').toLowerCase()}:${code}`
}

export function readAccountEnquiryCache(tenant, accountCode) {
  try {
    const raw = sessionStorage.getItem(cacheKey(tenant, accountCode))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data || !parsed?.savedAt) return null
    if (Date.now() - Number(parsed.savedAt) > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

export function writeAccountEnquiryCache(tenant, accountCode, data) {
  try {
    sessionStorage.setItem(cacheKey(tenant, accountCode), JSON.stringify({
      data,
      savedAt: Date.now(),
    }))
  } catch {
    /* ignore quota errors */
  }
}
