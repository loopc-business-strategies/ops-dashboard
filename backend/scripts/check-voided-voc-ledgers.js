#!/usr/bin/env node
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')
const { getTenantUri } = require('../config/tenants')
dns.setServers(['8.8.8.8', '1.1.1.1'])

async function main() {
  await mongoose.connect(getTenantUri('mg'))
  const Ledger = require('../models/Ledger')
  const rows = await Ledger.find({
    isDeleted: { $ne: true },
    $or: [
      { description: /Pur\/2026\/0001|Sal\/2026\/0001/i },
      { description: /COGS.*Sal\/2026\/0001/i },
    ],
  }).select('description referenceType amount').lean()
  console.log('Active ledger rows mentioning voided vocs:', rows.length)
  rows.forEach((r) => console.log(`  ${r.referenceType} ${r.amount} ${String(r.description).slice(0, 70)}`))
  await mongoose.disconnect()
}
main().catch((e) => { console.error(e); process.exit(1) })
