#!/usr/bin/env node
require('./destructive/_destructive-guard')({ scriptName: __filename })
/**
 * Relabel Gold Alloy Ops rows for split child mixes so batchNumber shows the root parent code.
 *
 * Example: child mix BMG-0003 (parent BMG-0002) → Ops rows with alloyMixCode BMG-0003 and
 * batchNumber BMG-0003 get batchNumber BMG-0002. Only rows whose batchNumber still equals the
 * child code are touched; alloyMixCode (used for grouping and totals) is never changed.
 *
 *   node scripts/repair-alloy-batch-labels.js mg --dry-run
 *   node scripts/repair-alloy-batch-labels.js mg --apply
 */
require('dotenv').config()
const mongoose = require('mongoose')
const AlloyMixJob = require('../models/AlloyMixJob')
const OperationsProductionEntry = require('../models/OperationsProductionEntry')

const MAX_DEPTH = 20

async function rootMixCodeFor(job, byId) {
  let current = job
  for (let i = 0; i < MAX_DEPTH && current?.parentJobId; i += 1) {
    const parent = byId.get(String(current.parentJobId))
    if (!parent) break
    current = parent
  }
  return String(current?.mixCode || job?.mixCode || '').trim()
}

async function main() {
  const tenant = String(process.argv[2] || '').trim().toLowerCase()
  const apply = process.argv.includes('--apply')
  if (!tenant) {
    console.error('Usage: node scripts/repair-alloy-batch-labels.js <tenant> [--dry-run|--apply]')
    process.exit(1)
  }
  const uriKey = `MONGO_URI_${tenant.toUpperCase()}`
  const uri = String(process.env[uriKey] || '').trim()
  if (!uri) {
    console.error(`Missing ${uriKey}`)
    process.exit(1)
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 20000 })

  const allJobs = await AlloyMixJob.find({})
    .select('mixCode parentJobId')
    .lean()
  const byId = new Map(allJobs.map((j) => [String(j._id), j]))
  const children = allJobs.filter((j) => j.parentJobId)

  let totalRows = 0
  for (const child of children) {
    const childCode = String(child.mixCode || '').trim()
    if (!childCode) continue
    const rootCode = await rootMixCodeFor(child, byId)
    if (!rootCode || rootCode === childCode) continue

    const filter = {
      source: 'gold_alloy',
      alloyMixCode: childCode,
      batchNumber: childCode,
    }
    const count = await OperationsProductionEntry.countDocuments(filter)
    if (!count) continue
    totalRows += count
    console.log(`${childCode} → batch ${rootCode}: ${count} row(s)${apply ? '' : ' (dry-run)'}`)
    if (apply) {
      const res = await OperationsProductionEntry.updateMany(filter, { $set: { batchNumber: rootCode } })
      console.log(`  updated ${res.modifiedCount ?? res.nModified ?? 0}`)
    }
  }

  console.log(totalRows
    ? `${apply ? 'Updated' : 'Would update'} ${totalRows} row(s).`
    : 'No child rows needed relabeling.')
  await mongoose.disconnect()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
