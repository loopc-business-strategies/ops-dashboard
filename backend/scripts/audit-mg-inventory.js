#!/usr/bin/env node
/** Audit MG inventory vs stock movements (especially voided metal vouchers). */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant } = require('../config/tenants')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

async function main() {
  const tenant = normalizeTenant(process.argv[2] || 'mg')
  await mongoose.connect(getTenantUri(tenant), { serverSelectionTimeoutMS: 20000 })

  const InventoryItem = require('../models/InventoryItem')
  const StockMovement = require('../models/StockMovement')
  const Transaction = require('../models/Transaction')

  const items = await InventoryItem.find({ isDeleted: { $ne: true } })
    .select('name sku category quantity unitCost sellingPrice')
    .sort({ name: 1 })
    .lean()

  console.log('\n=== Inventory items (on hand) ===')
  for (const item of items) {
    const activeMoves = await StockMovement.find({ itemId: item._id, isDeleted: { $ne: true } })
      .select('change reason createdAt')
      .sort({ createdAt: 1 })
      .lean()
    const sumActive = activeMoves.reduce((s, m) => s + Number(m.change || 0), 0)
    const allMoves = await StockMovement.find({ itemId: item._id })
      .select('change reason isDeleted createdAt')
      .sort({ createdAt: 1 })
      .lean()

    console.log(`\n${item.name} (${item.category || '—'})`)
    console.log(`  Stored qty: ${item.quantity} | Sum active movements: ${sumActive}`)
    console.log(`  Unit cost: ${item.unitCost} | Value: ${Number(item.quantity || 0) * Number(item.unitCost || 0)}`)

    for (const m of allMoves) {
      console.log(`  [${m.isDeleted ? 'DEL' : 'OK '}] ${new Date(m.createdAt).toISOString().slice(0, 10)} change=${m.change} | ${String(m.reason || '').slice(0, 80)}`)
    }
  }

  const voidedVocs = ['Pur/2026/0001', 'Sal/2026/0001']
  console.log('\n=== Voided metal voucher movements ===')
  for (const voc of voidedVocs) {
    const moves = await StockMovement.find({ reason: new RegExp(voc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') })
      .select('change reason isDeleted itemId deleteReason')
      .lean()
    console.log(`\n${voc}: ${moves.length} movement(s)`)
    moves.forEach((m) => console.log(`  deleted=${m.isDeleted} change=${m.change} item=${m.itemId}`))
  }

  const activeMetal = await Transaction.find({
    isDeleted: { $ne: true },
    type: { $in: ['purchase', 'sale'] },
    status: 'posted',
  }).select('type amount voucherMeta.vocNo voucherMeta.lines').lean()
  console.log(`\n=== Active posted metal purchase/sale: ${activeMetal.length} ===`)
  activeMetal.forEach((t) => console.log(`  ${t.voucherMeta?.vocNo} ${t.type} ${t.amount}`))

  await mongoose.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
