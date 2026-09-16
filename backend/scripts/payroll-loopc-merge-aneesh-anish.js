#!/usr/bin/env node
/**
 * Idempotent LoopC merge: Anish (loopc/emp/001) → Aneesh (LoopC-ANEESH).
 *
 * - Survivor: LoopC-ANEESH (Aug payroll linked)
 * - Merge blank profile fields from loopc/emp/001
 * - Soft-delete Anish only (isDeleted=true)
 * - Deactivate Anish salary assignments if any
 * - Does NOT hard-delete, does NOT change payslip money fields
 *
 * Usage:
 *   node backend/scripts/payroll-loopc-merge-aneesh-anish.js
 *
 * Safety: staging-only guard; soft-delete Anish only; no hard delete; payslip money unchanged.
 */

require('dotenv').config()
const { assertStagingOnlyScript } = require('../utils/assertStagingOnlyScript')
const mongoose = require('mongoose')
const { connectTenant } = require('../db/tenantConnections')
const { isStructuredPayrollEnabled } = require('../config/tenantCapabilities')
const { toAmount } = require('../services/payroll/payrollCalculationService')

const TENANT = 'loopc'
assertStagingOnlyScript({
  scriptName: 'payroll-loopc-merge-aneesh-anish.js',
  tenants: [TENANT],
})
const SURVIVOR_CODE = 'LoopC-ANEESH'
const DUPLICATE_CODE = 'loopc/emp/001'

function blank(v) {
  return v == null || String(v).trim() === ''
}

function mergeProfile(survivor, donor) {
  const fields = [
    'department',
    'address',
    'phoneNumber',
    'email',
    'emergencyContactName',
    'emergencyContactPhone',
    'idNumber',
    'photoUrl',
    'shift',
    'contractRef',
    'salaryRef',
    'managerName',
  ]
  const set = {}
  for (const f of fields) {
    if (blank(survivor[f]) && !blank(donor[f])) set[f] = donor[f]
  }
  // Prefer Jewelry Maker already on survivor; only fill if blank
  if (blank(survivor.position) && !blank(donor.position)) set.position = donor.position
  if (!survivor.joiningDate && donor.joiningDate) set.joiningDate = donor.joiningDate
  return set
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
  const Payslip = require('../models/Payslip')
  const PayrollRun = require('../models/PayrollRun')
  const SalaryBalance = require('../models/SalaryBalance')
  const EmployeeSalaryAssignment = require('../models/EmployeeSalaryAssignment')

  const TenantEmployee = await Employee.getTenantModel(TENANT)
  const TenantSlip = await Payslip.getTenantModel(TENANT)
  const TenantRun = await PayrollRun.getTenantModel(TENANT)
  const TenantBal = await SalaryBalance.getTenantModel(TENANT)
  const TenantAsg = await EmployeeSalaryAssignment.getTenantModel(TENANT)

  let survivor = await TenantEmployee.findOne({ employeeCode: SURVIVOR_CODE, isDeleted: { $ne: true } })
  let duplicate = await TenantEmployee.findOne({ employeeCode: DUPLICATE_CODE, isDeleted: { $ne: true } })

  if (!survivor) {
    const byName = await TenantEmployee.find({ name: /^Aneesh$/i, isDeleted: { $ne: true } })
    if (byName.length === 1) survivor = byName[0]
  }
  if (!duplicate) {
    const byName = await TenantEmployee.find({ name: /^Anish$/i, isDeleted: { $ne: true } })
    if (byName.length === 1) duplicate = byName[0]
  }

  if (!survivor) {
    console.error(`Survivor not found (${SURVIVOR_CODE} / Aneesh)`)
    process.exit(1)
  }
  if (!duplicate) {
    const soft = await TenantEmployee.collection.findOne({
      employeeCode: DUPLICATE_CODE,
      isDeleted: true,
    })
    if (soft) {
      console.log(`Duplicate ${DUPLICATE_CODE} already soft-deleted. Idempotent exit.`)
      await mongoose.disconnect()
      return
    }
    console.error(`Duplicate not found (${DUPLICATE_CODE} / Anish)`)
    process.exit(1)
  }

  if (String(survivor._id) === String(duplicate._id)) {
    console.log('Survivor and duplicate are the same document. Nothing to do.')
    await mongoose.disconnect()
    return
  }

  // Raw check — Employee schema may not declare isDeleted
  const dupRaw = await TenantEmployee.collection.findOne({ _id: duplicate._id })
  if (dupRaw?.isDeleted === true) {
    console.log(`Duplicate ${duplicate.employeeCode} already soft-deleted. Idempotent exit.`)
    await mongoose.disconnect()
    return
  }

  const survivorPayslips = await TenantSlip.countDocuments({
    employeeId: survivor._id,
    isDeleted: { $ne: true },
  })
  const duplicatePayslips = await TenantSlip.countDocuments({
    employeeId: duplicate._id,
    isDeleted: { $ne: true },
  })

  console.log('Before:')
  console.log(`  survivor=${survivor.name} (${survivor.employeeCode}) id=${survivor._id} payslips=${survivorPayslips}`)
  console.log(`  duplicate=${duplicate.name} (${duplicate.employeeCode}) id=${duplicate._id} payslips=${duplicatePayslips}`)

  if (survivorPayslips === 0 && duplicatePayslips > 0) {
    console.error('ABORT: payroll payslips are on Anish, not Aneesh. Refusing merge direction.')
    process.exit(1)
  }
  if (survivorPayslips === 0) {
    // Still allow if run lines reference survivor
    const run = await TenantRun.findOne({ year: 2026, month: 8, isDeleted: { $ne: true } }).lean()
    const onRun = (run?.lines || []).some((l) => String(l.employeeId) === String(survivor._id))
    if (!onRun) {
      console.error('ABORT: survivor has no Aug payslips/run lines. Refusing to soft-delete without payroll anchor.')
      process.exit(1)
    }
  }

  const beforeMoney = await TenantSlip.find({
    employeeId: survivor._id,
    isDeleted: { $ne: true },
  }).select('number net amountPaid salaryBalance').lean()

  const profileSet = mergeProfile(survivor, duplicate)
  if (Object.keys(profileSet).length) {
    await TenantEmployee.updateOne({ _id: survivor._id }, { $set: profileSet })
    console.log('Merged profile fields onto survivor:', profileSet)
  } else {
    console.log('No blank profile fields to merge onto survivor.')
  }

  // Soft-delete duplicate (no hard delete) — strict:false so isDeleted persists on Employee schema
  await TenantEmployee.updateOne(
    { _id: duplicate._id },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        deletionReason: 'Merged into LoopC-ANEESH (Aneesh); duplicate of Anish/Aneesh',
        status: 'INACTIVE',
      },
    },
    { strict: false }
  )
  console.log(`Soft-deleted duplicate ${duplicate.employeeCode} (${duplicate.name})`)

  // Deactivate Anish salary assignments (do not create duplicates on Aneesh)
  const asgRes = await TenantAsg.updateMany(
    { employeeId: duplicate._id, isActive: true, isDeleted: { $ne: true } },
    { $set: { isActive: false } }
  )
  console.log(`Deactivated Anish salary assignments: ${asgRes.modifiedCount || 0}`)

  const afterMoney = await TenantSlip.find({
    employeeId: survivor._id,
    isDeleted: { $ne: true },
  }).select('number net amountPaid salaryBalance').lean()

  const moneyOk = beforeMoney.length === afterMoney.length
    && beforeMoney.every((b, i) => {
      const a = afterMoney.find((x) => x.number === b.number) || afterMoney[i]
      return a
        && toAmount(a.net) === toAmount(b.net)
        && toAmount(a.amountPaid) === toAmount(b.amountPaid)
        && toAmount(a.salaryBalance) === toAmount(b.salaryBalance)
    })
  if (!moneyOk) {
    console.error('ABORT check failed: survivor payslip money changed unexpectedly')
    process.exit(1)
  }

  const activeEmps = await TenantEmployee.find({
    isDeleted: { $ne: true },
    name: { $in: [/^Aneesh$/i, /^Anish$/i] },
  }).select('name employeeCode department position status').lean()

  const survivorAfter = await TenantEmployee.findById(survivor._id).lean()
  const balCount = await TenantBal.countDocuments({ employeeId: survivor._id, isDeleted: { $ne: true } })

  console.log('\nAfter:')
  console.log(`  survivor department=${survivorAfter.department || '—'} position=${survivorAfter.position || '—'}`)
  console.log(`  active Aneesh/Anish count=${activeEmps.length}`, activeEmps)
  console.log(`  survivor payslips=${afterMoney.length} balances=${balCount}`)
  console.log('  payslip money unchanged: OK')
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
