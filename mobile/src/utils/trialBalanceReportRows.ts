const TRIAL_BALANCE_AMOUNT_EPS = 1e-6

export type TrialBalanceRow = {
  debit?: number
  credit?: number
  net?: number
  accountCode?: string
  accountName?: string
  accountType?: string
}

/** Same rules as web `trialBalanceReportRows.js` (Summary: non-zero net only). */
export function trialBalanceRowsForView(
  reportView: string,
  rows: TrialBalanceRow[] | null | undefined,
): TrialBalanceRow[] {
  const list = rows || []
  if (reportView !== 'summary') return list
  return list.filter((row) => {
    const n = Math.abs(Number(row.net ?? 0))
    return n > TRIAL_BALANCE_AMOUNT_EPS
  })
}
