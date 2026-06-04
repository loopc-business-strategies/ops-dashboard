/** Treat tiny float noise as zero when filtering the Summary view. */
const TRIAL_BALANCE_AMOUNT_EPS = 1e-6

/**
 * Trial Balance "Summary" tab: only accounts with non-zero net balance (same rule as API when includeZero=false).
 */
export function trialBalanceRowsForView(reportView, rows) {
  const list = rows || []
  if (reportView !== 'summary') return list
  return list.filter((row) => {
    const n = Math.abs(Number(row.net ?? 0))
    return n > TRIAL_BALANCE_AMOUNT_EPS
  })
}
