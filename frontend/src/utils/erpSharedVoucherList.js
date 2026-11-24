import erpAccountingAPI from '../api/erp-accounting'
import {
  CATALOG_KINDS,
  deleteCachedCatalog,
  fetchCatalogCached,
  getCachedCatalog,
  setCachedCatalog,
  buildCatalogCacheKey,
} from './erpCatalogCache'

const VOUCHER_LIST_TTL_MS = 45_000
/** API caps limit at 200 — page until All years / All months includes early Doc Nos. */
export const VOUCHER_PAGE_LIMIT = 200
const VOUCHER_MAX_PAGES = 50

/** Listeners for progressive page updates while a shared fetch is in flight. */
const voucherPageListeners = new Map()

export function voucherListQuery(params = {}) {
  return {
    type: params.type || 'payment',
    limit: VOUCHER_PAGE_LIMIT,
    ...(params.year ? { year: params.year } : {}),
    ...(params.months ? { months: params.months } : {}),
  }
}

function notifyVoucherPage(cacheKey, partial) {
  const listeners = voucherPageListeners.get(cacheKey)
  if (!listeners?.size) return
  for (const fn of listeners) {
    try { fn(partial) } catch { /* ignore listener errors */ }
  }
}

function subscribeVoucherPages(cacheKey, onPage) {
  if (typeof onPage !== 'function') return () => {}
  if (!voucherPageListeners.has(cacheKey)) voucherPageListeners.set(cacheKey, new Set())
  voucherPageListeners.get(cacheKey).add(onPage)
  return () => {
    const set = voucherPageListeners.get(cacheKey)
    if (!set) return
    set.delete(onPage)
    if (!set.size) voucherPageListeners.delete(cacheKey)
  }
}

function buildPartialResult(all, last, { page, hasMore }) {
  return {
    ...(last && typeof last === 'object' ? last : {}),
    success: true,
    transactions: all,
    total: Number(last?.total) || all.length,
    hasMore: Boolean(hasMore),
    listComplete: !hasMore,
    nextCursor: null,
    page,
    limit: VOUCHER_PAGE_LIMIT,
  }
}

/**
 * Fetch every page so lists are not truncated at the newest 200 rows.
 * Optional onPage receives cumulative partials after each page (first page ≈ fast paint).
 */
export async function fetchAllVoucherTransactions(
  token,
  query = {},
  getTransactions = erpAccountingAPI.getTransactions,
  { onPage } = {},
) {
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
    const hasMore = Boolean(res?.hasMore) && rows.length > 0
    const partial = buildPartialResult([...all], last, { page, hasMore })
    onPage?.(partial)
    if (!hasMore) break
    page += 1
  }

  return buildPartialResult(all, last, { page, hasMore: false })
}

/**
 * Voucher rows for one type. Concurrent callers share one download for 45 seconds.
 * Pass onPage to paint after the first API page while older pages keep loading.
 */
export function loadSharedVoucherList(token, params = {}, { force = false, onPage } = {}) {
  const query = voucherListQuery(params)
  if (force) deleteCachedCatalog(CATALOG_KINDS.transactions, token, query)

  const cached = getCachedCatalog(CATALOG_KINDS.transactions, token, query)
  if (cached != null && cached.listComplete !== false) {
    onPage?.(cached)
    return Promise.resolve(cached)
  }
  if (cached != null && typeof onPage === 'function') {
    onPage(cached)
  }

  const cacheKey = buildCatalogCacheKey(CATALOG_KINDS.transactions, token, query)
  const unsubscribe = subscribeVoucherPages(cacheKey, onPage)

  return fetchCatalogCached(
    CATALOG_KINDS.transactions,
    token,
    query,
    () => fetchAllVoucherTransactions(
      token,
      query,
      erpAccountingAPI.getTransactions,
      {
        onPage: (partial) => {
          setCachedCatalog(CATALOG_KINDS.transactions, token, query, partial, VOUCHER_LIST_TTL_MS)
          notifyVoucherPage(cacheKey, partial)
        },
      },
    ),
    VOUCHER_LIST_TTL_MS,
  ).finally(() => {
    unsubscribe()
  })
}

export function peekSharedVoucherList(token, params = {}) {
  return getCachedCatalog(CATALOG_KINDS.transactions, token, voucherListQuery(params))
}
