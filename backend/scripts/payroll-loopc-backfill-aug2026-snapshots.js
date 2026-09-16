#!/usr/bin/env node
/**
 * Idempotent LoopC Aug 2026 snapshot backfill (additive only).
 *
 * For Aneesh / Biju / Sudheesh / Anil on the Aug 2026 run + payslips:
 * - position = Jewelry Maker
 * - periodStart / periodEnd = 2026-08-07 → 2026-08-31
 * - salaryCalculated / previousArrears / advanceDeduction / otherDeductions
 * - enforce payableDays=24, calendarDays=31
 *
 * Does NOT change monthlySalary, gross, net, amountPaid, or salaryBalance.
 * Does NOT delete or recreate documents.
 *
 * Usage:
 *   node backend/scripts/payroll-loopc-backfill-aug2026-snapshots.js
 */

require('dotenv').config()
const mongoose = require('mongoose')
const { connectTenant } = require('../db/tenantConnections')
const { isStructuredPayrollEnabled } = require('../config/tenantCapabilities')
const { toAmount, resolvePeriodBounds } = require('../services/payroll/payrollCalculationService')

const TENANT = 'loopc'
const YEAR = 2026
const MONTH = 8
const PAYABLE_DAYS = 24
const CALENDAR_DAYS = 31
const POSITION = 'Jewelry Maker'
const NAMES = ['Aneesh', 'Biju', 'Sudheesh', 'Anil']

const FIXTURE_SALARY_CALC = {
  Aneesh: 61935.48,
  Biju: 61935.48,
  Sudheesh: 50322.58,
  Anil: 50322.58,
}

function otherDeductionsFrom(doc) {
  const deductions = Array.isArray(doc.deductions) ? doc.deductions : []
  const sum = deductions
    .filter((d) => String(d.code || '').toUpperCase() !== 'ADV_DED')
    .reduce((s, d) => s + toAmount(d.amount), 0)
  return toAmount(sum)
}

function salaryCalculatedFrom(doc, name) {
  if (doc.salaryCalculated != null && Number.isFinite(Number(doc.salaryCalculated))) {
    return toAmount(doc.salaryCalculated)
  }
  const earnings = Array.isArray(doc.earnings) ? doc.earnings : []
  const prevComp = earnings.find((e) => String(e.code || '').toUpperCase() === 'PREV_ARREARS')
  if (prevComp) {
    return toAmount(Math.max(0, toAmount(doc.gross) - toAmount(prevComp.amount)))
  }
  if (FIXTURE_SALARY_CALC[name] != null) return FIXTURE_SALARY_CALC[name]
  return toAmount(doc.net)
}

function snapshotPatch(doc, name, joiningDate) {
  const { periodStart, periodEnd } = resolvePeriodBounds(YEAR, MONTH, joiningDate || doc.joiningDate)
  return {
    position: POSITION,
    payableDays: PAYABLE_DAYS,
    calendarDays: CALENDAR_DAYS,
    periodStart,
    periodEnd,
    salaryCalculated: salaryCalculatedFrom(doc, name),
    previousArrears: doc.previousArrears == null ? 0 : toAmount(doc.previousArrears),
    advanceDeduction: doc.advanceDeduction == null ? 0 : toAmount(doc.advanceDeduction),
    otherDeductions: otherDeductionsFrom(doc),
  }
}

function dateKey(d) {
  return d ? new Date(d).toISOString().slice(0, 10) : ''
}

function needsSnapshotUpdate(current, patch) {
  if (String(current.position || '') !== patch.position) return true
  if (Number(current.payableDays) !== patch.payableDays) return true
  if (Number(current.calendarDays) !== patch.calendarDays) return true
  if (dateKey(current.periodStart) !== dateKey(patch.periodStart)) return true
  if (dateKey(current.periodEnd) !== dateKey(patch.periodEnd)) return true
  if (current.salaryCalculated == null || toAmount(current.salaryCalculated) !== toAmount(patch.salaryCalculated)) return true
  if (current.previousArrears == null || toAmount(current.previousArrears) !== toAmount(patch.previousArrears)) return true
  if (current.advanceDeduction == null || toAmount(current.advanceDeduction) !== toAmount(patch.advanceDeduction)) return true
  if (current.otherDeductions == null || toAmount(current.otherDeductions) !== toAmount(patch.otherDeductions)) return true
  return false
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

  const Employee = require('../models/Employee')
  const PayrollRun = require('../models/PayrollRun')
  const Payslip = require('../models/Payslip')

  const TenantEmployee = await Employee.getTenantModel(TENANT)
  const TenantRun = await PayrollRun.getTenantModel(TENANT)
  const TenantSlip = await Payslip.getTenantModel(TENANT)

  const nameRes = NAMES.map((n) => new RegExp(`^${n}$`, 'i'))
  const employees = await TenantEmployee.find({
    name: { $in: nameRes },
    isDeleted: { $ne: true },
  })

  console.log(`Employees matched: ${employees.length}`)
  let empUpdated = 0
  for (const emp of employees) {
    const next = { position: POSITION, joiningDate: emp.joiningDate || new Date('2026-08-07T00:00:00.000Z') }
    let changed = false
    if (String(emp.position || '') !== POSITION) {
      emp.position = POSITION
      changed = true
    }
    if (!emp.joiningDate) {
      emp.joiningDate = next.joiningDate
      changed = true
    }
    if (changed) {
      await emp.save()
      empUpdated += 1
      console.log(`  Employee ${emp.name}: position → ${POSITION}`)
    }
  }

  const empById = new Map(employees.map((e) => [String(e._id), e]))
  const empIds = employees.map((e) => e._id)

  const run = await TenantRun.findOne({
    year: YEAR,
    month: MONTH,
    isDeleted: { $ne: true },
  })
  if (!run) {
    console.error('No Aug 2026 payroll run found for loopc')
    await mongoose.disconnect()
    process.exit(1)
  }

  console.log(`Run ${run._id} status=${run.status}`)

  let runChanged = false
  if (run.defaultPayableDays !== PAYABLE_DAYS) {
    run.defaultPayableDays = PAYABLE_DAYS
    runChanged = true
  }
  if (run.defaultCalendarDays !== CALENDAR_DAYS) {
    run.defaultCalendarDays = CALENDAR_DAYS
    runChanged = true
  }

  let linesUpdated = 0
  run.lines = (run.lines || []).map((line) => {
    const emp = empById.get(String(line.employeeId))
    const name = emp?.name || line.employeeName
    if (!NAMES.some((n) => n.toLowerCase() === String(name || '').toLowerCase())) {
      return line
    }
    const plain = line.toObject ? line.toObject() : { ...line }
    const patch = snapshotPatch(plain, name, emp?.joiningDate || line.joiningDate)
    if (!needsSnapshotUpdate(plain, patch)) return line
    linesUpdated += 1
    console.log(
      `  Line ${name}: position/period/days/snapshots ` +
        `(net=${plain.net} paid=${plain.amountPaid} bal=${plain.salaryBalance} unchanged)`
    )
    return { ...plain, ...patch }
  })

  if (runChanged || linesUpdated) {
    run.markModified('lines')
    await run.save()
  }
  console.log(`Run lines updated: ${linesUpdated}; defaults changed: ${runChanged}`)

  const slips = await TenantSlip.find({
    year: YEAR,
    month: MONTH,
    employeeId: { $in: empIds },
    isDeleted: { $ne: true },
  })

  let slipsUpdated = 0
  for (const slip of slips) {
    const emp = empById.get(String(slip.employeeId))
    const name = emp?.name || slip.employeeName
    const patch = snapshotPatch(slip, name, emp?.joiningDate || slip.joiningDate)
    if (!needsSnapshotUpdate(slip, patch)) continue

    const beforeMoney = {
      net: toAmount(slip.net),
      amountPaid: toAmount(slip.amountPaid),
      salaryBalance: toAmount(slip.salaryBalance),
      monthlySalary: toAmount(slip.monthlySalary),
    }

    Object.assign(slip, patch)
    await slip.save()

    const afterMoney = {
      net: toAmount(slip.net),
      amountPaid: toAmount(slip.amountPaid),
      salaryBalance: toAmount(slip.salaryBalance),
      monthlySalary: toAmount(slip.monthlySalary),
    }
    if (JSON.stringify(beforeMoney) !== JSON.stringify(afterMoney)) {
      throw new Error(`Money fields changed for payslip ${slip.number}: ${JSON.stringify({ beforeMoney, afterMoney })}`)
    }

    slipsUpdated += 1
    console.log(
      `  Payslip ${slip.number} (${name}): Jewelry Maker, period ${dateKey(patch.periodStart)}→${dateKey(patch.periodEnd)}, days=${PAYABLE_DAYS}`
    )
  }

  console.log('\nSummary:')
  console.log(`  employeesUpdated=${empUpdated}`)
  console.log(`  runLinesUpdated=${linesUpdated}`)
  console.log(`  payslipsUpdated=${slipsUpdated}`)
  console.log(`  payableDays confirmed=${PAYABLE_DAYS}`)
  console.log('Done.')

  await mongoose.disconnect()
}

main().catch(async (err) => {
  console.error(err)
  try {
    await mongoose.disconnect()
  } catch (_) {
    /* ignore */
  }
  process.exit(1)
})
