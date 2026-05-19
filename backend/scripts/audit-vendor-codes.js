/**
 * Read-only audit: list active and soft-deleted vendors with VEN codes.
 * Usage (from backend/): node scripts/audit-vendor-codes.js
 * Requires MONGO_URI_MG (or set TENANT=mg|cg|loopc and matching MONGO_URI_* in .env)
 */
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.DNS_SERVERS || '8.8.8.8,8.8.4.4').split(',').map((s) => s.trim()).filter(Boolean))

const tenant = String(process.env.TENANT || 'mg').toLowerCase()
const uriKey = `MONGO_URI_${tenant.toUpperCase()}`
const uri = process.env[uriKey] || process.env.MONGO_URI_MG

async function main() {
  if (!uri) throw new Error(`Missing ${uriKey} in .env`)

  await mongoose.connect(uri)
  const vendors = await mongoose.connection.db.collection('vendors')
    .find({})
    .project({ name: 1, vendorCode: 1, isActive: 1, deletedAt: 1, createdAt: 1, ledgerAccountId: 1 })
    .sort({ vendorCode: 1 })
    .toArray()

  const active = vendors.filter((v) => !v.deletedAt)
  const deleted = vendors.filter((v) => v.deletedAt)

  console.log(`\n=== Vendors (${tenant.toUpperCase()}) ===`)
  console.log(`Active: ${active.length} | Soft-deleted: ${deleted.length}\n`)

  console.log('Active vendors:')
  active.forEach((v) => {
    console.log(`  ${v.vendorCode || '(no code)'} | ${v.name} | active=${v.isActive !== false}`)
  })

  if (deleted.length) {
    console.log('\nSoft-deleted (hidden from list; codes stay reserved):')
    deleted.forEach((v) => {
      console.log(`  ${v.vendorCode || '(no code)'} | ${v.name} | deletedAt=${v.deletedAt}`)
    })
  }

  const venNums = vendors
    .map((v) => String(v.vendorCode || '').match(/^VEN-(\d+)$/i)?.[1])
    .filter(Boolean)
    .map(Number)
  if (venNums.length) {
    const max = Math.max(...venNums)
    const missing = []
    for (let i = 1; i <= max; i += 1) {
      if (!venNums.includes(i)) missing.push(`VEN-${String(i).padStart(4, '0')}`)
    }
    if (missing.length) {
      console.log(`\nMissing sequence slots (1..${max}, likely deleted vendors): ${missing.join(', ')}`)
    }
    console.log(`\nNext auto code after deploy fix: VEN-${String(max + 1).padStart(4, '0')}`)
  }

  const testLike = active.filter((v) => /^(xx|test|smoke)/i.test(String(v.name || '').trim()))
  if (testLike.length) {
    console.log('\nPossible test/placeholder vendors (review before delete):')
    for (const v of testLike) {
      const txCount = await mongoose.connection.db.collection('transactions').countDocuments({
        vendorId: v._id,
        isDeleted: { $ne: true },
      })
      const ledgerCount = v.ledgerAccountId
        ? await mongoose.connection.db.collection('ledgers').countDocuments({
            isDeleted: { $ne: true },
            $or: [{ debitAccountId: v.ledgerAccountId }, { creditAccountId: v.ledgerAccountId }],
          })
        : 0
      console.log(`  ${v.vendorCode} | ${v.name} | tx=${txCount} ledger=${ledgerCount} | safeToRemove=${txCount === 0 && ledgerCount === 0}`)
    }
  }
}

main()
  .catch((err) => {
    console.error(err.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect()
  })
