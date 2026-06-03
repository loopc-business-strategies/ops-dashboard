const TRIAL_BALANCE_AMOUNT_EPS = 1e-6

export type TrialBalanceRow = {
  debit?: number
  credit?: number
  net?: number
  accountCode?: string
  accountName?: string
  accountType?: string
}

/** Same rules as web `trialBalanceReportRows.js`. */
export function trialBalanceRowsForView(
  reportView: string,
  rows: TrialBalanceRow[] | null | undefined,
): TrialBalanceRow[] {
  const list = rows || []
  if (reportView !== 'summary') return list
  return list.filter((row) => {
    const d = Math.abs(Number(row.debit ?? 0))
    const c = Math.abs(Number(row.credit ?? 0))
    const n = Math.abs(Number(row.net ?? 0))
    return d > TRIAL_BALANCE_AMOUNT_EPS || c > TRIAL_BALANCE_AMOUNT_EPS || n > TRIAL_BALANCE_AMOUNT_EPS
  })
}
