/**
 * LoopC payroll presentation helpers (read-only).
 * Previous Month Advance Payment Deduction is a display alias of salaryBalance
 * (unpaid residual = max(0, net − amountPaid)). Not an EmployeeAdvance transaction.
 * Never overwrite stored totalDeductions or recalculate amountPaid.
 */

export function numOrZero(n) {
  const v = Number(n)
  return Number.isFinite(v) ? v : 0
}

export function money(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function inrMoney(n) {
  if (n == null || n === '') return '—'
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  return `INR ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function otherDeductionsOf(row) {
  if (row?.otherDeductions != null) return numOrZero(row.otherDeductions)
  const total = numOrZero(row?.totalDeductions)
  const adv = numOrZero(row?.advanceDeduction)
  return Math.round((total - adv) * 100) / 100
}

/** Presentation alias of salaryBalance (unpaid residual). */
export function previousMonthAdvanceDeductionOf(row) {
  return numOrZero(row?.salaryBalance)
}

export function currentMonthAdvanceDeductionOf(row) {
  return numOrZero(row?.advanceDeduction)
}

/** Display-only total; does not overwrite row.totalDeductions. */
export function displayTotalDeductionsOf(row) {
  return Math.round(
    (currentMonthAdvanceDeductionOf(row)
      + previousMonthAdvanceDeductionOf(row)
      + numOrZero(otherDeductionsOf(row))) * 100
  ) / 100
}

export function salaryCalculatedOf(row) {
  if (row?.salaryCalculated != null) return row.salaryCalculated
  const prev = numOrZero(row?.previousArrears)
  const gross = numOrZero(row?.gross)
  if (prev > 0) return Math.round((gross - prev) * 100) / 100
  return row?.net ?? row?.gross
}
