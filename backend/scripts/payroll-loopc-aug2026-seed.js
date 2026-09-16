#!/usr/bin/env node
/**
 * Idempotent LoopC August 2026 payroll seed.
 *
 * - Upserts Aneesh / Biju / Sudheesh / Anil by exact case-insensitive name
 * - Sets joiningDate 2026-08-07, position Jewelry Maker, BASIC monthly salary (80k/65k)
 * - Creates/reuses Aug 2026 payroll run with payableDays=24, amountPaid=50000
 * - Finalizes → pays → payslips → salary balances (arrears, not advances)
 *
 * Usage:
 *   node backend/scripts/payroll-loopc-aug2026-seed.js
 *
 * Safety: loopc only; additive upserts only; refuses ambiguous name matches.
 */

require('dotenv').config()
const mongoose = require('mongoose')
const { connectTenant } = require('../db/tenantConnections')
const { isStructuredPayrollEnabled } = require('../config/tenantCapabilities')
const {
  calculateLineFromAssignment,
  calculateRunTotals,
  toAmount,
} = require('../services/payroll/payrollCalculationService')
const { ensureSalaryBalancesForRun } = require('../services/payroll/salaryBalanceService')
const { allocatePayslipNumber } = require('../services/payroll/payslipNumberService')

const TENANT = 'loopc'
const JOINING = new Date('2026-08-07T00:00:00.000Z')
const YEAR = 2026
const MONTH = 8
const CALENDAR_DAYS = 31
const PAYABLE_DAYS = 24
const AMOUNT_PAID = 50000
const IDEMPOTENCY_KEY = 'loopc-aug-2026-payroll'

const EMPLOYEES = [
  { name: 'Aneesh', monthlySalary: 80000, code: 'LoopC-ANEESH', idNumber: 'ID-ANEESH', position: 'Jewelry Maker' },
  { name: 'Biju', monthlySalary: 80000, code: 'LoopC-BIJU', idNumber: 'ID-BIJU', position: 'Jewelry Maker' },
  { name: 'Sudheesh', monthlySalary: 65000, code: 'LoopC-SUDHEESH', idNumber: 'ID-SUDHEESH', position: 'Jewelry Maker' },
  { name: 'Anil', monthlySalary: 65000, code: 'LoopC-ANIL', idNumber: 'ID-ANIL', position: 'Jewelry Maker' },
]

async function upsertEmployee(TenantEmployee, TenantAsg, spec) {
  const nameRe = new RegExp(`^${spec.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  const matches = await TenantEmployee.find({ name: nameRe, isDeleted: { $ne: true } })
  if (matches.length > 1) {
    throw new Error(`Ambiguous employee name "${spec.name}": ${matches.length} matches. Resolve manually.`)
  }

  let employee
  let action
  if (matches.length === 1) {
    employee = matches[0]
    employee.joiningDate = JOINING
    employee.position = spec.position || employee.position || ''
    if (spec.code && employee.employeeCode !== spec.code) employee.employeeCode = spec.code
    if (!employee.status) employee.status = 'ACTIVE'
    await employee.save()
    action = 'updated'
  } else {
    employee = await TenantEmployee.create({
      name: spec.name,
      employeeCode: spec.code,
      idNumber: spec.idNumber,
      joiningDate: JOINING,
      position: spec.position || '',
      status: 'ACTIVE',
      department: '',
      address: '',
      phoneNumber: '',
      email: '',
    })
    action = 'created'
  }

  const existingAsg = await TenantAsg.findOne({
    employeeId: employee._id,
    isActive: true,
    isDeleted: { $ne: true },
  })

  const earnings = [{ code: 'BASIC', label: 'Monthly Salary', amount: spec.monthlySalary }]
  if (existingAsg) {
    const same = toAmount(existingAsg.earnings?.find((e) => e.code === 'BASIC')?.amount) === spec.monthlySalary
    if (!same) {
      existingAsg.isActive = false
      await existingAsg.save()
      await TenantAsg.create({
        employeeId: employee._id,
        earnings,
        deductions: [],
        employerContributions: [],
        effectiveFrom: JOINING,
        version: (existingAsg.version || 1) + 1,
        isActive: true,
        notes: 'LoopC Aug 2026 seed',
        createdByName: 'aug2026-seed',
      })
    }
  } else {
    await TenantAsg.create({
      employeeId: employee._id,
      earnings,
      deductions: [],
      employerContributions: [],
      effectiveFrom: JOINING,
      version: 1,
      isActive: true,
      notes: 'LoopC Aug 2026 seed',
      createdByName: 'aug2026-seed',
    })
  }

  return { employee, action }
}

async function main() {
  if (!isStructuredPayrollEnabled(TENANT)) {
    console.error('Structured payroll not enabled for', TENANT)
    process.exit(1)
  }

  const uri = process.env.MONGO_URI_LOOPC || process.env.MONGO_URI
  if (!uri) {
    console.error('MONGO_URI_LOOPC or MONGO_URI required')
    process.exit(1)
  }

  await mongoose.connect(uri)
  await connectTenant(TENANT)

  const Emp = require('../models/Employee')
  const Asg = require('../models/EmployeeSalaryAssignment')
  const Run = require('../models/PayrollRun')
  const Slip = require('../models/Payslip')
  const Bal = require('../models/SalaryBalance')

  const TenantEmployee = await Emp.getTenantModel(TENANT)
  const TenantAsg = await Asg.getTenantModel(TENANT)
  const TenantRun = await Run.getTenantModel(TENANT)
  const TenantSlip = await Slip.getTenantModel(TENANT)
  const TenantBal = await Bal.getTenantModel(TENANT)

  const before = {
    employees: await TenantEmployee.countDocuments({ isDeleted: { $ne: true } }),
    runs: await TenantRun.countDocuments({ isDeleted: { $ne: true } }),
    payslips: await TenantSlip.countDocuments({ isDeleted: { $ne: true } }),
    balances: await TenantBal.countDocuments({ isDeleted: { $ne: true } }),
  }
  console.log('Before:', before)

  const upserted = []
  for (const spec of EMPLOYEES) {
    const result = await upsertEmployee(TenantEmployee, TenantAsg, spec)
    upserted.push(result)
    console.log(`${result.action}: ${result.employee.name} (${result.employee.employeeCode})`)
  }

  const employeeIds = upserted.map((u) => u.employee._id)
  let run = await TenantRun.findOne({ year: YEAR, month: MONTH, isDeleted: { $ne: true } })
  if (!run && IDEMPOTENCY_KEY) {
    run = await TenantRun.findOne({ idempotencyKey: IDEMPOTENCY_KEY, isDeleted: { $ne: true } })
  }

  const assignments = await TenantAsg.find({
    employeeId: { $in: employeeIds },
    isActive: true,
    isDeleted: { $ne: true },
  }).lean()
  const asgMap = new Map(assignments.map((a) => [String(a.employeeId), a]))
  const empMap = new Map(upserted.map((u) => [String(u.employee._id), u.employee]))

  const lines = employeeIds.map((id) => {
    const emp = empMap.get(String(id))
    const asg = asgMap.get(String(id))
    return {
      ...calculateLineFromAssignment(asg, emp.toObject ? emp.toObject() : emp, {
        calendarDays: CALENDAR_DAYS,
        payableDays: PAYABLE_DAYS,
        amountPaid: AMOUNT_PAID,
        year: YEAR,
        month: MONTH,
        previousArrears: 0,
        advanceDeduction: 0,
      }),
      daysWorked: null,
      daysAbsent: null,
      overtimeHours: null,
      attendanceNotes: '',
    }
  })

  const totals = calculateRunTotals(lines)
  console.log('Expected lines:')
  for (const l of lines) {
    console.log(`  ${l.employeeName}: earned=${l.net} paid=${l.amountPaid} balance=${l.salaryBalance}`)
  }
  console.log('Totals:', totals)

  if (!run) {
    run = await TenantRun.create({
      year: YEAR,
      month: MONTH,
      label: 'August 2026',
      status: 'DRAFT',
      lines,
      totals,
      defaultPayableDays: PAYABLE_DAYS,
      defaultCalendarDays: CALENDAR_DAYS,
      idempotencyKey: IDEMPOTENCY_KEY,
      createdByName: 'aug2026-seed',
      notes: 'LoopC Aug 2026 seed — payable days 24 confirmed',
    })
    console.log('Created payroll run', run._id.toString())
  } else if (['DRAFT', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED'].includes(run.status)) {
    run.lines = lines
    run.totals = totals
    run.defaultPayableDays = PAYABLE_DAYS
    run.defaultCalendarDays = CALENDAR_DAYS
    run.label = run.label || 'August 2026'
    if (!run.idempotencyKey) run.idempotencyKey = IDEMPOTENCY_KEY
    console.log('Updated existing mutable run', run._id.toString(), run.status)
  } else {
    console.log('Reusing immutable run', run._id.toString(), run.status, '— not rewriting earned lines')
  }

  // Advance lifecycle if needed
  const advance = async (to, fields = {}) => {
    if (run.status === to || run.status === 'PAID' && to !== 'PAID') return
    const order = ['DRAFT', 'CALCULATED', 'UNDER_REVIEW', 'APPROVED', 'FINALIZED', 'PAID']
    const fromIdx = order.indexOf(run.status)
    const toIdx = order.indexOf(to)
    if (toIdx <= fromIdx && !(run.status === 'FINALIZED' && to === 'PAID')) return
    // step through
    const steps = {
      CALCULATED: () => {
        run.status = 'CALCULATED'
        run.calculatedAt = new Date()
        run.calculatedByName = 'aug2026-seed'
      },
      UNDER_REVIEW: () => {
        run.status = 'UNDER_REVIEW'
        run.submittedAt = new Date()
        run.submittedByName = 'aug2026-seed'
      },
      APPROVED: () => {
        run.status = 'APPROVED'
        run.approvedAt = new Date()
        run.approvedByName = 'aug2026-seed'
      },
      FINALIZED: () => {
        run.status = 'FINALIZED'
        run.finalizedAt = new Date()
        run.finalizedByName = 'aug2026-seed'
      },
      PAID: () => {
        run.status = 'PAID'
        run.paidAt = new Date()
        run.paidByName = 'aug2026-seed'
      },
    }
    for (let i = fromIdx + 1; i <= toIdx; i += 1) {
      const st = order[i]
      if (st === 'DRAFT') continue
      if (steps[st]) steps[st]()
    }
    Object.assign(run, fields)
  }

  if (!['FINALIZED', 'PAID'].includes(run.status)) {
    run.lines = lines
    run.totals = totals
    await advance('FINALIZED')
    await run.save()
  }

  if (run.status === 'FINALIZED') {
    await advance('PAID')
    await run.save()
  } else {
    await run.save()
  }

  // Payslips
  const slipResult = { created: 0, skipped: 0 }
  for (const line of run.lines) {
    const existing = await TenantSlip.findOne({
      payrollRunId: run._id,
      employeeId: line.employeeId,
      isDeleted: { $ne: true },
      isReissue: { $ne: true },
      paymentStatus: { $nin: ['REISSUED', 'VOID'] },
    })
    if (existing) {
      slipResult.skipped += 1
      continue
    }
    const number = await allocatePayslipNumber(TENANT, YEAR, MONTH)
    await TenantSlip.create({
      number,
      payrollRunId: run._id,
      employeeId: line.employeeId,
      year: YEAR,
      month: MONTH,
      employeeName: line.employeeName,
      employeeCode: line.employeeCode,
      department: line.department,
      position: line.position,
      joiningDate: line.joiningDate,
      monthlySalary: line.monthlySalary,
      calendarDays: line.calendarDays,
      payableDays: line.payableDays,
      periodStart: line.periodStart || null,
      periodEnd: line.periodEnd || null,
      salaryCalculated: line.salaryCalculated ?? null,
      previousArrears: line.previousArrears ?? 0,
      advanceDeduction: line.advanceDeduction ?? 0,
      otherDeductions: line.otherDeductions ?? 0,
      earnings: line.earnings,
      deductions: line.deductions,
      employerContributions: line.employerContributions,
      gross: line.gross,
      totalDeductions: line.totalDeductions,
      net: line.net,
      employerTotal: line.employerTotal,
      amountPaid: line.amountPaid,
      salaryBalance: line.salaryBalance,
      paymentDate: run.paidAt || new Date(),
      paymentStatus: 'PAID',
      bankMasked: '****',
      generatedByName: 'aug2026-seed',
      generatedAt: new Date(),
    })
    slipResult.created += 1
  }
  console.log('Payslips:', slipResult)

  const balances = await ensureSalaryBalancesForRun(TENANT, run, { name: 'aug2026-seed' })
  console.log(`Salary balances created=${balances.created.length} skipped=${balances.skipped.length}`)

  const after = {
    employees: await TenantEmployee.countDocuments({ isDeleted: { $ne: true } }),
    runs: await TenantRun.countDocuments({ isDeleted: { $ne: true } }),
    payslips: await TenantSlip.countDocuments({ isDeleted: { $ne: true } }),
    balances: await TenantBal.countDocuments({ isDeleted: { $ne: true } }),
  }
  console.log('After:', after)
  console.log('Delta employees:', after.employees - before.employees, '(additive only)')

  // Verify expected math
  const expected = {
    Aneesh: { net: 61935.48, balance: 11935.48 },
    Biju: { net: 61935.48, balance: 11935.48 },
    Sudheesh: { net: 50322.58, balance: 322.58 },
    Anil: { net: 50322.58, balance: 322.58 },
  }
  for (const line of run.lines) {
    const exp = expected[line.employeeName]
    if (!exp) continue
    if (toAmount(line.net) !== exp.net || toAmount(line.salaryBalance) !== exp.balance) {
      console.warn(`WARN ${line.employeeName}: got net=${line.net} bal=${line.salaryBalance}, expected`, exp)
    } else {
      console.log(`OK ${line.employeeName}`)
    }
  }
  if (toAmount(totals.net) !== 224516.12) console.warn('WARN total earned', totals.net)
  if (toAmount(totals.paid) !== 200000) console.warn('WARN total paid', totals.paid)
  if (toAmount(totals.outstanding) !== 24516.12) console.warn('WARN total outstanding', totals.outstanding)

  await mongoose.disconnect()
  console.log('Done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
