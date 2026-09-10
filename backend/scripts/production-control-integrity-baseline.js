/**
 * READ-ONLY integrity baseline for Production Control Center work.
 * Counts critical existing collections. Never writes, deletes, or migrates.
 *
 * Usage (from backend/):
 *   node scripts/production-control-integrity-baseline.js
 *
 * Requires a tenant Mongo URI (e.g. MONGO_URI_LOOPC).
 */
require('dotenv').config()

const mongoose = require('mongoose')
const { getTenantKeys, getTenantUri } = require('../config/tenants')

const LEGACY_COLLECTIONS = [
  'users',
  'employees',
  'workorders',
  'inventoryitems',
  'stockmovements',
  'auditlogs',
  'customers',
  'transactions',
]

async function countIfExists(db, name) {
  const cols = await db.listCollections({ name }).toArray()
  if (!cols.length) return { exists: false, count: 0 }
  const count = await db.collection(name).countDocuments()
  return { exists: true, count }
}

async function baselineTenant(tenant, uri) {
  const conn = await mongoose.createConnection(uri).asPromise()
  try {
    const db = conn.db
    const rows = {}
    for (const name of LEGACY_COLLECTIONS) {
      rows[name] = await countIfExists(db, name)
    }
    return rows
  } finally {
    await conn.close()
  }
}

async function main() {
  const tenants = getTenantKeys().filter((t) => getTenantUri(t))
  if (!tenants.length) {
    console.log('[integrity-baseline] No tenant URIs configured — skipping (safe no-op).')
    process.exit(0)
  }

  console.log('[integrity-baseline] READ-ONLY — no mutations will be performed\n')
  for (const tenant of tenants) {
    const uri = getTenantUri(tenant)
    console.log(`Tenant: ${tenant}`)
    try {
      const rows = await baselineTenant(tenant, uri)
      for (const [name, info] of Object.entries(rows)) {
        const label = info.exists ? String(info.count) : '(collection absent)'
        console.log(`  ${name}: ${label}`)
      }
    } catch (err) {
      console.log(`  ERROR (non-fatal): ${err.message}`)
    }
    console.log('')
  }
  console.log('[integrity-baseline] Done. Existing ERP data was not modified.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
