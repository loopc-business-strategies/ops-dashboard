import erpAccountingAPI from '../api/erp-accounting'
import { normalizeFilterMonths, normalizeFilterYear, toMonthCsv } from '../components/tabs/erp/erpListFilters'

const LEDGER_PAGE_TTL_MS = 45_000
const ledgerCache = { key: '', at: 0, data: null }
let ledgerInflight = null
let ledgerInflightKey = ''

export function buildLedgerQuery(ledgerFilters = {}, ledgerVoucherTab = 'journal', cursor = null) {
  const year = normalizeFilterYear(ledgerFilters.year)
  const months = normalizeFilterMonths(ledgerFilters.months)
  return {
    limit: 100,
    ...ledgerFilters,
    referenceType: ledgerFilters.referenceType || ledgerVoucherTab,
    ...(ledgerFilters.search ? { search: ledgerFilters.search } : {}),
    ...(year ? { year } : {}),
    ...(months.length ? { months: toMonthCsv(months) } : {}),
    ...(cursor ? { cursor } : {}),
  }
}

export function defaultLedgerQuery() {
  return buildLedgerQuery({
    startDate: '',
    endDate: '',
    department: '',
    referenceType: '',
    accountId: '',
    search: '',
    year: '',
    months: [],
  }, 'journal', null)
}

export function isDefaultLedgerQuery(query) {
  return JSON.stringify(query) === JSON.stringify(defaultLedgerQuery())
}

export function peekSharedLedgerPage(query) {
  const key = JSON.stringify(query)
  if (ledgerCache.key === key && ledgerCache.data && Date.now() - ledgerCache.at < LEDGER_PAGE_TTL_MS) {
    return ledgerCache.data
  }
  return null
}

/** First journal page. Concurrent callers share one download for 45 seconds. */
export function loadSharedLedgerPage(token, query = defaultLedgerQuery(), { force = false } = {}) {
  const key = JSON.stringify(query)
  if (!force) {
    const cached = peekSharedLedgerPage(query)
    if (cached) return Promise.resolve(cached)
    if (ledgerInflight && ledgerInflightKey === key) return ledgerInflight
  }
  ledgerInflightKey = key
  const promise = erpAccountingAPI.getLedger(token, query).then((data) => {
    ledgerCache.key = key
    ledgerCache.at = Date.now()
    ledgerCache.data = data
    return data
  }).finally(() => {
    if (ledgerInflight === promise) {
      ledgerInflight = null
      ledgerInflightKey = ''
    }
  })
  ledgerInflight = promise
  return promise
}
