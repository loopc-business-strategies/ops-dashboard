const CACHE_TTL_MS = 3 * 60 * 1000

function normalizeWindowPart(value) {
  return String(value || '').trim()
}

export function buildAccountEnquiryCacheKey(tenant, accountCode, window = {}) {
  const code = String(accountCode || '').trim().toUpperCase()
  const startDate = normalizeWindowPart(window.startDate)
  const endDate = normalizeWindowPart(window.endDate)
  const statementLimit = Number(window.statementLimit) || 500
  return `erp-account-enquiry:${String(tenant || 'default').toLowerCase()}:${code}:${startDate}:${endDate}:${statementLimit}`
}

function cacheKey(tenant, accountCode, window) {
  return buildAccountEnquiryCacheKey(tenant, accountCode, window)
}

export function readAccountEnquiryCache(tenant, accountCode, window = {}) {
  try {
    const raw = sessionStorage.getItem(cacheKey(tenant, accountCode, window))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.data || !parsed?.savedAt) return null
    if (Date.now() - Number(parsed.savedAt) > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

export function clearAccountEnquiryCache() {
  try {
    const storage = sessionStorage
    const keys = []
    for (let i = 0; i < storage.length; i += 1) {
      const key = storage.key(i)
      if (key && key.startsWith('erp-account-enquiry:')) keys.push(key)
    }
    keys.forEach((key) => storage.removeItem(key))
  } catch {
    /* ignore */
  }
}

export function writeAccountEnquiryCache(tenant, accountCode, data, window = {}) {
  try {
    sessionStorage.setItem(cacheKey(tenant, accountCode, window), JSON.stringify({
      data,
      savedAt: Date.now(),
    }))
  } catch {
    /* ignore quota errors */
  }
}
