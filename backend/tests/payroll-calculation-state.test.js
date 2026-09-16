const {
  calculateLineFromAssignment,
  calculateRunTotals,
  sumComponents,
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
  test('sums components and computes net', () => {
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
      { gross: 100, totalDeductions: 10, net: 90, employerTotal: 5 },
      { gross: 200, totalDeductions: 20, net: 180, employerTotal: 8 },
    ])
    expect(totals).toEqual({
      employeeCount: 2,
      gross: 300,
      deductions: 30,
      net: 270,
      employerTotal: 13,
    })
    expect(sumComponents([{ amount: 1.1 }, { amount: 2.2 }])).toBeCloseTo(3.3, 5)
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
