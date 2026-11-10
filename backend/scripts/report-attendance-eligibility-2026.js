/**
 * Read-only: MG (or tenant) employee joining dates and Attendance Log eligibility
 * for the 1st of each month in 2026. Does not mutate data.
 *
 * Usage:
 *   node backend/scripts/report-attendance-eligibility-2026.js
 *   node backend/scripts/report-attendance-eligibility-2026.js --tenant=mg
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const Employee = require('../models/Employee')
const { getTenantUri } = require('../config/tenants')
const {
  isEmployedOnDate,
  toEmploymentDateKey,
} = require('../utils/employeeEmployment')
const { redactMongoUri } = require('../utils/migrationSafety')

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

async function reportTenant(tenant) {
  const uri = getTenantUri(tenant)
  if (!uri) return { tenant, skipped: true, reason: 'no uri' }

  console.error(`[${tenant}] ${redactMongoUri(uri)}`)
  const Model = await Employee.getTenantModel(tenant)
  const rows = await Model.find({})
    .select('name employeeCode joiningDate isDeleted deletedAt status')
    .lean()

  const roster = rows.map((r) => ({
    id: String(r._id),
    name: r.name,
    employeeCode: r.employeeCode,
    joiningDate: toEmploymentDateKey(r.joiningDate),
    isDeleted: r.isDeleted === true,
    deletedAt: toEmploymentDateKey(r.deletedAt),
    status: r.status || '',
  }))

  const missingJoin = roster.filter((r) => !r.joiningDate)
  const months = []
  for (let m = 1; m <= 12; m += 1) {
    const asOf = `2026-${String(m).padStart(2, '0')}-01`
    const eligible = roster.filter((r) => isEmployedOnDate({
      joiningDate: r.joiningDate,
      isDeleted: r.isDeleted,
      deletedAt: r.deletedAt,
    }, asOf))
    months.push({
      asOf,
      eligibleCount: eligible.length,
      employees: eligible.map((e) => ({
        name: e.name,
        employeeCode: e.employeeCode,
        joiningDate: e.joiningDate,
      })),
    })
  }

  const today = new Date()
  const todayKey = `${today.getUTCFullYear()}-${String(today.getUTCMonth() + 1).padStart(2, '0')}-${String(today.getUTCDate()).padStart(2, '0')}`
  const todayEligible = roster.filter((r) => isEmployedOnDate({
    joiningDate: r.joiningDate,
    isDeleted: r.isDeleted,
    deletedAt: r.deletedAt,
  }, todayKey))

  return {
    tenant,
    totalEmployees: roster.length,
    missingJoiningDateCount: missingJoin.length,
    missingJoiningDate: missingJoin.map((r) => ({
      name: r.name,
      employeeCode: r.employeeCode,
      isDeleted: r.isDeleted,
    })),
    months2026: months,
    today: {
      asOf: todayKey,
      eligibleCount: todayEligible.length,
    },
  }
}

async function main() {
  const tenantArg = String(readArg('--tenant') || 'mg').trim().toLowerCase()
  const report = await reportTenant(tenantArg)
  console.log(JSON.stringify(report, null, 2))
  await mongoose.disconnect().catch(() => {})
}

main().catch(async (err) => {
  console.error(err.message || err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
