/** Treat tiny float noise as zero when filtering the Summary view. */
const TRIAL_BALANCE_AMOUNT_EPS = 1e-6

/**
 * Trial Balance "Summary" tab: only accounts with non-zero debit, credit, or net
 * for the selected period (belt-and-suspenders after API includeZero=false).
 */
export function trialBalanceRowsForView(reportView, rows) {
  const list = rows || []
  if (reportView !== 'summary') return list
  return list.filter((row) => {
    const d = Math.abs(Number(row.debit ?? 0))
    const c = Math.abs(Number(row.credit ?? 0))
    const n = Math.abs(Number(row.net ?? 0))
    return d > TRIAL_BALANCE_AMOUNT_EPS || c > TRIAL_BALANCE_AMOUNT_EPS || n > TRIAL_BALANCE_AMOUNT_EPS
  })
}
