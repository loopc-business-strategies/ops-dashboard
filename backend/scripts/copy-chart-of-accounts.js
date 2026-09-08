require('./destructive/_destructive-guard')({ scriptName: __filename })
/**
 * copy-chart-of-accounts.js
 *
 * Copies all ChartOfAccount documents from a source tenant to one or more target tenants.
 * Existing accounts in the target are matched by accountCode and upserted (not duplicated).
 *
 * Usage:
 *   node scripts/copy-chart-of-accounts.js
 *   node scripts/copy-chart-of-accounts.js --source mg --targets vb
 *   node scripts/copy-chart-of-accounts.js --source loopc --targets mg,cg,loopc,vb
 *
 * Requires .env MONGO_URI_* for each catalog tenant (via shared/tenant-catalog.json envVar).
 */

require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, getTenantKeys } = require('../config/tenants')

dns.setServers(['8.8.8.8', '1.1.1.1'])

const args = process.argv.slice(2)
function getArg(name, fallback) {
  const idx = args.indexOf('--' + name)
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback
}

const SOURCE_TENANT = getArg('source', 'loopc')
const TARGET_TENANTS = getArg('targets', getTenantKeys().join(','))
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean)

const COLLECTION = 'chartofaccounts'

async function copyChartOfAccounts(sourceConn, targetConn, targetName) {
  const sourceCol = sourceConn.db.collection(COLLECTION)
  const targetCol = targetConn.db.collection(COLLECTION)

  const docs = await sourceCol.find({}).toArray()
  if (docs.length === 0) {
    console.log(`  [${targetName}] Source has 0 chart of accounts — nothing to copy.`)
    return
  }

  let upserted = 0
  let skipped = 0

  for (const doc of docs) {
    const clone = { ...doc }
    delete clone._id
    delete clone.__v

    const result = await targetCol.updateOne(
      { accountCode: doc.accountCode },
      { $set: clone },
      { upsert: true },
    )

    if (result.upsertedCount > 0) {
      upserted++
    } else {
      skipped++
    }
  }

  console.log(`  [${targetName}] Done — ${upserted} inserted new, ${skipped} updated/overwritten.`)
}

async function main() {
  const sourceUri = getTenantUri(SOURCE_TENANT)
  if (!sourceUri) {
    console.error(`ERROR: No MONGO_URI for source tenant "${SOURCE_TENANT}". Check your .env / catalog envVar.`)
    process.exit(1)
  }

  console.log(`\nSource tenant : ${SOURCE_TENANT}`)
  console.log(`Target tenants: ${TARGET_TENANTS.join(', ')}\n`)

  console.log('Connecting to source...')
  const sourceConn = await mongoose.createConnection(sourceUri, { autoIndex: false }).asPromise()
  console.log('  Source connected.\n')

  for (const target of TARGET_TENANTS) {
    if (target === SOURCE_TENANT) {
      console.log(`  [${target}] SKIPPED — same as source`)
      continue
    }
    const targetUri = getTenantUri(target)
    if (!targetUri) {
      console.warn(`  [${target}] SKIPPED — missing tenant URI in env`)
      continue
    }

    console.log(`Copying to ${target}...`)
    const targetConn = await mongoose.createConnection(targetUri, { autoIndex: false }).asPromise()
    try {
      await copyChartOfAccounts(sourceConn, targetConn, target)
    } finally {
      await targetConn.close()
    }
  }

  await sourceConn.close()
  console.log('\nAll done.')
}

main().catch((err) => {
  console.error('Fatal error:', err.message)
  process.exit(1)
})
