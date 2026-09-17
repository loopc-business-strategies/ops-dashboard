/**
 * MG-only: soft-cancel leftover open ProductionBatch rows and Under-Processing
 * ProductionStockLot rows that inflate Production Dashboard WIP KPIs.
 *
 * Dry-run by default. Apply:
 *   node scripts/destructive/clear-mg-pd-wip-leftovers.js --tenant=mg --apply --reason="Clear leftover PD WIP" --confirm=<CLEANUP_CONFIRM_TOKEN>
 *
 * Does not touch AVAILABLE / NEW_STOCK vault lots. Soft-cancel only (no hard deletes).
 *
 * Note: uses MONGO_URI_MG / getTenantUri('mg'). Staging-only assert is intentionally not used —
 * the approved target is MG leftover WIP the operator asked to clear.
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { ACTIVE_BATCH_STATUSES, BATCH_STATUS_TRANSITIONS } = require('../../services/productionControl/constants')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const WIP_STOCK_STATUSES = [
  'UNDER_PROCESSING',
  'DEPARTMENT_PROCESSING',
  'ALLOCATED',
  'QC_PENDING',
  'PACKAGING',
  'REWORK',
  'HOLD',
  'SELECTED',
]

function hasFlag(name) {
  return process.argv.includes(name)
}

function readArgValue(name) {
  const exactPrefix = `${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(exactPrefix))
  if (inline) return inline.slice(exactPrefix.length)
  const idx = process.argv.indexOf(name)
  if (idx >= 0) return process.argv[idx + 1] || ''
  return ''
}

function resolveUri() {
  const fromEnv = String(process.env.MONGO_URI_MG || '').trim()
  if (fromEnv) return fromEnv
  try {
    const { getTenantUri } = require('../../config/tenants')
    return String(getTenantUri('mg') || '').trim()
  } catch {
    return ''
  }
}

function canCancelBatch(status) {
  const from = String(status || '')
  if (from === 'CANCELLED') return false
  if (['COMPLETED', 'RETURNED_TO_VAULT', 'SPLIT', 'MERGED'].includes(from)) return false
  return Boolean(BATCH_STATUS_TRANSITIONS[from]?.includes('CANCELLED'))
}

async function main() {
  const tenant = String(readArgValue('--tenant') || readArgValue('-t') || 'mg').trim().toLowerCase()
  if (tenant !== 'mg') {
    throw new Error(`Refusing tenant "${tenant}". This script is MG-only.`)
  }

  const apply = hasFlag('--apply')
  if (apply) {
    const reason = String(readArgValue('--reason') || '').trim()
    if (reason.length < 10) {
      throw new Error('Apply requires --reason with at least 10 characters.')
    }
    const expectedToken = String(
      process.env.CLEANUP_CONFIRM_TOKEN || process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN || '',
    ).trim()
    if (!expectedToken) {
      throw new Error('Apply requires CLEANUP_CONFIRM_TOKEN or DESTRUCTIVE_ADMIN_CONFIRM_TOKEN.')
    }
    const confirm = String(readArgValue('--confirm') || '').trim()
    if (confirm !== expectedToken) {
      throw new Error('Apply requires --confirm matching CLEANUP_CONFIRM_TOKEN.')
    }
  }

  const uri = resolveUri()
  if (!uri) throw new Error('Missing MONGO_URI_MG (or getTenantUri(mg)).')

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const batchesCol = db.collection('productionbatches')
    const lotsCol = db.collection('productionstocklots')
    const now = new Date()
    const reason = String(readArgValue('--reason') || 'Clear leftover PD WIP').trim()

    const openBatches = await batchesCol
      .find({ status: { $in: ACTIVE_BATCH_STATUSES } })
      .project({
        batchNumber: 1,
        status: 1,
        currentWeight: 1,
        currentDepartment: 1,
        stockLotId: 1,
        version: 1,
      })
      .sort({ updatedAt: -1 })
      .toArray()

    const wipLots = await lotsCol
      .find({ status: { $in: WIP_STOCK_STATUSES } })
      .project({
        stockCode: 1,
        status: 1,
        netWeight: 1,
        quantity: 1,
        batchNumber: 1,
        version: 1,
      })
      .sort({ updatedAt: -1 })
      .toArray()

    const availableLots = await lotsCol
      .find({ status: { $in: ['AVAILABLE', 'NEW_STOCK'] } })
      .project({ stockCode: 1, status: 1, netWeight: 1 })
      .limit(5)
      .toArray()

    const metalInProduction = openBatches.reduce((sum, b) => sum + (Number(b.currentWeight) || 0), 0)
    const underProcessing = wipLots.reduce((sum, l) => sum + (Number(l.netWeight) || 0), 0)

    const cancellableBatches = openBatches.filter((b) => canCancelBatch(b.status))
    const skippedBatches = openBatches.filter((b) => !canCancelBatch(b.status))

    const preview = {
      generatedAt: now.toISOString(),
      tenant: 'mg',
      dryRun: !apply,
      totals: {
        openBatches: openBatches.length,
        metalInProduction,
        wipLots: wipLots.length,
        underProcessing,
        availableOrNewStockSample: availableLots.length,
      },
      openBatches: openBatches.map((b) => ({
        _id: String(b._id),
        batchNumber: b.batchNumber,
        status: b.status,
        currentWeight: b.currentWeight,
        currentDepartment: b.currentDepartment,
        cancellable: canCancelBatch(b.status),
      })),
      wipLots: wipLots.map((l) => ({
        _id: String(l._id),
        stockCode: l.stockCode,
        status: l.status,
        netWeight: l.netWeight,
        batchNumber: l.batchNumber || '',
      })),
      note: 'AVAILABLE/NEW_STOCK lots are listed only as sample and are never modified.',
      availableOrNewStockSample: availableLots.map((l) => ({
        stockCode: l.stockCode,
        status: l.status,
        netWeight: l.netWeight,
      })),
    }

    if (!apply) {
      console.log(JSON.stringify({
        ...preview,
        message: 'Dry run complete. Re-run with --apply --reason=... --confirm=... to soft-cancel listed open batches and WIP lots.',
      }, null, 2))
      return
    }

    let batchesCancelled = 0
    let lotsCancelled = 0

    for (const batch of cancellableBatches) {
      const res = await batchesCol.updateOne(
        { _id: batch._id, status: batch.status },
        {
          $set: {
            status: 'CANCELLED',
            holdReason: '',
            statusBeforeHold: '',
            completedAt: now,
            updatedAt: now,
            version: (batch.version || 0) + 1,
            cancelReason: reason,
          },
        },
      )
      if (res.modifiedCount) batchesCancelled += 1
    }

    for (const lot of wipLots) {
      const res = await lotsCol.updateOne(
        { _id: lot._id, status: lot.status },
        {
          $set: {
            status: 'CANCELLED',
            updatedAt: now,
            version: (lot.version || 0) + 1,
            cancelReason: reason,
          },
        },
      )
      if (res.modifiedCount) lotsCancelled += 1
    }

    const openAfter = await batchesCol.countDocuments({ status: { $in: ACTIVE_BATCH_STATUSES } })
    const wipAfterAgg = await lotsCol.aggregate([
      { $match: { status: { $in: WIP_STOCK_STATUSES } } },
      { $group: { _id: null, weight: { $sum: '$netWeight' }, count: { $sum: 1 } } },
    ]).toArray()

    console.log(JSON.stringify({
      ...preview,
      dryRun: false,
      executed: {
        batchesCancelled,
        lotsCancelled,
        skippedBatches: skippedBatches.map((b) => ({
          batchNumber: b.batchNumber,
          status: b.status,
        })),
        openBatchesRemaining: openAfter,
        underProcessingRemaining: {
          count: wipAfterAgg[0]?.count || 0,
          weight: wipAfterAgg[0]?.weight || 0,
        },
      },
      message: 'Apply complete. Soft-cancelled open batches and WIP stock lots on MG.',
    }, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
