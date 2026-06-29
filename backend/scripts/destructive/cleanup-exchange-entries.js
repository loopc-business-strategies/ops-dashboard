#!/usr/bin/env node
require('./_destructive-guard')({
  scriptName: __filename,
  allowDryRunNoApply: !process.argv.includes('--apply'),
})
/**
 * Parameterized soft-delete for mis-posted exchange journal entries on a cash account.
 * Default: dry-run. Pass --apply with destructive guard token to write.
 *
 * Usage:
 *   node scripts/destructive/cleanup-exchange-entries.js --tenant=mg --dry-run
 *   node scripts/destructive/cleanup-exchange-entries.js --tenant=mg --apply --confirm=$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN
 */
const args = process.argv.slice(2)
const isDryRun = args.includes('--dry-run') || !args.includes('--apply')

require('dotenv').config()
const mongoose = require('mongoose')
const { connectTenant } = require('../../db/tenantConnections')

function readArg(name) {
  const inline = args.find((a) => a.startsWith(`${name}=`))
  if (inline) return inline.slice(name.length + 1)
  const idx = args.indexOf(name)
  if (idx >= 0) return args[idx + 1] || ''
  return ''
}

const tenant = readArg('--tenant') || readArg('-t')
const accountCode = readArg('--account') || '1000'
const fromDate = readArg('--from') || '2026-05-05'
const toDate = readArg('--to') || '2026-05-10'
const amounts = (readArg('--amounts') || '5954.65,85.95,8.26')
  .split(',')
  .map((v) => Number(v.trim()))
  .filter((n) => Number.isFinite(n))

async function main() {
  if (!tenant) throw new Error('--tenant=mg|cg|loopc is required')

  const conn = await connectTenant(tenant)
  const db = conn.db
  const accountCollection = db.collection('chartofaccounts')
  const ledgerCollection = db.collection('ledgers')

  const cash = await accountCollection.findOne({ accountCode })
  if (!cash) throw new Error(`Cash account ${accountCode} not found`)

  const amountOr = [{ amount: { $in: amounts } }, { description: /Exchange/i }]
  let badEntries = await ledgerCollection.find({
    referenceType: 'journal',
    isDeleted: { $ne: true },
    date: { $gte: new Date(fromDate), $lte: new Date(`${toDate}T23:59:59.999Z`) },
    $and: [
      { $or: [{ debitAccountId: cash._id }, { creditAccountId: cash._id }] },
      { $or: amountOr },
    ],
  }).toArray()

  if (!badEntries.length) {
    badEntries = await ledgerCollection.find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: /Exchange/i,
      $or: [{ debitAccountId: cash._id }, { creditAccountId: cash._id }],
    }).toArray()
  }

  const preview = badEntries.map((e) => ({
    id: String(e._id),
    description: e.description,
    amount: e.amount,
    date: e.date ? e.date.toISOString().split('T')[0] : 'unknown',
  }))

  console.log(`[${tenant}] exchange cleanup — mode: ${isDryRun ? 'dry-run' : 'apply'}`)
  console.log(`Matches: ${preview.length}`)
  preview.forEach((row) => console.log(`  • ${row.date} ${row.amount} ${row.description}`))

  if (!preview.length) {
    console.log('Nothing to delete.')
    return
  }

  if (isDryRun) {
    console.log('Dry-run only — pass --apply to soft-delete.')
    return
  }

  const result = await ledgerCollection.updateMany(
    { _id: { $in: badEntries.map((e) => e._id) } },
    {
      $set: {
        isDeleted: true,
        deletedAt: new Date(),
        notes: 'Cleaned up by cleanup-exchange-entries script',
        updatedAt: new Date(),
      },
    },
  )
  console.log(`Soft-deleted: ${result.modifiedCount}`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err.message || err)
    process.exit(1)
  })
