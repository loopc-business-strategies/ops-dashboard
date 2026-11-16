#!/usr/bin/env node
/**
 * MG staging: clear Alloy Mix Jobs + linked vault lots + gold_alloy Ops workbook rows
 * so you can demo Post → Floor Allocate → Vault → Update cleanly.
 * Does NOT zero catalog inventory or wipe vouchers.
 *
 * Preview:
 *   node scripts/destructive/clear-mg-alloy-mix-jobs.js --tenant=mg
 *
 * Apply:
 *   node scripts/destructive/clear-mg-alloy-mix-jobs.js --tenant=mg --apply \
 *     --reason="MG alloy mix demo clear for floor walkthrough" \
 *     --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
 */
require('dotenv').config()
if (!process.env.APP_ENV) process.env.APP_ENV = 'staging'
require('./_destructive-guard')({
  scriptName: __filename,
  defaultTenant: 'mg',
  allowDryRunNoApply: true,
})

const dns = require('dns')
dns.setServers(
  (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
)

const mongoose = require('mongoose')
const { looksLikeNonProductionUri, redactMongoUri } = require('../../utils/migrationSafety')

function hasFlag(name) {
  return process.argv.includes(name)
}

async function main() {
  const apply = hasFlag('--apply')
  const uri = String(process.env.MONGO_URI_MG || '').trim()
  if (!uri) throw new Error('Missing MONGO_URI_MG')
  if (!looksLikeNonProductionUri(uri)) {
    throw new Error(`Refusing non-staging URI ${redactMongoUri(uri)}`)
  }

  console.log(`Target: ${redactMongoUri(uri)}`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 })
  const db = mongoose.connection.db
  const now = new Date()
  const reason = 'MG demo clear: alloy mix jobs'

  const alloymixjobs = db.collection('alloymixjobs')
  const productionstocklots = db.collection('productionstocklots')
  const productionstockstatusevents = db.collection('productionstockstatusevents')
  const operationsproductionentries = db.collection('operationsproductionentries')

  const openJobs = await alloymixjobs.find({
    isDeleted: { $ne: true },
    status: { $ne: 'closed' },
  }).project({ mixCode: 1, stockLotId: 1, stockCode: 1, status: 1, currentDepartment: 1 }).toArray()

  const lotIds = openJobs.map((j) => j.stockLotId).filter(Boolean)
  const mixCodes = openJobs.map((j) => String(j.mixCode || '').toUpperCase()).filter(Boolean)

  const alloyLots = await productionstocklots.find({
    $or: [
      ...(lotIds.length ? [{ _id: { $in: lotIds } }] : []),
      { stockCode: { $regex: /^AMX-/i } },
      { purchaseRef: { $regex: /^AMX-/i } },
      { idempotencyKey: { $regex: /^alloy-mix:|^alloy-split:/i } },
    ],
    status: { $ne: 'CANCELLED' },
  }).project({ stockCode: 1, status: 1, grossWeight: 1 }).toArray()

  const opsRows = await operationsproductionentries.find({
    $or: [
      { source: 'gold_alloy' },
      ...(mixCodes.length ? [{ alloyMixCode: { $in: mixCodes } }] : []),
      { floorBatchKey: { $regex: /^alloy:/i } },
    ],
  }).project({ departmentKey: 1, batchNumber: 1, alloyMixCode: 1, metalIn: 1, metalOut: 1 }).toArray()

  console.log({
    openMixJobs: openJobs.length,
    sampleJobs: openJobs.slice(0, 8).map((j) => ({
      mixCode: j.mixCode,
      status: j.status,
      dept: j.currentDepartment,
    })),
    alloyLots: alloyLots.length,
    opsGoldAlloyRows: opsRows.length,
  })

  if (!apply) {
    console.log('Dry-run only. Re-run with --tenant=mg --apply --reason="..." --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN".')
    await mongoose.disconnect()
    return
  }

  if (openJobs.length) {
    await alloymixjobs.updateMany(
      { _id: { $in: openJobs.map((j) => j._id) } },
      {
        $set: {
          status: 'closed',
          isDeleted: true,
          deletedAt: now,
          deleteReason: reason,
          closedAt: now,
        },
      },
    )
  }

  if (alloyLots.length) {
    const codes = alloyLots.map((l) => l.stockCode).filter(Boolean)
    await productionstocklots.updateMany(
      { _id: { $in: alloyLots.map((l) => l._id) } },
      { $set: { status: 'CANCELLED', remarks: reason } },
    )
    if (codes.length) {
      await productionstockstatusevents.insertMany(
        alloyLots.map((lot) => ({
          stockLotId: lot._id,
          stockCode: lot.stockCode,
          fromStatus: lot.status || '',
          toStatus: 'CANCELLED',
          reason,
          actorId: null,
          actorName: 'clear-mg-alloy-mix-jobs',
          createdAt: now,
          updatedAt: now,
        })),
        { ordered: false },
      ).catch(() => {})
    }
  }

  if (opsRows.length) {
    await operationsproductionentries.deleteMany({
      _id: { $in: opsRows.map((r) => r._id) },
    })
  }

  console.log({
    closedJobs: openJobs.length,
    cancelledLots: alloyLots.length,
    deletedOpsRows: opsRows.length,
  })
  console.log('Done. Ready for Post Mix → Allocate → Update demo.')
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
