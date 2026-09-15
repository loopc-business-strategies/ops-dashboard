/**
 * Wipe VB operational data (transactions, ledgers, stock/metal movements).
 * Keeps users (Nan), COA, parties, currencies, inventory items, metal rates.
 *
 * Dry-run (default):
 *   node backend/scripts/wipe-vb-ops-data.js
 *   node backend/scripts/wipe-vb-ops-data.js --staging
 *
 * Staging apply:
 *   APP_ENV=staging STAGING_MONGO_URI_VB=... \
 *   node backend/scripts/wipe-vb-ops-data.js --staging --apply --reason="VB ops wipe staging"
 *
 * Production apply (Railway env with MONGO_URI_VB):
 *   I_UNDERSTAND=WIPE-VB-OPS-DATA \
 *   node backend/scripts/wipe-vb-ops-data.js --apply --reason="VB ops wipe production"
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
require('../utils/configureAtlasDns')

const mongoose = require('mongoose')
const { getTenantUri } = require('../config/tenants')
const {
  mapStagingMongoToProcessEnv,
  assertStagingMongoTargets,
} = require('../utils/stagingMongoSafety')
const { looksLikeNonProductionUri, redactMongoUri } = require('../utils/migrationSafety')

const TENANT = 'vb'
const PROD_INTENT = 'WIPE-VB-OPS-DATA'

const OPS_COLLECTIONS = [
  'transactions',
  'ledgers',
  'stockmovements',
  'metalmovements',
]

const KEEP_COLLECTIONS = [
  'users',
  'chartofaccounts',
  'accountmappings',
  'currencies',
  'customers',
  'vendors',
  'inventoryitems',
  'metalrates',
]

function readArg(name) {
  const prefix = `${name}=`
  const hit = process.argv.find((a) => a.startsWith(prefix))
  return hit ? hit.slice(prefix.length) : ''
}

function hasFlag(name) {
  return process.argv.includes(name)
}

async function countCollections(db, names) {
  const out = {}
  for (const name of names) {
    try {
      out[name] = await db.collection(name).countDocuments({})
    } catch {
      out[name] = null
    }
  }
  return out
}

async function main() {
  const tenantArg = String(readArg('--tenant') || TENANT).trim().toLowerCase()
  const apply = hasFlag('--apply')
  const staging = hasFlag('--staging')
  const reason = String(readArg('--reason') || '').trim()

  if (tenantArg !== TENANT) {
    throw new Error(`This script is hard-locked to tenant=${TENANT}. Got: ${tenantArg}`)
  }

  if (apply && reason.length < 10) {
    throw new Error('--reason with at least 10 characters is required for --apply')
  }

  if (staging) {
    process.env.APP_ENV = 'staging'
    assertStagingMongoTargets([TENANT])
    Object.assign(process.env, mapStagingMongoToProcessEnv(process.env))
  } else if (apply) {
    if (String(process.env.I_UNDERSTAND || '').trim() !== PROD_INTENT) {
      throw new Error(`Refusing production wipe without I_UNDERSTAND=${PROD_INTENT}`)
    }
  }

  const uri = getTenantUri(TENANT)
  if (!uri) {
    throw new Error(
      staging
        ? 'STAGING_MONGO_URI_VB is not set (mapped to MONGO_URI_VB).'
        : 'MONGO_URI_VB is not set.',
    )
  }

  if (staging) {
    console.log(`[wipe-vb-ops] staging target: ${redactMongoUri(uri)}`)
  } else if (looksLikeNonProductionUri(uri)) {
    console.warn(`[warn] URI looks non-production: ${redactMongoUri(uri)}`)
  } else {
    console.log(`[wipe-vb-ops] prod target: ${redactMongoUri(uri)}`)
  }

  console.log(JSON.stringify({
    tenant: TENANT,
    staging,
    mode: apply ? 'apply' : 'dry-run',
    reason: apply ? reason : null,
    wipe: OPS_COLLECTIONS,
    keep: KEEP_COLLECTIONS,
  }, null, 2))

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
  })

  const db = mongoose.connection.db
  const beforeOps = await countCollections(db, OPS_COLLECTIONS)
  const beforeKeep = await countCollections(db, KEEP_COLLECTIONS)

  console.log('[before] ops:', beforeOps)
  console.log('[before] keep:', beforeKeep)

  if (!apply) {
    console.log('Dry-run only. No data was changed. Re-run with --apply --reason=... to wipe.')
    await mongoose.disconnect().catch(() => {})
    return
  }

  const deleted = {}
  for (const name of OPS_COLLECTIONS) {
    const result = await db.collection(name).deleteMany({})
    deleted[name] = result.deletedCount || 0
  }

  const afterOps = await countCollections(db, OPS_COLLECTIONS)
  const afterKeep = await countCollections(db, KEEP_COLLECTIONS)

  console.log('[deleted]', deleted)
  console.log('[after] ops:', afterOps)
  console.log('[after] keep:', afterKeep)

  const opsRemaining = OPS_COLLECTIONS.reduce((sum, name) => sum + (afterOps[name] || 0), 0)
  if (opsRemaining !== 0) {
    throw new Error(`Wipe incomplete: ops collections still have ${opsRemaining} documents`)
  }

  console.log('[wipe-vb-ops] COMPLETE — ops empty; masters/users untouched')
  await mongoose.disconnect().catch(() => {})
}

main().catch(async (err) => {
  console.error(err.message || err)
  try { await mongoose.disconnect() } catch { /* ignore */ }
  process.exit(1)
})
