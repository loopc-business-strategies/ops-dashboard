/**
 * Normalize bare numeric employee codes to EMP-NNN (e.g. 001 → EMP-001).
 * Does not renumber or close gaps. Leaves existing EMP-NNN codes unchanged.
 *
 * Live MG DB: ops-dashboard on MONGO_URI_MG cluster.
 *
 * Usage:
 *   node backend/scripts/normalize-employee-codes.js --tenant=mg --dry-run
 *   node backend/scripts/normalize-employee-codes.js --tenant=mg --apply
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const { getTenantUri } = require('../config/tenants')
const { formatEmployeeCode, parseEmployeeCodeSuffix } = require('../utils/employeeCode')
const { redactMongoUri } = require('../utils/migrationSafety')

const LIVE_MG_DB = 'ops-dashboard'

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
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
  const apply = process.argv.includes('--apply')
  if (apply && process.argv.includes('--dry-run')) {
    console.error('Use either --dry-run or --apply, not both.')
    process.exit(1)
  }

  const baseUri = getTenantUri(tenant)
  if (!baseUri) {
    console.error(`No URI for tenant ${tenant}`)
    process.exit(1)
  }
  const uri = tenant === 'mg' ? withDbName(baseUri, LIVE_MG_DB) : baseUri
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
    changedCount: changes.length,
    freedArchivedCount: freedArchived.length,
    skippedCount: skipped.length,
    changes,
    freedArchived,
    skipped,
    activeEmployeeTotal: activeStrict,
    activeEmployeeTotalAlt: activeCount,
  }, null, 2))

  await conn.close()
}

run().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
