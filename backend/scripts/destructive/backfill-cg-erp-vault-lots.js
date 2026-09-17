/**
 * CG: backfill AVAILABLE ProductionStockLot rows from ERP InventoryItem qty > 0
 * so Production Dashboard Vault New/Available reflects posted metal purchases.
 *
 * Dry-run:
 *   node scripts/destructive/backfill-cg-erp-vault-lots.js --tenant=cg
 *
 * Apply:
 *   CLEANUP_CONFIRM_TOKEN=... node scripts/destructive/backfill-cg-erp-vault-lots.js --tenant=cg --apply --reason="Backfill CG vault lots from ERP" --confirm=...
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

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
  const fromEnv = String(process.env.MONGO_URI_CG || '').trim()
  if (fromEnv) return fromEnv
  try {
    const { getTenantUri } = require('../../config/tenants')
    return String(getTenantUri('cg') || '').trim()
  } catch {
    return ''
  }
}

function inferMetalType(item) {
  const raw = String(item?.category || item?.name || '').toLowerCase()
  if (raw.includes('silver')) return 'Silver'
  if (raw.includes('platinum')) return 'Platinum'
  return 'Gold'
}

async function nextStockCode(lotsCol) {
  const year = new Date().getFullYear()
  const prefix = `STK-${year}-`
  const last = await lotsCol
    .find({ stockCode: { $regex: `^${prefix}` } })
    .project({ stockCode: 1 })
    .sort({ stockCode: -1 })
    .limit(1)
    .toArray()
  const lastNum = last[0]?.stockCode ? Number(String(last[0].stockCode).slice(prefix.length)) : 0
  const next = (Number.isFinite(lastNum) ? lastNum : 0) + 1
  return `${prefix}${String(next).padStart(5, '0')}`
}

async function main() {
  const tenant = String(readArgValue('--tenant') || 'cg').trim().toLowerCase()
  if (tenant !== 'cg') throw new Error('This script is CG-only (--tenant=cg).')

  const apply = hasFlag('--apply')
  const reason = String(readArgValue('--reason') || 'Backfill CG vault lots from ERP').trim()

  if (apply) {
    if (reason.length < 10) throw new Error('Apply requires --reason (≥10 chars).')
    const expectedToken = String(
      process.env.CLEANUP_CONFIRM_TOKEN || process.env.DESTRUCTIVE_ADMIN_CONFIRM_TOKEN || '',
    ).trim()
    if (!expectedToken) throw new Error('Apply requires CLEANUP_CONFIRM_TOKEN.')
    const confirm = String(readArgValue('--confirm') || '').trim()
    if (confirm !== expectedToken) throw new Error('Apply requires matching --confirm.')
  }

  const uri = resolveUri()
  if (!uri) throw new Error('Missing MONGO_URI_CG')

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const itemsCol = db.collection('inventoryitems')
    const lotsCol = db.collection('productionstocklots')
    const eventsCol = db.collection('productionstockstatusevents')
    const now = new Date()

    const items = await itemsCol
      .find({ isDeleted: { $ne: true }, quantity: { $gt: 0 } })
      .project({ name: 1, sku: 1, category: 1, quantity: 1 })
      .toArray()

    const plans = []
    for (const item of items) {
      const weight = Number(item.quantity) || 0
      if (weight <= 0) continue
      const idempotencyKey = `erp-backfill:${String(item._id)}`
      const existing = await lotsCol.findOne({
        $or: [
          { idempotencyKey },
          {
            inventoryItemId: item._id,
            status: { $in: ['NEW_STOCK', 'AVAILABLE'] },
            netWeight: weight,
          },
        ],
      })
      plans.push({
        itemId: String(item._id),
        name: item.name,
        weight,
        idempotencyKey,
        existingLot: existing
          ? { stockCode: existing.stockCode, status: existing.status, netWeight: existing.netWeight }
          : null,
        willCreate: !existing,
      })
    }

    const preview = {
      generatedAt: now.toISOString(),
      tenant: 'cg',
      dryRun: !apply,
      plans,
      totals: {
        itemsWithQty: items.length,
        toCreate: plans.filter((p) => p.willCreate).length,
        alreadyPresent: plans.filter((p) => !p.willCreate).length,
      },
    }

    if (!apply) {
      console.log(JSON.stringify({
        ...preview,
        message: 'Dry run. Re-run with --apply --reason=... --confirm=... to create AVAILABLE lots.',
      }, null, 2))
      return
    }

    let created = 0
    for (const plan of plans) {
      if (!plan.willCreate) continue
      const stockCode = await nextStockCode(lotsCol)
      const doc = {
        stockCode,
        purchaseRef: 'ERP-BACKFILL',
        product: plan.name,
        productCode: '',
        category: '',
        quantity: 1,
        grossWeight: plan.weight,
        netWeight: plan.weight,
        metalType: inferMetalType({ name: plan.name }),
        status: 'AVAILABLE',
        inventoryItemId: new mongoose.Types.ObjectId(plan.itemId),
        idempotencyKey: plan.idempotencyKey,
        remarks: reason.slice(0, 200),
        receivedByName: 'system',
        createdByName: 'system',
        version: 0,
        createdAt: now,
        updatedAt: now,
      }
      const insert = await lotsCol.insertOne(doc)
      await eventsCol.insertOne({
        stockLotId: insert.insertedId,
        stockCode,
        fromStatus: '',
        toStatus: 'AVAILABLE',
        reason: reason.slice(0, 200),
        actorName: 'system',
        createdAt: now,
      })
      created += 1
    }

    const vaultAgg = await lotsCol.aggregate([
      { $match: { status: { $in: ['NEW_STOCK', 'AVAILABLE'] } } },
      { $group: { _id: null, weight: { $sum: '$netWeight' }, count: { $sum: 1 } } },
    ]).toArray()

    console.log(JSON.stringify({
      ...preview,
      dryRun: false,
      executed: {
        created,
        vaultLotsAfter: {
          count: vaultAgg[0]?.count || 0,
          weight: vaultAgg[0]?.weight || 0,
        },
      },
      message: 'Backfill complete. AVAILABLE lots created from ERP InventoryItem quantities.',
    }, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
