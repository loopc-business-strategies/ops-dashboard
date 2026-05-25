#!/usr/bin/env node
/** Quick verify metal purchase/sale voc nos are voided and ledgers inactive. */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri, normalizeTenant } = require('../config/tenants')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const tenant = normalizeTenant(process.argv[2] || 'mg')
const vocNos = process.argv.slice(3).length ? process.argv.slice(3) : ['Pur/2026/0001', 'Sal/2026/0001']

async function main() {
  await mongoose.connect(getTenantUri(tenant), { serverSelectionTimeoutMS: 20000 })
  const Transaction = require('../models/Transaction')
  const Ledger = require('../models/Ledger')
  const StockMovement = require('../models/StockMovement')
  const InventoryItem = require('../models/InventoryItem')

  for (const vocNo of vocNos) {
    const tx = await Transaction.findOne({ 'voucherMeta.vocNo': new RegExp(`^${vocNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })
      .select('_id type status isDeleted deletedAt amount voucherMeta journalEntryId')
      .lean()
    const activeLedgers = tx
      ? await Ledger.countDocuments({
        $or: [{ referenceId: tx._id }, ...(tx.journalEntryId ? [{ _id: tx.journalEntryId }] : [])],
        isDeleted: { $ne: true },
      })
      : 0
    const gold = await InventoryItem.findOne({ sku: /gold/i, isDeleted: { $ne: true } }).select('sku quantity').lean()
    console.log(JSON.stringify({ vocNo, tx: tx ? { id: String(tx._id), type: tx.type, isDeleted: tx.isDeleted, deletedAt: tx.deletedAt, status: tx.status } : null, activeLedgers, goldQty: gold?.quantity }, null, 2))
  }

  const activeMetal = await Transaction.countDocuments({
    isDeleted: { $ne: true },
    type: { $in: ['purchase', 'sale'] },
    'voucherMeta.vocNo': { $in: vocNos },
  })
  console.log(`\nActive metal txs matching list: ${activeMetal}`)
  await mongoose.disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
