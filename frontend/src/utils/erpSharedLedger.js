import erpAccountingAPI from '../api/erp-accounting'
import { normalizeFilterMonths, normalizeFilterYear, toMonthCsv } from '../components/tabs/erp/erpListFilters'

const LEDGER_PAGE_TTL_MS = 45_000
export const LEDGER_PAGE_LIMIT = 500
const LEDGER_MAX_PAGES = 20
const ledgerCache = { key: '', at: 0, data: null }
let ledgerInflight = null
let ledgerInflightKey = ''

export function buildLedgerQuery(ledgerFilters = {}, ledgerVoucherTab = 'journal', cursor = null) {
  const year = normalizeFilterYear(ledgerFilters.year)
  const months = normalizeFilterMonths(ledgerFilters.months)
  return {
    limit: LEDGER_PAGE_LIMIT,
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

/** Fetch all matching ledger pages (follows nextCursor up to LEDGER_MAX_PAGES) so early JV numbers (0001+) are included. */
export async function fetchAllLedgerPages(token, baseQuery = defaultLedgerQuery()) {
  const all = []
  const seenIds = new Set()
  let cursor = baseQuery.cursor || null
  let last = null
  let pageCount = 0

  while (pageCount < LEDGER_MAX_PAGES) {
    pageCount += 1
    const pageQuery = cursor ? { ...baseQuery, cursor } : { ...baseQuery }
    if (!cursor) delete pageQuery.cursor
    const data = await erpAccountingAPI.getLedger(token, pageQuery)
    last = data
    const rows = Array.isArray(data?.entries) ? data.entries : []
    for (const row of rows) {
      const id = String(row?._id || '')
      if (id && seenIds.has(id)) continue
      if (id) seenIds.add(id)
      all.push(row)
    }
    const next = data?.hasMore && data?.nextCursor ? data.nextCursor : null
    if (!next || next === cursor || rows.length === 0) break
    cursor = next
  }

  return {
    ...(last && typeof last === 'object' ? last : {}),
    success: true,
    entries: all,
    cursor: null,
    nextCursor: last?.hasMore && pageCount >= LEDGER_MAX_PAGES ? (last?.nextCursor || null) : null,
    hasMore: Boolean(last?.hasMore && pageCount >= LEDGER_MAX_PAGES),
  }
}

/** First journal load. Concurrent callers share one download for 45 seconds. */
export function loadSharedLedgerPage(token, query = defaultLedgerQuery(), { force = false } = {}) {
  const key = JSON.stringify(query)
  if (!force) {
    const cached = peekSharedLedgerPage(query)
    if (cached) return Promise.resolve(cached)
    if (ledgerInflight && ledgerInflightKey === key) return ledgerInflight
  }
  ledgerInflightKey = key
  const promise = fetchAllLedgerPages(token, query).then((data) => {
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
