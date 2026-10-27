/** Treat display-rounded 0.00 as zero equity (hide from ERP dashboard card). */
export const DASHBOARD_ZERO_EQUITY_EPS = 0.005

export function hasNonZeroEquity(row, eps = DASHBOARD_ZERO_EQUITY_EPS) {
  return Math.abs(Number(row?.equity || 0)) >= eps
}

/**
 * ERP dashboard Margins card: drop zero-equity parties, sort by equity.
 * @param {Array<{ equity?: number }>} rows
 * @param {'desc'|'asc'} equitySort highest-first (default) or lowest-first
 */
export function filterAndSortDashboardMarginRows(rows, equitySort = 'desc') {
  const filtered = (rows || []).filter((row) => hasNonZeroEquity(row))
  const dir = equitySort === 'asc' ? 1 : -1
  filtered.sort((a, b) => {
    const av = Number(a?.equity || 0)
    const bv = Number(b?.equity || 0)
    if (av !== bv) return (av - bv) * dir
    return String(a?.name || '').localeCompare(String(b?.name || ''))
  })
  return filtered
}
