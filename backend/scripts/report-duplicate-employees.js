/**
 * Read-only report of active Employee duplicates by normalized National ID / phone.
 * Does NOT delete or modify records. Soft-delete extras via HR Employee List before
 * unique indexes can be applied cleanly on tenants with collisions.
 *
 * Usage:
 *   node backend/scripts/report-duplicate-employees.js
 *   node backend/scripts/report-duplicate-employees.js --tenant=mg
 *
 * Exit code 1 if any active collisions are found.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const Employee = require('../models/Employee')
const { getTenantUri } = require('../config/tenants')
const { normalizeIdNumber, normalizePhoneNumber } = require('../utils/employeeIdentity')
const { redactMongoUri } = require('../utils/migrationSafety')

const DEFAULT_TENANTS = ['mg', 'loopc']

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

function groupBy(list, keyFn) {
  const map = new Map()
  for (const item of list) {
    const key = keyFn(item)
    if (!key) continue
    if (!map.has(key)) map.set(key, [])
    map.get(key).push(item)
  }
  return [...map.entries()].filter(([, rows]) => rows.length > 1)
}

async function reportTenant(tenant) {
  const uri = getTenantUri(tenant)
  if (!uri) return { tenant, skipped: true, reason: 'no uri' }

  console.log(`[${tenant}] ${redactMongoUri(uri)}`)
  const Model = await Employee.getTenantModel(tenant)
  const rows = await Model.find({ isDeleted: { $ne: true } })
    .select('_id name idNumber phoneNumber employeeCode idNumberNormalized phoneNormalized')
    .lean()

  const withNorm = rows.map((r) => ({
    ...r,
    idNorm: r.idNumberNormalized || normalizeIdNumber(r.idNumber),
    phoneNorm: r.phoneNormalized || normalizePhoneNumber(r.phoneNumber),
  }))

  const idDupes = groupBy(withNorm, (r) => r.idNorm)
  const phoneDupes = groupBy(withNorm, (r) => r.phoneNorm)

  return {
    tenant,
    activeCount: rows.length,
    idDuplicateGroups: idDupes.map(([key, members]) => ({
      idNumberNormalized: key,
      employees: members.map((m) => ({
        id: String(m._id),
        name: m.name,
        employeeCode: m.employeeCode,
        idNumber: m.idNumber,
      })),
    })),
    phoneDuplicateGroups: phoneDupes.map(([key, members]) => ({
      phoneNormalized: key,
      employees: members.map((m) => ({
        id: String(m._id),
        name: m.name,
        employeeCode: m.employeeCode,
        phoneNumber: m.phoneNumber,
      })),
    })),
  }
}

async function main() {
  const tenantArg = String(readArg('--tenant') || '').trim().toLowerCase()
  const tenants = tenantArg ? [tenantArg] : DEFAULT_TENANTS
  const reports = []
  for (const tenant of tenants) {
    reports.push(await reportTenant(tenant))
  }

  console.log(JSON.stringify({ reports }, null, 2))

  const hasCollisions = reports.some((r) => (
    (r.idDuplicateGroups && r.idDuplicateGroups.length > 0)
    || (r.phoneDuplicateGroups && r.phoneDuplicateGroups.length > 0)
  ))

  if (hasCollisions) {
    console.error('Active duplicate employees found. Soft-delete extras in HR before relying on unique indexes.')
    await mongoose.disconnect().catch(() => {})
    process.exit(1)
  }

  console.log('No active ID/phone duplicate groups found.')
  await mongoose.disconnect().catch(() => {})
}

main().catch(async (err) => {
  console.error(err.message || err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
