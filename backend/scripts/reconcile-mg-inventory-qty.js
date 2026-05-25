#!/usr/bin/env node
/**
 * Reconcile InventoryItem.quantity from sum of active StockMovement.change per item.
 * Usage: node scripts/reconcile-mg-inventory-qty.js mg [--apply]
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant } = require('../config/tenants')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const APPLY = process.argv.includes('--apply')

async function main() {
  const tenant = normalizeTenant(process.argv.find((a) => !a.startsWith('-') && a !== process.argv[0] && a !== process.argv[1]) || 'mg')
  await mongoose.connect(getTenantUri(tenant), { serverSelectionTimeoutMS: 20000 })

  const InventoryItem = require('../models/InventoryItem')
  const StockMovement = require('../models/StockMovement')
  const User = require('../models/User')
  const actor = await User.findOne({ isActive: true }).select('_id').lean()

  const items = await InventoryItem.find({ isDeleted: { $ne: true } })
  const fixes = []

  for (const item of items) {
    const moves = await StockMovement.find({ itemId: item._id, isDeleted: { $ne: true } })
      .select('change')
      .lean()
    const computed = moves.reduce((sum, m) => sum + Number(m.change || 0), 0)
    const stored = Number(item.quantity || 0)
    const nextQty = Math.max(0, Number(computed.toFixed(4)))
    if (Math.abs(stored - nextQty) > 0.001) {
      fixes.push({
        id: String(item._id),
        name: item.name,
        stored,
        nextQty,
        activeMoves: moves.length,
      })
    }
  }

  console.log(JSON.stringify({ tenant, apply: APPLY, fixes }, null, 2))

  if (!APPLY || !fixes.length) {
    await mongoose.disconnect()
    return
  }

  for (const fix of fixes) {
    await InventoryItem.updateOne(
      { _id: fix.id },
      { $set: { quantity: fix.nextQty, updatedBy: actor?._id || null } },
    )
  }

  console.log(`\nUpdated ${fixes.length} inventory item(s).`)
  await mongoose.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
