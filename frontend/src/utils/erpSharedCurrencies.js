import erpAccountingAPI from '../api/erp-accounting'
import { CATALOG_KINDS, fetchCatalogCached } from './erpCatalogCache'

/** Currency master list. Concurrent callers share one download. */
export function loadSharedCurrencies(token) {
  return fetchCatalogCached(CATALOG_KINDS.currencies, token, {}, () =>
    erpAccountingAPI.getCurrencies(token))
}
