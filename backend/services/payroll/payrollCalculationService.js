function toAmount(value) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) return 0
  return Math.round(n * 100) / 100
}

function sumComponents(components = []) {
  return (Array.isArray(components) ? components : []).reduce((sum, item) => sum + toAmount(item?.amount), 0)
}

function normalizeComponents(components = []) {
  return (Array.isArray(components) ? components : []).map((item) => ({
    code: String(item?.code || '').trim() || 'ITEM',
    label: String(item?.label || item?.code || '').trim(),
    amount: toAmount(item?.amount),
  }))
}

function daysInMonth(year, month) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) return 31
  return new Date(y, m, 0).getDate()
}

/**
 * Display-only payroll period bounds for a run month.
 * periodStart = max(joiningDate, monthStart); periodEnd = monthEnd.
 * Does not change payableDays or proration.
 */
function resolvePeriodBounds(year, month, joiningDate) {
  const y = Number(year)
  const m = Number(month)
  if (!Number.isInteger(y) || !Number.isInteger(m) || m < 1 || m > 12) {
    return { periodStart: null, periodEnd: null }
  }
  const monthStart = new Date(Date.UTC(y, m - 1, 1))
  const periodEnd = new Date(Date.UTC(y, m, 0))
  let periodStart = monthStart
  if (joiningDate) {
    const join = new Date(joiningDate)
    if (!Number.isNaN(join.getTime())) {
      const joinUtc = new Date(Date.UTC(join.getUTCFullYear(), join.getUTCMonth(), join.getUTCDate()))
      if (joinUtc > monthStart && joinUtc <= periodEnd) periodStart = joinUtc
      else if (joinUtc > periodEnd) periodStart = periodEnd
    }
  }
  return { periodStart, periodEnd }
}

/**
 * Prorate monthly salary: monthlySalary / calendarDays × payableDays, rounded to 2dp.
 * LoopC Aug 2026: 80000/31*24 = 61935.48; 65000/31*24 = 50322.58
 */
function prorateMonthly(monthlySalary, calendarDays, payableDays) {
  const monthly = toAmount(monthlySalary)
  const cal = Number(calendarDays)
  const pay = Number(payableDays)
  if (!Number.isFinite(cal) || cal <= 0) return monthly
  if (!Number.isFinite(pay) || pay < 0) return 0
  if (pay >= cal) return monthly
  return toAmount((monthly / cal) * pay)
}

function resolveMonthlySalary(assignment) {
  const earnings = normalizeComponents(assignment?.earnings)
  const basic = earnings.find((e) => String(e.code).toUpperCase() === 'BASIC')
  if (basic) return toAmount(basic.amount)
  return sumComponents(earnings)
}

const PREV_ARREARS_CODE = 'PREV_ARREARS'
const ADV_DED_CODE = 'ADV_DED'

/**
 * Pure payroll line calculation from a salary assignment snapshot.
 * When payableDays/calendarDays provided, earnings are prorated from monthly salary.
 * amountPaid drives salaryBalance (arrears), never classified as an advance.
 * previousArrears / advanceDeduction are optional additive snapshots (LoopC).
 */
function calculateLineFromAssignment(assignment, employee = {}, options = {}) {
  const earningsFull = normalizeComponents(assignment?.earnings)
  const deductionsFull = normalizeComponents(assignment?.deductions).filter(
    (d) => String(d.code).toUpperCase() !== ADV_DED_CODE
  )
  const employerContributions = normalizeComponents(assignment?.employerContributions)

  const monthlySalary = resolveMonthlySalary(assignment)
  const calendarDays = options.calendarDays != null ? Number(options.calendarDays) : null
  const payableDays = options.payableDays != null ? Number(options.payableDays) : null
  const useProration = Number.isFinite(calendarDays) && calendarDays > 0
    && Number.isFinite(payableDays) && payableDays >= 0

  let earnings = earningsFull
  let salaryCalculated
  if (useProration) {
    const scale = monthlySalary > 0 ? prorateMonthly(monthlySalary, calendarDays, payableDays) / monthlySalary : 0
    earnings = earningsFull.map((e) => ({
      ...e,
      amount: toAmount(e.amount * scale),
    }))
    // Ensure BASIC (or sole earning) matches exact prorate for the monthly base
    if (earnings.length === 1 || earnings.some((e) => String(e.code).toUpperCase() === 'BASIC')) {
      const earnedExact = prorateMonthly(monthlySalary, calendarDays, payableDays)
      const basicIdx = earnings.findIndex((e) => String(e.code).toUpperCase() === 'BASIC')
      if (basicIdx >= 0) {
        const others = earnings.reduce((s, e, i) => (i === basicIdx ? s : s + e.amount), 0)
        earnings[basicIdx] = {
          ...earnings[basicIdx],
          amount: toAmount(Math.max(0, earnedExact - others)),
        }
      }
      salaryCalculated = earnedExact
    } else {
      salaryCalculated = sumComponents(earnings)
    }
  } else {
    salaryCalculated = sumComponents(earnings)
  }

  const previousArrearsRaw = options.previousArrears
  const previousArrears = previousArrearsRaw == null ? null : toAmount(previousArrearsRaw)
  if (previousArrears != null && previousArrears > 0) {
    earnings = [
      ...earnings.filter((e) => String(e.code).toUpperCase() !== PREV_ARREARS_CODE),
      { code: PREV_ARREARS_CODE, label: 'Previous Arrears', amount: previousArrears },
    ]
  }

  const gross = sumComponents(earnings)

  let deductions = deductionsFull
  const advanceDeductionRaw = options.advanceDeduction
  const advanceDeduction = advanceDeductionRaw == null ? null : toAmount(advanceDeductionRaw)
  if (advanceDeduction != null && advanceDeduction > 0) {
    deductions = [
      ...deductions,
      { code: ADV_DED_CODE, label: 'Deduction Towards Advance Payment', amount: advanceDeduction },
    ]
  }

  const totalDeductions = sumComponents(deductions)
  const otherDeductions = toAmount(
    deductions
      .filter((d) => String(d.code).toUpperCase() !== ADV_DED_CODE)
      .reduce((s, d) => s + toAmount(d.amount), 0)
  )
  const net = toAmount(Math.max(0, gross - totalDeductions))
  const employerTotal = sumComponents(employerContributions)

  const amountPaidRaw = options.amountPaid
  const amountPaid = amountPaidRaw == null ? null : toAmount(amountPaidRaw)
  const salaryBalance = amountPaid == null ? null : toAmount(Math.max(0, net - amountPaid))

  const year = options.year != null ? Number(options.year) : null
  const month = options.month != null ? Number(options.month) : null
  const { periodStart, periodEnd } = (year && month)
    ? resolvePeriodBounds(year, month, employee.joiningDate || options.joiningDate || null)
    : { periodStart: options.periodStart || null, periodEnd: options.periodEnd || null }

  return {
    employeeId: employee._id || employee.id || assignment?.employeeId,
    employeeCode: employee.employeeCode || '',
    employeeName: employee.name || '',
    department: employee.department || '',
    position: employee.position || '',
    joiningDate: employee.joiningDate || null,
    salaryAssignmentId: assignment?._id || null,
    salaryAssignmentVersion: assignment?.version ?? null,
    monthlySalary,
    calendarDays: useProration ? calendarDays : null,
    payableDays: useProration ? payableDays : null,
    periodStart: periodStart || null,
    periodEnd: periodEnd || null,
    salaryCalculated: salaryCalculated != null ? toAmount(salaryCalculated) : null,
    previousArrears,
    advanceDeduction,
    otherDeductions,
    earnings,
    deductions,
    employerContributions,
    gross,
    totalDeductions,
    net,
    employerTotal,
    amountPaid,
    salaryBalance,
  }
}

function calculateRunTotals(lines = []) {
  const list = Array.isArray(lines) ? lines : []
  return {
    employeeCount: list.length,
    gross: toAmount(list.reduce((s, l) => s + toAmount(l.gross), 0)),
    deductions: toAmount(list.reduce((s, l) => s + toAmount(l.totalDeductions), 0)),
    net: toAmount(list.reduce((s, l) => s + toAmount(l.net), 0)),
    employerTotal: toAmount(list.reduce((s, l) => s + toAmount(l.employerTotal), 0)),
    paid: toAmount(list.reduce((s, l) => s + toAmount(l.amountPaid), 0)),
    outstanding: toAmount(list.reduce((s, l) => s + toAmount(l.salaryBalance), 0)),
  }
}

module.exports = {
  toAmount,
  sumComponents,
  normalizeComponents,
  daysInMonth,
  resolvePeriodBounds,
  prorateMonthly,
  resolveMonthlySalary,
  calculateLineFromAssignment,
  calculateRunTotals,
  PREV_ARREARS_CODE,
  ADV_DED_CODE,
}
