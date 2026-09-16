const {
  calculateLineFromAssignment,
  calculateRunTotals,
  prorateMonthly,
  toAmount,
} = require('../services/payroll/payrollCalculationService')
const {
  canTransition,
  assertTransition,
  isImmutable,
} = require('../services/payroll/payrollStateMachine')
const { isStructuredPayrollEnabled } = require('../config/tenantCapabilities')

describe('tenantCapabilities structured payroll', () => {
  test('enabled only for loopc', () => {
    expect(isStructuredPayrollEnabled('loopc')).toBe(true)
    expect(isStructuredPayrollEnabled('LOOPC')).toBe(true)
    expect(isStructuredPayrollEnabled('mg')).toBe(false)
    expect(isStructuredPayrollEnabled('cg')).toBe(false)
    expect(isStructuredPayrollEnabled('vb')).toBe(false)
    expect(isStructuredPayrollEnabled('')).toBe(false)
  })
})

describe('payrollCalculationService', () => {
  test('LoopC Aug 2026 proration: 80000/31*24 and 65000/31*24', () => {
    expect(prorateMonthly(80000, 31, 24)).toBe(61935.48)
    expect(prorateMonthly(65000, 31, 24)).toBe(50322.58)
  })

  test('August earned + paid + salary balance for 80k and 65k', () => {
    const high = calculateLineFromAssignment(
      { earnings: [{ code: 'BASIC', label: 'Monthly Salary', amount: 80000 }], deductions: [], employerContributions: [] },
      { name: 'Aneesh', employeeCode: 'LoopC-ANEESH', joiningDate: '2026-08-07' },
      { calendarDays: 31, payableDays: 24, amountPaid: 50000 }
    )
    expect(high.net).toBe(61935.48)
    expect(high.amountPaid).toBe(50000)
    expect(high.salaryBalance).toBe(11935.48)
    expect(high.payableDays).toBe(24)

    const mid = calculateLineFromAssignment(
      { earnings: [{ code: 'BASIC', label: 'Monthly Salary', amount: 65000 }], deductions: [], employerContributions: [] },
      { name: 'Sudheesh', employeeCode: 'LoopC-SUDHEESH' },
      { calendarDays: 31, payableDays: 24, amountPaid: 50000 }
    )
    expect(mid.net).toBe(50322.58)
    expect(mid.salaryBalance).toBe(322.58)

    const totals = calculateRunTotals([
      { ...high },
      { ...high, employeeName: 'Biju' },
      { ...mid },
      { ...mid, employeeName: 'Anil' },
    ])
    expect(totals.net).toBe(224516.12)
    expect(totals.paid).toBe(200000)
    expect(totals.outstanding).toBe(24516.12)
  })

  test('salary balance is never negative (overpayment clamps)', () => {
    const line = calculateLineFromAssignment(
      { earnings: [{ code: 'BASIC', amount: 1000 }], deductions: [], employerContributions: [] },
      { name: 'X' },
      { calendarDays: 31, payableDays: 24, amountPaid: 99999 }
    )
    expect(line.salaryBalance).toBe(0)
  })

  test('sums components and computes net without proration', () => {
    const line = calculateLineFromAssignment(
      {
        _id: 'asg1',
        version: 2,
        earnings: [
          { code: 'BASIC', label: 'Basic', amount: 1000 },
          { code: 'HRA', label: 'HRA', amount: 200.555 },
        ],
        deductions: [{ code: 'TAX', label: 'Tax', amount: 100 }],
        employerContributions: [{ code: 'PF', label: 'PF', amount: 50 }],
      },
      {
        _id: 'emp1',
        name: 'Ada',
        employeeCode: 'E1',
        department: 'finance',
        position: 'Analyst',
      }
    )

    expect(line.gross).toBe(1200.56)
    expect(line.totalDeductions).toBe(100)
    expect(line.net).toBe(1100.56)
    expect(line.employerTotal).toBe(50)
    expect(line.employeeName).toBe('Ada')
    expect(line.salaryAssignmentVersion).toBe(2)
  })

  test('floors negative net at zero', () => {
    const line = calculateLineFromAssignment({
      earnings: [{ code: 'BASIC', amount: 50 }],
      deductions: [{ code: 'DED', amount: 80 }],
      employerContributions: [],
    }, { name: 'X', employeeCode: 'X' })
    expect(line.net).toBe(0)
  })

  test('calculateRunTotals aggregates lines', () => {
    const totals = calculateRunTotals([
      { gross: 100, totalDeductions: 10, net: 90, employerTotal: 5, amountPaid: 80, salaryBalance: 10 },
      { gross: 200, totalDeductions: 20, net: 180, employerTotal: 8, amountPaid: 180, salaryBalance: 0 },
    ])
    expect(totals.employeeCount).toBe(2)
    expect(totals.gross).toBe(300)
    expect(totals.deductions).toBe(30)
    expect(totals.net).toBe(270)
    expect(totals.employerTotal).toBe(13)
    expect(totals.paid).toBe(260)
    expect(totals.outstanding).toBe(10)
    expect(toAmount(1.1 + 2.2)).toBeCloseTo(3.3, 5)
  })
})

describe('payrollStateMachine', () => {
  test('allows valid transitions', () => {
    expect(canTransition('DRAFT', 'CALCULATED')).toBe(true)
    expect(canTransition('CALCULATED', 'UNDER_REVIEW')).toBe(true)
    expect(canTransition('UNDER_REVIEW', 'APPROVED')).toBe(true)
    expect(canTransition('APPROVED', 'FINALIZED')).toBe(true)
    expect(canTransition('FINALIZED', 'PAID')).toBe(true)
  })

  test('rejects invalid transitions', () => {
    expect(canTransition('DRAFT', 'FINALIZED')).toBe(false)
    expect(canTransition('PAID', 'DRAFT')).toBe(false)
    expect(() => assertTransition('DRAFT', 'PAID')).toThrow(/Invalid payroll status/)
  })

  test('immutable statuses', () => {
    expect(isImmutable('FINALIZED')).toBe(true)
    expect(isImmutable('PAID')).toBe(true)
    expect(isImmutable('DRAFT')).toBe(false)
  })
})
