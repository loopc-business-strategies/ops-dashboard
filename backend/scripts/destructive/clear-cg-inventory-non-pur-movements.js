/**
 * CG-only: soft-delete StockMovements that are NOT tied to Pur/2026/0001,
 * then reconcile InventoryItem.quantity to the sum of remaining active movements.
 *
 * Keeps the posted purchase voucher itself. Soft-delete only (no hard deletes).
 *
 * Dry-run:
 *   node scripts/destructive/clear-cg-inventory-non-pur-movements.js --tenant=cg
 *
 * Apply:
 *   CLEANUP_CONFIRM_TOKEN=... node scripts/destructive/clear-cg-inventory-non-pur-movements.js --tenant=cg --apply --reason="CG inventory keep only Pur/2026/0001" --confirm=...
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const KEEP_VOC_NO = 'Pur/2026/0001'
const KEEP_REASON_RE = /Pur\/2026\/0001/i

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

function isKeepMovement(reason) {
  return KEEP_REASON_RE.test(String(reason || ''))
}

async function main() {
  const tenant = String(readArgValue('--tenant') || readArgValue('-t') || 'cg').trim().toLowerCase()
  if (tenant !== 'cg') {
    throw new Error(`Refusing tenant "${tenant}". This script is CG-only.`)
  }

  const apply = hasFlag('--apply')
  const reason = String(readArgValue('--reason') || 'CG inventory keep only Pur/2026/0001').trim()

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

  const uri = resolveUri()
  if (!uri) throw new Error('Missing MONGO_URI_CG (or getTenantUri(cg)).')

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 20000,
    connectTimeoutMS: 20000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const itemsCol = db.collection('inventoryitems')
    const movesCol = db.collection('stockmovements')
    const txCol = db.collection('transactions')
    const now = new Date()

    const postedMetal = await txCol
      .find({
        isDeleted: { $ne: true },
        status: 'posted',
        type: { $in: ['purchase', 'sale', 'metal_receipt', 'metal_payment'] },
      })
      .project({ type: 1, status: 1, 'voucherMeta.vocNo': 1, amount: 1 })
      .toArray()

    const items = await itemsCol
      .find({ isDeleted: { $ne: true } })
      .project({ name: 1, sku: 1, category: 1, quantity: 1, unitCost: 1 })
      .sort({ name: 1 })
      .toArray()

    const perItem = []
    let totalSoftDelete = 0
    let totalKeep = 0

    for (const item of items) {
      const moves = await movesCol
        .find({ itemId: item._id, isDeleted: { $ne: true } })
        .project({
          change: 1,
          reason: 1,
          quantityBefore: 1,
          quantityAfter: 1,
          createdAt: 1,
          itemName: 1,
        })
        .sort({ createdAt: 1 })
        .toArray()

      const keep = moves.filter((m) => isKeepMovement(m.reason))
      const drop = moves.filter((m) => !isKeepMovement(m.reason))
      const targetQty = keep.reduce((s, m) => s + Number(m.change || 0), 0)
      const currentSum = moves.reduce((s, m) => s + Number(m.change || 0), 0)

      totalKeep += keep.length
      totalSoftDelete += drop.length

      perItem.push({
        itemId: String(item._id),
        name: item.name,
        category: item.category || '',
        storedQty: Number(item.quantity || 0),
        sumActiveMovements: currentSum,
        targetQty,
        keepMovements: keep.map((m) => ({
          _id: String(m._id),
          change: m.change,
          reason: m.reason,
          createdAt: m.createdAt,
        })),
        dropMovements: drop.map((m) => ({
          _id: String(m._id),
          change: m.change,
          reason: m.reason,
          createdAt: m.createdAt,
        })),
      })
    }

    const preview = {
      generatedAt: now.toISOString(),
      tenant: 'cg',
      dryRun: !apply,
      keepVocNo: KEEP_VOC_NO,
      postedMetalVouchers: postedMetal.map((t) => ({
        type: t.type,
        vocNo: t?.voucherMeta?.vocNo || '',
        amount: t.amount,
      })),
      totals: {
        items: items.length,
        keepMovements: totalKeep,
        dropMovements: totalSoftDelete,
      },
      perItem,
    }

    if (!apply) {
      console.log(JSON.stringify({
        ...preview,
        message: 'Dry run complete. Re-run with --apply --reason=... --confirm=... to soft-delete non-Pur movements and reconcile qty.',
      }, null, 2))
      return
    }

    let movementsSoftDeleted = 0
    let itemsReconciled = 0

    for (const row of perItem) {
      const itemOid = new mongoose.Types.ObjectId(row.itemId)

      for (const mov of row.dropMovements) {
        const res = await movesCol.updateOne(
          { _id: new mongoose.Types.ObjectId(mov._id), isDeleted: { $ne: true } },
          {
            $set: {
              isDeleted: true,
              deletedAt: now,
              deleteReason: reason.slice(0, 200),
              updatedAt: now,
            },
          },
        )
        if (res.modifiedCount) movementsSoftDeleted += 1
      }

      const finalQty = Math.max(0, Number(row.targetQty) || 0)
      const qtyRes = await itemsCol.updateOne(
        { _id: itemOid },
        {
          $set: {
            quantity: finalQty,
            updatedAt: now,
          },
        },
      )
      if (qtyRes.modifiedCount || qtyRes.matchedCount) itemsReconciled += 1
    }

    // Post-apply verification snapshot
    const verify = []
    for (const item of items) {
      const active = await movesCol
        .find({ itemId: item._id, isDeleted: { $ne: true } })
        .project({ change: 1, reason: 1 })
        .toArray()
      const sum = active.reduce((s, m) => s + Number(m.change || 0), 0)
      const fresh = await itemsCol.findOne({ _id: item._id }, { projection: { name: 1, quantity: 1 } })
      verify.push({
        name: fresh?.name || item.name,
        quantity: Number(fresh?.quantity || 0),
        sumActiveMovements: sum,
        activeReasons: active.map((m) => m.reason),
        matched: Number(fresh?.quantity || 0) === sum,
      })
    }

    console.log(JSON.stringify({
      ...preview,
      dryRun: false,
      executed: {
        movementsSoftDeleted,
        itemsReconciled,
        verify,
      },
      message: 'Apply complete. Non-Pur StockMovements soft-deleted; InventoryItem quantities reconciled to Pur/2026/0001 only.',
    }, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
