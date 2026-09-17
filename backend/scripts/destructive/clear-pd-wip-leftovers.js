/**
 * Soft-cancel leftover Production Dashboard WIP across tenants:
 * - open ProductionBatch (ACTIVE_BATCH_STATUSES)
 * - under-processing stock lots
 * - vault NEW_STOCK / AVAILABLE lots
 *
 * Does not touch FINISHED / DISPATCHED. Soft-cancel only (no hard deletes).
 *
 * Dry-run (default):
 *   node scripts/destructive/clear-pd-wip-leftovers.js --tenant=all
 *
 * Apply:
 *   CLEANUP_CONFIRM_TOKEN=... node scripts/destructive/clear-pd-wip-leftovers.js --tenant=all --apply --reason="Clear leftover PD WIP and vault stock" --confirm=...
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { ACTIVE_BATCH_STATUSES, BATCH_STATUS_TRANSITIONS } = require('../../services/productionControl/constants')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const CATALOG_TENANTS = ['mg', 'cg', 'loopc', 'vb']

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

const VAULT_STOCK_STATUSES = ['NEW_STOCK', 'AVAILABLE']
const CANCEL_STOCK_STATUSES = [...WIP_STOCK_STATUSES, ...VAULT_STOCK_STATUSES]

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

function resolveTenantList() {
  const raw = String(readArgValue('--tenant') || readArgValue('-t') || 'all').trim().toLowerCase()
  if (raw === 'all') return [...CATALOG_TENANTS]
  if (!CATALOG_TENANTS.includes(raw)) {
    throw new Error(`Invalid --tenant=${raw}. Use mg|cg|loopc|vb|all.`)
  }
  return [raw]
}

function resolveUri(tenant) {
  const envKey = `MONGO_URI_${String(tenant).toUpperCase()}`
  const fromEnv = String(process.env[envKey] || '').trim()
  if (fromEnv) return fromEnv
  try {
    const { getTenantUri } = require('../../config/tenants')
    return String(getTenantUri(tenant) || '').trim()
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

function weightSum(rows, field = 'netWeight') {
  return rows.reduce((sum, row) => sum + (Number(row[field]) || 0), 0)
}

async function processTenant(tenant, { apply, reason }) {
  const uri = resolveUri(tenant)
  if (!uri) {
    return {
      tenant,
      skipped: true,
      reason: `Missing MONGO_URI_${tenant.toUpperCase()} (or getTenantUri)`,
    }
  }

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const batchesCol = db.collection('productionbatches')
    const lotsCol = db.collection('productionstocklots')
    const now = new Date()

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

    const vaultLots = await lotsCol
      .find({ status: { $in: VAULT_STOCK_STATUSES } })
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

    const cancellableBatches = openBatches.filter((b) => canCancelBatch(b.status))
    const skippedBatches = openBatches.filter((b) => !canCancelBatch(b.status))
    const lotsToCancel = [...wipLots, ...vaultLots]

    const preview = {
      tenant,
      skipped: false,
      dryRun: !apply,
      totals: {
        openBatches: openBatches.length,
        metalInProduction: weightSum(openBatches, 'currentWeight'),
        wipLots: wipLots.length,
        underProcessing: weightSum(wipLots),
        vaultLots: vaultLots.length,
        vaultWeight: weightSum(vaultLots),
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
      vaultLots: vaultLots.map((l) => ({
        _id: String(l._id),
        stockCode: l.stockCode,
        status: l.status,
        netWeight: l.netWeight,
        batchNumber: l.batchNumber || '',
      })),
    }

    if (!apply) return preview

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

    for (const lot of lotsToCancel) {
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
    const vaultAfterAgg = await lotsCol.aggregate([
      { $match: { status: { $in: VAULT_STOCK_STATUSES } } },
      { $group: { _id: null, weight: { $sum: '$netWeight' }, count: { $sum: 1 } } },
    ]).toArray()

    return {
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
        vaultRemaining: {
          count: vaultAfterAgg[0]?.count || 0,
          weight: vaultAfterAgg[0]?.weight || 0,
        },
        cancelStockStatuses: CANCEL_STOCK_STATUSES,
      },
    }
  } finally {
    await conn.close()
  }
}

async function main() {
  const tenants = resolveTenantList()
  const apply = hasFlag('--apply')
  const reason = String(readArgValue('--reason') || 'Clear leftover PD WIP and vault stock').trim()

  if (apply) {
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

  const results = []
  for (const tenant of tenants) {
    // Sequential connections avoid hammering Atlas with parallel tenant pools.
    // eslint-disable-next-line no-await-in-loop
    results.push(await processTenant(tenant, { apply, reason }))
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    dryRun: !apply,
    tenantsRequested: tenants,
    results,
    message: apply
      ? 'Apply complete. Soft-cancelled open batches, WIP lots, and NEW_STOCK/AVAILABLE vault lots where URI was available.'
      : 'Dry run complete. Re-run with --apply --reason=... --confirm=... to soft-cancel listed rows.',
  }

  console.log(JSON.stringify(summary, null, 2))

  const hardFailures = results.filter((r) => r.error)
  if (hardFailures.length) process.exitCode = 1
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
