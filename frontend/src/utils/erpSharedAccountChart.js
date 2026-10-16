import erpAccountingAPI from '../api/erp-accounting'
import { CATALOG_KINDS } from './erpCatalogCache'
import { loadSharedPagedList } from './erpPagedRows'

/** Full active chart. Concurrent callers share one download for 45 seconds. */
export function loadSharedAccountChart(token, { onPage, force } = {}) {
  return loadSharedPagedList({
    cacheKind: CATALOG_KINDS.accounts,
    token,
    params: { chart: 'full' },
    pageSize: 200,
    force,
    onPage,
    readPage: async ({ page, limit }) => {
      const res = await erpAccountingAPI.getAccounts(token, { page, limit })
      return {
        rows: Array.isArray(res?.accounts) ? res.accounts : [],
        total: res?.total,
      }
    },
  })
}
