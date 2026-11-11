/**
 * Soft-delete / neutralize confirmed junk HR test employees so they never appear
 * in Attendance Log or active Employee List.
 *
 * Live MG data lives in database `ops-dashboard` on the MG cluster (not `ops_mg`).
 * Targets verified Mongo IDs (and optional exact names as secondary match), never
 * name-only mass deletes of genuine staff.
 *
 * Dry-run (default):
 *   node backend/scripts/soft-delete-junk-hr-employees.js --tenant=mg
 *   node backend/scripts/soft-delete-junk-hr-employees.js --tenant=mg --dry-run
 *
 * Apply:
 *   I_UNDERSTAND=SOFT-DELETE-JUNK-HR-EMPLOYEES \
 *     node backend/scripts/soft-delete-junk-hr-employees.js --tenant=mg --apply \
 *     --reason="Remove junk HR test employees from attendance log"
 *
 * Staging:
 *   APP_ENV=staging STAGING_MONGO_URI_MG=… \
 *     node backend/scripts/soft-delete-junk-hr-employees.js --tenant=mg --apply --staging \
 *     --reason="Remove junk HR test employees (staging)"
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const { getTenantUri } = require('../config/tenants')
const { getSoftDeleteFields } = require('../utils/softDelete')
const {
  mapStagingMongoToProcessEnv,
  assertStagingMongoTargets,
} = require('../utils/stagingMongoSafety')
const { looksLikeNonProductionUri, redactMongoUri } = require('../utils/migrationSafety')

/** Confirmed junk IDs from ops-dashboard (nan / raja / raja / john). */
const CONFIRMED_JUNK_IDS = [
  '6ae83fcc36ade59aa001381b', // nan
  '6ae838e62b75ecf79474f220', // raja (hr)
  '6ae4753744bf84e96bd82e04', // raja (empty dept)
  '6ae454de5f2a8daf8bfe7500', // john
]

const DEFAULT_REASON = 'junk test data removed from attendance log'
const LIVE_MG_DB = 'ops-dashboard'
const I_UNDERSTAND_TOKEN = 'SOFT-DELETE-JUNK-HR-EMPLOYEES'

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

function hasFlag(name) {
  return process.argv.includes(name)
}

/** Replace only the database path segment after host list (never touch mongodb://). */
function withDbName(uri, dbName) {
  const raw = String(uri || '')
  if (!raw) return raw
  const q = raw.indexOf('?')
  const noQuery = q >= 0 ? raw.slice(0, q) : raw
  const query = q >= 0 ? raw.slice(q) : ''
  const slash = noQuery.lastIndexOf('/')
  if (slash < 0) return raw
  return `${noQuery.slice(0, slash + 1)}${dbName}${query}`
}

function looksLikeJunkProfile(doc) {
  const name = String(doc?.name || '').trim().toLowerCase()
  if (!['nan', 'raja', 'john'].includes(name)) return false
  const code = String(doc?.employeeCode || '').trim().toLowerCase()
  const phone = String(doc?.phoneNumber || '').trim()
  const dept = String(doc?.department || '').trim()
  // Incomplete / non-standard codes and sparse profiles — not Uzbek production roster.
  const weakCode = !code || /^(emp[\s-]?0*\d+|0*\d+)$/i.test(code)
  const sparse = !phone || !dept
  return weakCode || sparse
}

async function run() {
  const tenant = String(readArg('--tenant') || 'mg').trim().toLowerCase()
  const apply = hasFlag('--apply')
  const staging = hasFlag('--staging')
  const reason = String(readArg('--reason') || (apply ? '' : DEFAULT_REASON)).trim() || DEFAULT_REASON

  if (apply && hasFlag('--dry-run')) {
    console.error('Use either --dry-run or --apply, not both.')
    process.exit(1)
  }

  if (apply) {
    if (reason.length < 10) {
      throw new Error('--reason with at least 10 characters is required for --apply')
    }
    if (staging) {
      process.env.APP_ENV = 'staging'
      assertStagingMongoTargets([tenant])
      Object.assign(process.env, mapStagingMongoToProcessEnv(process.env))
    } else if (String(process.env.I_UNDERSTAND || '').trim() !== I_UNDERSTAND_TOKEN) {
      throw new Error(`Refusing production soft-delete without I_UNDERSTAND=${I_UNDERSTAND_TOKEN}`)
    }
  }

  const baseUri = getTenantUri(tenant)
  if (!baseUri) {
    console.error(`No URI for tenant ${tenant}`)
    process.exit(1)
  }
  const uri = tenant === 'mg' ? withDbName(baseUri, LIVE_MG_DB) : baseUri
  if (apply && !staging) {
    if (looksLikeNonProductionUri(uri)) {
      console.warn(`[warn] URI for ${tenant} looks non-production: ${redactMongoUri(uri)}`)
    } else {
      console.log(`[prod] target ${tenant}: ${redactMongoUri(uri)}`)
    }
  }
  console.error(`[${tenant}] ${redactMongoUri(uri)} mode=${apply ? 'APPLY' : 'DRY-RUN'}`)

  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 20000 }).asPromise()
  const emp = conn.db.collection('employees')

  const byId = await emp.find({
    _id: { $in: CONFIRMED_JUNK_IDS.map((id) => new mongoose.Types.ObjectId(id)) },
  }).toArray()

  const results = []
  for (const row of byId) {
    const entry = {
      id: String(row._id),
      name: row.name,
      employeeCode: row.employeeCode || '',
      department: row.department || '',
      idNumber: row.idNumber || '',
      joiningDate: row.joiningDate || null,
      isDeleted: row.isDeleted === true,
      looksLikeJunk: looksLikeJunkProfile(row),
    }
    if (!entry.looksLikeJunk) {
      entry.skipped = true
      entry.reason = 'profile did not match junk heuristics — left untouched'
      results.push(entry)
      continue
    }
    if (apply) {
      const fields = getSoftDeleteFields(
        { user: { _id: null, name: 'soft-delete-junk-hr-employees' } },
        reason,
      )
      // Clear joiningDate so as-of eligibility can never resurrect them.
      await emp.updateOne(
        { _id: row._id },
        { $set: { ...fields, joiningDate: null } },
      )
      entry.softDeleted = true
      entry.joiningDateCleared = true
    } else {
      entry.wouldSoftDelete = true
      entry.wouldClearJoiningDate = true
    }
    results.push(entry)
  }

  const report = {
    tenant,
    database: conn.name,
    apply,
    confirmedIds: CONFIRMED_JUNK_IDS,
    matchedCount: results.length,
    employees: results,
  }
  console.log(JSON.stringify(report, null, 2))
  if (!apply) {
    console.error(`Dry-run only. Pass --apply with I_UNDERSTAND=${I_UNDERSTAND_TOKEN} and --reason to write.`)
  }
  await conn.close()
}

run().catch(async (err) => {
  console.error(err.message || err)
  process.exit(1)
})
