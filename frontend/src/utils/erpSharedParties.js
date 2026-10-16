import erpAccountingAPI from '../api/erp-accounting'
import { CATALOG_KINDS } from './erpCatalogCache'
import { loadSharedPagedList } from './erpPagedRows'

const PARTY_PARAMS = { all: true, sharedPages: true }

/** Full customer list. Concurrent callers share one download for 45 seconds. */
export function loadSharedCustomers(token, { onPage, filters = {} } = {}) {
  return loadSharedPagedList({
    cacheKind: CATALOG_KINDS.customers,
    token,
    params: { ...filters, ...PARTY_PARAMS },
    pageSize: 100,
    readPage: async ({ page, limit }) => {
      const res = await erpAccountingAPI.getCustomers(token, { ...filters, page, limit })
      return { rows: res.customers || [], total: res.total }
    },
    onPage,
  })
}

/** Full vendor list. Concurrent callers share one download for 45 seconds. */
export function loadSharedVendors(token, { onPage } = {}) {
  return loadSharedPagedList({
    cacheKind: CATALOG_KINDS.vendors,
    token,
    params: PARTY_PARAMS,
    pageSize: 100,
    readPage: async ({ page, limit }) => {
      const res = await erpAccountingAPI.getVendors(token, { page, limit })
      return { rows: res.vendors || [], total: res.total }
    },
    onPage,
  })
}
