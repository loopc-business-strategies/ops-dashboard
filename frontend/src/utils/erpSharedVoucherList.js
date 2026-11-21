import erpAccountingAPI from '../api/erp-accounting'
import { CATALOG_KINDS, deleteCachedCatalog, fetchCatalogCached, getCachedCatalog } from './erpCatalogCache'

const VOUCHER_LIST_TTL_MS = 45_000
/** API caps limit at 200 — page until All years / All months includes early Doc Nos. */
const VOUCHER_PAGE_LIMIT = 200
const VOUCHER_MAX_PAGES = 50

export function voucherListQuery(params = {}) {
  return {
    type: params.type || 'payment',
    limit: VOUCHER_PAGE_LIMIT,
    ...(params.year ? { year: params.year } : {}),
    ...(params.months ? { months: params.months } : {}),
  }
}

/** Fetch every page so lists are not truncated at the newest 200 rows. */
export async function fetchAllVoucherTransactions(token, query = {}, getTransactions = erpAccountingAPI.getTransactions) {
  const base = voucherListQuery(query)
  const all = []
  const seen = new Set()
  let page = 1
  let last = null

  for (let guard = 0; guard < VOUCHER_MAX_PAGES; guard += 1) {
    const res = await getTransactions(token, { ...base, page, limit: VOUCHER_PAGE_LIMIT })
    last = res
    const rows = Array.isArray(res?.transactions) ? res.transactions : []
    for (const row of rows) {
      const id = String(row?._id || '')
      if (!id || seen.has(id)) continue
      seen.add(id)
      all.push(row)
    }
    if (!res?.hasMore || rows.length === 0) break
    page += 1
  }

  return {
    ...(last && typeof last === 'object' ? last : {}),
    success: true,
    transactions: all,
    total: Number(last?.total) || all.length,
    hasMore: false,
    nextCursor: null,
    page: 1,
    limit: VOUCHER_PAGE_LIMIT,
  }
}

/** Voucher rows for one type. Concurrent callers share one download for 45 seconds. */
export function loadSharedVoucherList(token, params = {}, { force = false } = {}) {
  const query = voucherListQuery(params)
  if (force) deleteCachedCatalog(CATALOG_KINDS.transactions, token, query)
  return fetchCatalogCached(
    CATALOG_KINDS.transactions,
    token,
    query,
    () => fetchAllVoucherTransactions(token, query),
    VOUCHER_LIST_TTL_MS,
  )
}

export function peekSharedVoucherList(token, params = {}) {
  return getCachedCatalog(CATALOG_KINDS.transactions, token, voucherListQuery(params))
}
