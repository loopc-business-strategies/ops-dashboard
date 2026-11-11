/**
 * Normalize bare numeric employee codes to EMP-NNN (e.g. 001 → EMP-001).
 * Does not renumber or close gaps. Leaves existing EMP-NNN codes unchanged.
 *
 * Live MG DB: ops-dashboard on MONGO_URI_MG cluster.
 *
 * Dry-run (default):
 *   node backend/scripts/normalize-employee-codes.js --tenant=mg
 *   node backend/scripts/normalize-employee-codes.js --tenant=mg --dry-run
 *
 * Apply:
 *   I_UNDERSTAND=NORMALIZE-EMPLOYEE-CODES \
 *     node backend/scripts/normalize-employee-codes.js --tenant=mg --apply \
 *     --reason="Normalize bare employee codes to EMP-NNN"
 *
 * Staging:
 *   APP_ENV=staging STAGING_MONGO_URI_MG=… \
 *     node backend/scripts/normalize-employee-codes.js --tenant=mg --apply --staging \
 *     --reason="Normalize bare employee codes (staging)"
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const { getTenantUri } = require('../config/tenants')
const { formatEmployeeCode, parseEmployeeCodeSuffix } = require('../utils/employeeCode')
const {
  mapStagingMongoToProcessEnv,
  assertStagingMongoTargets,
} = require('../utils/stagingMongoSafety')
const { looksLikeNonProductionUri, redactMongoUri } = require('../utils/migrationSafety')

const LIVE_MG_DB = 'ops-dashboard'
const I_UNDERSTAND_TOKEN = 'NORMALIZE-EMPLOYEE-CODES'

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

function hasFlag(name) {
  return process.argv.includes(name)
}

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

function toCanonical(code) {
  const raw = String(code || '').trim()
  if (!/^\d+$/.test(raw)) return null
  return formatEmployeeCode(Number(raw) || parseEmployeeCodeSuffix(raw))
}

async function run() {
  const tenant = String(readArg('--tenant') || 'mg').trim().toLowerCase()
  const apply = hasFlag('--apply')
  const staging = hasFlag('--staging')
  const reason = String(readArg('--reason') || '').trim()

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
      throw new Error(`Refusing production normalize without I_UNDERSTAND=${I_UNDERSTAND_TOKEN}`)
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

  const rows = await emp.find({}).project({
    name: 1,
    employeeCode: 1,
    isDeleted: 1,
  }).toArray()

  const byCode = new Map()
  for (const row of rows) {
    const key = String(row.employeeCode || '').trim().toUpperCase()
    if (!key) continue
    if (!byCode.has(key)) byCode.set(key, [])
    byCode.get(key).push(row)
  }

  function mapRemove(key, id) {
    const list = byCode.get(key) || []
    byCode.set(key, list.filter((r) => String(r._id) !== String(id)))
  }

  function mapAdd(key, doc) {
    if (!byCode.has(key)) byCode.set(key, [])
    byCode.get(key).push(doc)
  }

  const changes = []
  const skipped = []
  const freedArchived = []

  for (const row of rows) {
    const current = String(row.employeeCode || '').trim()
    const next = toCanonical(current)
    if (!next) continue
    if (next.toUpperCase() === current.toUpperCase()) continue

    const nextKey = next.toUpperCase()
    let taken = (byCode.get(nextKey) || []).filter((other) => String(other._id) !== String(row._id))

    // Soft-deleted holders of EMP-NNN (e.g. junk emp-001) should not block active staff.
    const archivedHolders = taken.filter((other) => other.isDeleted === true)
    const activeHolders = taken.filter((other) => other.isDeleted !== true)
    if (activeHolders.length > 0) {
      skipped.push({
        id: String(row._id),
        name: row.name,
        from: current,
        to: next,
        reason: 'target code already in use by active employee',
      })
      continue
    }

    for (const holder of archivedHolders) {
      const old = String(holder.employeeCode || '').trim()
      const freed = `ARCH-${old}`.slice(0, 40)
      const freeEntry = {
        id: String(holder._id),
        name: holder.name,
        from: old,
        to: freed,
        reason: `free ${next} for normalize`,
      }
      if (apply) {
        await emp.updateOne({ _id: holder._id }, { $set: { employeeCode: freed } })
        freeEntry.updated = true
      } else {
        freeEntry.wouldUpdate = true
      }
      mapRemove(old.toUpperCase(), holder._id)
      mapAdd(freed.toUpperCase(), { ...holder, employeeCode: freed })
      freedArchived.push(freeEntry)
      taken = taken.filter((other) => String(other._id) !== String(holder._id))
    }

    const entry = {
      id: String(row._id),
      name: row.name,
      isDeleted: row.isDeleted === true,
      from: current,
      to: next,
    }
    if (apply) {
      await emp.updateOne({ _id: row._id }, { $set: { employeeCode: next } })
      entry.updated = true
      mapRemove(current.toUpperCase(), row._id)
      mapAdd(nextKey, { ...row, employeeCode: next })
    } else {
      entry.wouldUpdate = true
    }
    changes.push(entry)
  }

  const activeCount = await emp.countDocuments({
    $or: [{ isDeleted: false }, { isDeleted: { $exists: false } }, { isDeleted: { $ne: true } }],
  })
  // Prefer explicit active semantics used by API
  const activeStrict = await emp.countDocuments({ isDeleted: { $ne: true } })

  console.log(JSON.stringify({
    tenant,
    database: conn.name,
    apply,
    reason: apply ? reason : undefined,
    changedCount: changes.length,
    freedArchivedCount: freedArchived.length,
    skippedCount: skipped.length,
    changes,
    freedArchived,
    skipped,
    activeEmployeeTotal: activeStrict,
    activeEmployeeTotalAlt: activeCount,
  }, null, 2))
  if (!apply) {
    console.error(`Dry-run only. Pass --apply with I_UNDERSTAND=${I_UNDERSTAND_TOKEN} and --reason to write.`)
  }

  await conn.close()
}

run().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
