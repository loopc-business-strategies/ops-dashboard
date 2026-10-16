import erpAccountingAPI from '../api/erp-accounting'
import { CATALOG_KINDS, deleteCachedCatalog, fetchCatalogCached, getCachedCatalog } from './erpCatalogCache'

const VOUCHER_LIST_TTL_MS = 45_000

export function voucherListQuery(params = {}) {
  return {
    type: params.type || 'payment',
    limit: params.limit || 200,
    ...(params.year ? { year: params.year } : {}),
    ...(params.months ? { months: params.months } : {}),
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
    () => erpAccountingAPI.getTransactions(token, query),
    VOUCHER_LIST_TTL_MS,
  )
}

export function peekSharedVoucherList(token, params = {}) {
  return getCachedCatalog(CATALOG_KINDS.transactions, token, voucherListQuery(params))
}
