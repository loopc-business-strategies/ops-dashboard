import { useCallback, useRef } from 'react'
import erpAccountingAPI from '../../../api/erp-accounting'
import { fetchCatalogCached, CATALOG_KINDS } from '../../../utils/erpCatalogCache'
import { loadSharedPagedList } from '../../../utils/erpPagedRows'

/** Paginate customers until all rows are merged (parity with vendors aggregator). */
export async function fetchAllCustomersAggregated(token, baseFilters = {}, { onPage } = {}) {
  const rows = await loadSharedPagedList({
    cacheKind: CATALOG_KINDS.customers,
    token,
    params: { ...baseFilters, all: true, sharedPages: true },
    pageSize: 100,
    readPage: async ({ page, limit }) => {
      const data = await erpAccountingAPI.getCustomers(token, { ...baseFilters, page, limit })
      return { rows: data.customers || [], total: data.total }
    },
    onPage,
  })
  return { customers: rows, total: rows.length }
}

function wantsSinglePage(params) {
  if (!params || typeof params !== 'object') return false
  if (params.singlePage === true) return true
  if (params.page != null && Number(params.page) >= 1 && params.all !== true) return true
  return false
}

export function useErpCustomers({
  token,
  canLoadParties,
  setLoading,
  setCustomers,
  setError,
}) {
  const loadSeqRef = useRef(0)

  const loadCustomers = useCallback(async (params) => {
    if (!canLoadParties) return
    const seq = ++loadSeqRef.current
    setLoading(true)
    try {
      if (wantsSinglePage(params)) {
        const data = await fetchCatalogCached(
          CATALOG_KINDS.customers,
          token,
          params,
          () => erpAccountingAPI.getCustomers(token, params),
        )
        if (seq !== loadSeqRef.current) return
        setCustomers(data.customers || [])
      } else {
        const { limit: _ignoredLimit, page: _ignoredPage, all: _all, ...filters } = params || {}
        const data = await fetchAllCustomersAggregated(token, filters)
        if (seq !== loadSeqRef.current) return
        setCustomers(data.customers || [])
      }
      if (seq !== loadSeqRef.current) return
      setError('')
    } catch (e) {
      if (seq !== loadSeqRef.current) return
      setError(e.response?.data?.message || 'Failed to load customers')
    }
    if (seq === loadSeqRef.current) setLoading(false)
  }, [token, canLoadParties, setLoading, setCustomers, setError])

  return { loadCustomers }
}
