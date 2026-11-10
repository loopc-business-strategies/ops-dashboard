/**
 * Assign EMP-NNN codes to employees with blank/missing employeeCode only.
 * Does not rewrite valid codes. Includes archived rows when computing the sequence.
 *
 * Usage:
 *   node backend/scripts/backfill-blank-employee-codes.js
 *   node backend/scripts/backfill-blank-employee-codes.js --tenant=mg
 *   node backend/scripts/backfill-blank-employee-codes.js --dry-run
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const Employee = require('../models/Employee')
const { getTenantUri } = require('../config/tenants')
const { allocateNextEmployeeCode, parseEmployeeCodeSuffix } = require('../utils/employeeCode')
const { redactMongoUri } = require('../utils/migrationSafety')

const DEFAULT_TENANTS = ['mg', 'loopc']

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

async function backfillTenant(tenant, dryRun) {
  const uri = getTenantUri(tenant)
  if (!uri) return { tenant, skipped: true, reason: 'no uri' }

  console.log(`[${tenant}] ${redactMongoUri(uri)}`)
  const Model = await Employee.getTenantModel(tenant)
  const blank = await Model.find({
    $or: [
      { employeeCode: { $exists: false } },
      { employeeCode: null },
      { employeeCode: '' },
      { employeeCode: { $regex: /^\s*$/ } },
    ],
  })
    .select('_id name employeeCode isDeleted')
    .lean()

  const assigned = []
  for (const row of blank) {
    const next = await allocateNextEmployeeCode(Model)
    // allocateNext scans current DB; after each write the max increases
    if (dryRun) {
      assigned.push({ id: String(row._id), name: row.name, wouldAssign: next })
      // Simulate uniqueness for dry-run sequence by temporarily treating as used:
      // re-read max each loop via allocateNext which only sees real DB — bump manually
      assigned[assigned.length - 1].note = 'dry-run does not persist; sequential preview may collide until applied'
    } else {
      await Model.updateOne({ _id: row._id }, { $set: { employeeCode: next } })
      assigned.push({ id: String(row._id), name: row.name, employeeCode: next })
    }
  }

  const allCodes = await Model.find({}).select('employeeCode').lean()
  const maxSuffix = allCodes.reduce((m, r) => Math.max(m, parseEmployeeCodeSuffix(r.employeeCode)), 0)

  return {
    tenant,
    blankCount: blank.length,
    assigned,
    maxSuffix,
    dryRun,
  }
}

async function main() {
  const tenantArg = String(readArg('--tenant') || '').trim().toLowerCase()
  const dryRun = process.argv.includes('--dry-run')
  const tenants = tenantArg ? [tenantArg] : DEFAULT_TENANTS
  const reports = []
  for (const tenant of tenants) {
    reports.push(await backfillTenant(tenant, dryRun))
  }
  console.log(JSON.stringify({ reports }, null, 2))
  await mongoose.disconnect().catch(() => {})
}

main().catch(async (err) => {
  console.error(err.message || err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
