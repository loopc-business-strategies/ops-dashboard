/**
 * Soft-delete junk HR test employees that pollute Attendance Log / Employee List.
 * Targets exact names (case-insensitive): nan, raja, john.
 * Does NOT hard-delete employees or attendance records.
 *
 * Usage:
 *   node backend/scripts/soft-delete-junk-hr-employees.js --tenant=mg --dry-run
 *   node backend/scripts/soft-delete-junk-hr-employees.js --tenant=mg --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const Employee = require('../models/Employee')
const { getTenantUri } = require('../config/tenants')
const { getSoftDeleteFields } = require('../utils/softDelete')
const { redactMongoUri } = require('../utils/migrationSafety')

const DEFAULT_JUNK_NAMES = ['nan', 'raja', 'john']
const REASON = 'junk test data removed from attendance log'

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

function resolveJunkNames() {
  const raw = String(readArg('--names') || '').trim()
  if (!raw) return DEFAULT_JUNK_NAMES
  return raw.split(',').map((n) => n.trim()).filter(Boolean)
}

async function runTenant(tenant, apply, junkNames) {
  const uri = getTenantUri(tenant)
  if (!uri) return { tenant, skipped: true, reason: 'no uri' }

  console.error(`[${tenant}] ${redactMongoUri(uri)} mode=${apply ? 'APPLY' : 'DRY-RUN'}`)
  const Model = await Employee.getTenantModel(tenant)
  const nameRegex = new RegExp(
    `^(${junkNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})$`,
    'i',
  )

  const matches = await Model.find({
    name: nameRegex,
    isDeleted: { $ne: true },
  })
    .select('_id name employeeCode department joiningDate isDeleted')
    .lean()

  const results = []
  for (const row of matches) {
    const entry = {
      id: String(row._id),
      name: row.name,
      employeeCode: row.employeeCode || '',
      department: row.department || '',
      joiningDate: row.joiningDate || null,
    }
    if (apply) {
      await Model.updateOne(
        { _id: row._id, isDeleted: { $ne: true } },
        {
          $set: getSoftDeleteFields(
            { user: { _id: null, name: 'soft-delete-junk-hr-employees' } },
            REASON,
          ),
        },
        { strict: false },
      )
      entry.softDeleted = true
    } else {
      entry.wouldSoftDelete = true
    }
    results.push(entry)
  }

  return {
    tenant,
    apply,
    junkNames,
    matchedCount: matches.length,
    employees: results,
  }
}

async function main() {
  const tenant = String(readArg('--tenant') || 'mg').trim().toLowerCase()
  const junkNames = resolveJunkNames()
  const apply = process.argv.includes('--apply')
  if (apply && process.argv.includes('--dry-run')) {
    console.error('Use either --dry-run or --apply, not both. Prefer --dry-run first.')
    process.exit(1)
  }

  const report = await runTenant(tenant, apply, junkNames)
  console.log(JSON.stringify(report, null, 2))
  if (!apply && report.matchedCount === 0) {
    console.error('No active matches. Confirm tenant URI and names (or pass --names=a,b,c).')
  }
  await mongoose.disconnect().catch(() => {})
}

main().catch(async (err) => {
  console.error(err.message || err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
