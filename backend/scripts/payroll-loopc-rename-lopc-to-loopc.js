#!/usr/bin/env node
/**
 * Idempotent LoopC rename: LOPC- → LoopC- on payslip numbers and employee codes.
 *
 * Usage:
 *   node backend/scripts/payroll-loopc-rename-lopc-to-loopc.js
 *
 * Safety: loopc only; skips docs already using LoopC-; unique-index safe via temp suffix.
 */

require('dotenv').config()
const mongoose = require('mongoose')
const { connectTenant } = require('../db/tenantConnections')
const { isStructuredPayrollEnabled } = require('../config/tenantCapabilities')

const TENANT = 'loopc'
const FROM = 'LOPC-'
const TO = 'LoopC-'

function renamePrefix(value) {
  const s = String(value || '')
  if (!s.startsWith(FROM)) return null
  return TO + s.slice(FROM.length)
}

async function renameFieldDocs(Model, field, label) {
  const docs = await Model.find({ [field]: { $regex: `^${FROM}` } }).select(`_id ${field}`).lean()
  let updated = 0
  let skipped = 0
  for (const doc of docs) {
    const next = renamePrefix(doc[field])
    if (!next) {
      skipped += 1
      continue
    }
    const clash = await Model.findOne({ [field]: next, _id: { $ne: doc._id } }).select('_id').lean()
    if (clash) {
      console.warn(`  skip ${label} ${doc[field]} → ${next} (target exists)`)
      skipped += 1
      continue
    }
    // Two-step when unique index present (payslip.number, employee.employeeCode)
    const temp = `${next}__tmp_rename_${doc._id}`
    await Model.updateOne({ _id: doc._id }, { $set: { [field]: temp } })
    await Model.updateOne({ _id: doc._id }, { $set: { [field]: next } })
    updated += 1
    console.log(`  ${label}: ${doc[field]} → ${next}`)
  }
  return { scanned: docs.length, updated, skipped }
}

async function renameNestedLineCodes(RunModel) {
  const runs = await RunModel.find({ 'lines.employeeCode': { $regex: `^${FROM}` } }).select('_id lines').lean()
  let updated = 0
  for (const run of runs) {
    let changed = false
    const lines = (run.lines || []).map((line) => {
      const next = renamePrefix(line.employeeCode)
      if (!next) return line
      changed = true
      return { ...line, employeeCode: next }
    })
    if (!changed) continue
    await RunModel.updateOne({ _id: run._id }, { $set: { lines } })
    updated += 1
    console.log(`  PayrollRun ${run._id}: renamed line employeeCode(s)`)
  }
  return { scanned: runs.length, updated }
}

async function main() {
  if (!isStructuredPayrollEnabled(TENANT)) {
    console.error('Structured payroll is not enabled for tenant:', TENANT)
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
  const EmployeeAdvance = require('../models/EmployeeAdvance')

  const TenantEmployee = await Employee.getTenantModel(TENANT)
  const TenantSlip = await Payslip.getTenantModel(TENANT)
  const TenantRun = await PayrollRun.getTenantModel(TENANT)
  const TenantBalance = await SalaryBalance.getTenantModel(TENANT)
  const TenantAdvance = await EmployeeAdvance.getTenantModel(TENANT)

  console.log(`Renaming ${FROM} → ${TO} on tenant ${TENANT}`)

  const slips = await renameFieldDocs(TenantSlip, 'number', 'Payslip.number')
  const slipCodes = await renameFieldDocs(TenantSlip, 'employeeCode', 'Payslip.employeeCode')
  const emps = await renameFieldDocs(TenantEmployee, 'employeeCode', 'Employee.employeeCode')
  const bals = await renameFieldDocs(TenantBalance, 'employeeCode', 'SalaryBalance.employeeCode')
  const advs = await renameFieldDocs(TenantAdvance, 'employeeCode', 'EmployeeAdvance.employeeCode')
  const runs = await renameNestedLineCodes(TenantRun)

  console.log('\nSummary:')
  console.log('  Payslip.number', slips)
  console.log('  Payslip.employeeCode', slipCodes)
  console.log('  Employee.employeeCode', emps)
  console.log('  SalaryBalance.employeeCode', bals)
  console.log('  EmployeeAdvance.employeeCode', advs)
  console.log('  PayrollRun.lines', runs)
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
