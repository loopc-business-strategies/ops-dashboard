#!/usr/bin/env node
/**
 * Read-only LoopC payroll migration inventory report.
 *
 * Usage:
 *   node backend/scripts/payroll-loopc-migration-report.js
 *   node backend/scripts/payroll-loopc-migration-report.js --backfill   # optional idempotent assignment backfill
 *
 * Safety:
 *   - Default mode is READ-ONLY (counts + markdown report).
 *   - Never drops collections or mass-deletes records.
 *   - Backfill only creates EmployeeSalaryAssignment when FinancePayroll.emp
 *     uniquely matches Employee.name (case-insensitive). Ambiguous matches are flagged.
 */

require('dotenv').config()
const fs = require('fs')
const path = require('path')
const mongoose = require('mongoose')
const { connectTenant } = require('../db/tenantConnections')
const { isStructuredPayrollEnabled } = require('../config/tenantCapabilities')

const TENANT = 'loopc'
const doBackfill = process.argv.includes('--backfill')

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

  // Prefer getTenantModel which registers schemas
  const Emp = require('../models/Employee')
  const FinPay = require('../models/FinancePayroll')
  const Asg = require('../models/EmployeeSalaryAssignment')
  const Run = require('../models/PayrollRun')
  const Slip = require('../models/Payslip')

  const TenantEmployee = await Emp.getTenantModel(TENANT)
  const TenantPayroll = await FinPay.getTenantModel(TENANT)
  const TenantAsg = await Asg.getTenantModel(TENANT)
  const TenantRun = await Run.getTenantModel(TENANT)
  const TenantSlip = await Slip.getTenantModel(TENANT)

  const [employees, payrollRows, assignments, runs, payslips] = await Promise.all([
    TenantEmployee.find({ isDeleted: { $ne: true } }).lean(),
    TenantPayroll.find({ isDeleted: { $ne: true } }).lean(),
    TenantAsg.find({ isDeleted: { $ne: true } }).lean(),
    TenantRun.find({ isDeleted: { $ne: true } }).select('-lines').lean(),
    TenantSlip.find({ isDeleted: { $ne: true } }).lean(),
  ])

  const empByName = new Map()
  for (const e of employees) {
    const key = String(e.name || '').trim().toLowerCase()
    if (!key) continue
    if (!empByName.has(key)) empByName.set(key, [])
    empByName.get(key).push(e)
  }

  const uniqueMatches = []
  const ambiguous = []
  const unmatched = []

  for (const row of payrollRows) {
    const key = String(row.emp || '').trim().toLowerCase()
    if (!key) {
      unmatched.push({ payrollId: row._id, emp: row.emp, reason: 'empty emp' })
      continue
    }
    const hits = empByName.get(key) || []
    if (hits.length === 1) {
      uniqueMatches.push({ payroll: row, employee: hits[0] })
    } else if (hits.length > 1) {
      ambiguous.push({ payrollId: row._id, emp: row.emp, matches: hits.map((h) => h.employeeCode) })
    } else {
      unmatched.push({ payrollId: row._id, emp: row.emp, reason: 'no employee name match' })
    }
  }

  const fieldInventory = {
    employeeSampleFields: employees[0] ? Object.keys(employees[0]).sort() : [],
    financePayrollSampleFields: payrollRows[0] ? Object.keys(payrollRows[0]).sort() : [],
  }

  const lines = []
  lines.push('# LoopC Payroll Migration Report')
  lines.push('')
  lines.push(`Generated: ${new Date().toISOString()}`)
  lines.push(`Tenant: ${TENANT}`)
  lines.push(`Mode: ${doBackfill ? 'BACKFILL (idempotent create only)' : 'READ-ONLY'}`)
  lines.push('')
  lines.push('## Counts')
  lines.push(`- Employees: ${employees.length}`)
  lines.push(`- FinancePayroll rows: ${payrollRows.length}`)
  lines.push(`- EmployeeSalaryAssignment docs: ${assignments.length}`)
  lines.push(`- PayrollRun docs: ${runs.length}`)
  lines.push(`- Payslip docs: ${payslips.length}`)
  lines.push('')
  lines.push('## Name-match inventory (FinancePayroll.emp → Employee.name)')
  lines.push(`- Unique matches: ${uniqueMatches.length}`)
  lines.push(`- Ambiguous: ${ambiguous.length}`)
  lines.push(`- Unmatched: ${unmatched.length}`)
  lines.push('')
  lines.push('## Field inventory')
  lines.push('### Employee')
  lines.push('```')
  lines.push(fieldInventory.employeeSampleFields.join(', ') || '(none)')
  lines.push('```')
  lines.push('### FinancePayroll')
  lines.push('```')
  lines.push(fieldInventory.financePayrollSampleFields.join(', ') || '(none)')
  lines.push('```')
  lines.push('')
  if (ambiguous.length) {
    lines.push('## Ambiguous matches (not backfilled)')
    for (const a of ambiguous.slice(0, 50)) {
      lines.push(`- emp="${a.emp}" → codes [${a.matches.join(', ')}]`)
    }
    lines.push('')
  }
  if (unmatched.length) {
    lines.push('## Unmatched (sample)')
    for (const u of unmatched.slice(0, 50)) {
      lines.push(`- emp="${u.emp}" (${u.reason})`)
    }
    lines.push('')
  }

  let created = 0
  let skippedExisting = 0
  if (doBackfill) {
    lines.push('## Backfill results')
    for (const { payroll, employee } of uniqueMatches) {
      const existing = await TenantAsg.findOne({
        employeeId: employee._id,
        isActive: true,
        isDeleted: { $ne: true },
      }).lean()
      if (existing) {
        skippedExisting += 1
        continue
      }
      await TenantAsg.create({
        employeeId: employee._id,
        earnings: [
          { code: 'BASIC', label: 'Basic', amount: Number(payroll.basic) || 0 },
          { code: 'ALLOW', label: 'Allowances', amount: Number(payroll.allow) || 0 },
        ].filter((c) => c.amount > 0),
        deductions: Number(payroll.ded) > 0
          ? [{ code: 'DED', label: 'Deductions', amount: Number(payroll.ded) || 0 }]
          : [],
        employerContributions: [],
        effectiveFrom: new Date(),
        version: 1,
        isActive: true,
        notes: `Backfilled from FinancePayroll ${payroll._id} (unique name match)`,
        createdByName: 'migration-report',
      })
      created += 1
    }
    lines.push(`- Created assignments: ${created}`)
    lines.push(`- Skipped (already had active assignment): ${skippedExisting}`)
    lines.push(`- Ambiguous skipped: ${ambiguous.length}`)
    lines.push(`- Unmatched skipped: ${unmatched.length}`)
    lines.push('')
  }

  lines.push('## Safety')
  lines.push('- No collections dropped or mass-deleted.')
  lines.push('- FinancePayroll left intact.')
  lines.push('- Backfill never invents amounts for ambiguous/unmatched rows.')
  lines.push('')

  const outDir = path.join(__dirname, '../../docs')
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, 'loopc-payroll-migration-report.md')
  fs.writeFileSync(outPath, lines.join('\n'), 'utf8')
  console.log(`Wrote ${outPath}`)
  console.log(`Employees=${employees.length} FinancePayroll=${payrollRows.length} uniqueMatches=${uniqueMatches.length} ambiguous=${ambiguous.length}`)
  if (doBackfill) console.log(`Backfill created=${created} skippedExisting=${skippedExisting}`)

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
