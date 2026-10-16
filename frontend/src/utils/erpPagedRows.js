const MAX_PAGES = 200
const PAGE_ATTEMPTS = 3

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
