import { buildCatalogCacheKey, deleteCachedCatalog, getCachedCatalog, setCachedCatalog } from './erpCatalogCache'

const MAX_PAGES = 200
const PAGE_ATTEMPTS = 3
const SHARED_LIST_TTL_MS = 45_000
const sharedJobs = new Map()

/**
 * Walk every page of a list. `onPage` receives the rows collected so far after
 * each successful page, and the returned array is the full unique list.
 * A page is retried before the error is thrown, so a short list is not treated
 * as finished when a later page fails.
 */
export async function forEachListPage({
  pageSize,
  fetchPage,
  onPage,
  shouldStop,
}) {
  let page = 1
  let total = Number.POSITIVE_INFINITY
  let rawCount = 0
  const seen = new Map()

  while (rawCount < total && page <= MAX_PAGES) {
    if (shouldStop?.()) return Array.from(seen.values())

    let data = null
    let lastError = null
    for (let attempt = 1; attempt <= PAGE_ATTEMPTS; attempt += 1) {
      try {
        data = await fetchPage({ page, limit: pageSize })
        lastError = null
        break
      } catch (error) {
        lastError = error
      }
    }
    if (lastError) throw lastError
    if (shouldStop?.()) return Array.from(seen.values())

    const rows = Array.isArray(data?.rows) ? data.rows : []
    const reported = Number(data?.total)
    total = Number.isFinite(reported) && reported >= 0 ? reported : rawCount + rows.length
    const sizeBefore = seen.size
    rows.forEach((item, index) => {
      const id = item?._id != null && item._id !== '' ? String(item._id) : `p${page}-i${index}`
      seen.set(id, item)
    })
    rawCount += rows.length
    const stalled = page > 1 && seen.size === sizeBefore
    const done = rows.length === 0 || stalled || rawCount >= total
    onPage?.(Array.from(seen.values()), { page, total, done })
    if (done) break
    page += 1
  }

  return Array.from(seen.values())
}

/**
 * One in-flight download for every caller of the same list. Later callers join
 * the pages already loading, and a finished list is reused for 45 seconds.
 */
export async function loadSharedPagedList({
  cacheKind,
  token,
  params = {},
  pageSize,
  readPage,
  onPage,
  ttlMs = SHARED_LIST_TTL_MS,
  force = false,
}) {
  if (force) deleteCachedCatalog(cacheKind, token, params)
  else {
    const cached = getCachedCatalog(cacheKind, token, params)
    if (Array.isArray(cached?.rows)) {
      onPage?.(cached.rows, { page: 1, total: cached.rows.length, done: true })
      return cached.rows
    }
  }

  const key = buildCatalogCacheKey(cacheKind, token, params)
  let job = sharedJobs.get(key)
  if (!job) {
    const listeners = new Set()
    let latest = null
    const promise = forEachListPage({
      pageSize,
      fetchPage: readPage,
      onPage: (rows, meta) => {
        latest = { rows, meta }
        listeners.forEach((fn) => fn(rows, meta))
        if (meta.done) setCachedCatalog(cacheKind, token, params, { rows }, ttlMs)
      },
    })
    job = {
      promise,
      listeners,
      latest: () => latest,
    }
    sharedJobs.set(key, job)
    promise.finally(() => {
      if (sharedJobs.get(key)?.promise === promise) sharedJobs.delete(key)
    })
  }

  const latest = job.latest()
  if (latest && onPage) onPage(latest.rows, latest.meta)
  if (onPage) job.listeners.add(onPage)
  try {
    return await job.promise
  } finally {
    if (onPage) job.listeners.delete(onPage)
  }
}
