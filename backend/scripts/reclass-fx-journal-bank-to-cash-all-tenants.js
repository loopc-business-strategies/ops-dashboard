require('./destructive/_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const APPLY = process.argv.includes('--apply')

const tenants = [
  { name: 'MG', uri: process.env.MONGO_URI_MG },
  { name: 'CG', uri: process.env.MONGO_URI_CG },
  { name: 'LoopC', uri: process.env.MONGO_URI_LOOPC },
].filter((t) => !!t.uri)

async function getAccountByCode(db, code) {
  return db.collection('chartofaccounts').findOne({
    accountCode: String(code),
    isDeleted: { $ne: true },
    isActive: { $ne: false },
  })
}

async function processTenant(tenant) {
  const conn = await mongoose.createConnection(tenant.uri, { serverSelectionTimeoutMS: 12000 }).asPromise()
  const db = conn.getClient().db()

  try {
    const cash = await getAccountByCode(db, '1000')
    const bank = await getAccountByCode(db, '1010')
    const gain = await getAccountByCode(db, '4190')
    const loss = await getAccountByCode(db, '5190')

    if (!cash || !bank || !gain || !loss) {
      const missing = []
      if (!cash) missing.push('1000 Cash on Hand')
      if (!bank) missing.push('1010 Bank')
      if (!gain) missing.push('4190 Exchange Gain')
      if (!loss) missing.push('5190 Exchange Loss')
      throw new Error(`Missing required account(s): ${missing.join(', ')}`)
    }

    const candidates = await db.collection('ledgers').find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: /exchange\s+(gain|loss)/i,
      $and: [
        {
          $or: [
            { debitAccountId: bank._id },
            { creditAccountId: bank._id },
          ],
        },
        {
          $or: [
            { debitAccountId: gain._id },
            { creditAccountId: gain._id },
            { debitAccountId: loss._id },
            { creditAccountId: loss._id },
          ],
        },
      ],
    }).toArray()

    let planned = 0
    let updated = 0

    for (const row of candidates) {
      const nextDebit = String(row.debitAccountId) === String(bank._id) ? cash._id : row.debitAccountId
      const nextCredit = String(row.creditAccountId) === String(bank._id) ? cash._id : row.creditAccountId

      const changed = String(nextDebit) !== String(row.debitAccountId)
        || String(nextCredit) !== String(row.creditAccountId)

      if (!changed) continue
      planned += 1

      if (APPLY) {
        await db.collection('ledgers').updateOne(
          { _id: row._id },
          {
            $set: {
              debitAccountId: nextDebit,
              creditAccountId: nextCredit,
              updatedAt: new Date(),
              notes: `${row.notes ? `${row.notes} | ` : ''}Reclassed bank(1010)->cash(1000)`,
            },
          }
        )
        updated += 1
      }
    }

    return {
      tenant: tenant.name,
      candidates: candidates.length,
      planned,
      updated,
      cashCode: cash.accountCode,
      bankCode: bank.accountCode,
    }
  } finally {
    await conn.close()
  }
}

;(async () => {
  if (!tenants.length) throw new Error('No tenant Mongo URIs found.')

  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY-RUN'}`)

  const totals = { candidates: 0, planned: 0, updated: 0 }

  for (const tenant of tenants) {
    try {
      const res = await processTenant(tenant)
      totals.candidates += res.candidates
      totals.planned += res.planned
      totals.updated += res.updated

      console.log(`\n[${res.tenant}]`)
      console.log(`  candidates found : ${res.candidates}`)
      console.log(`  rows to reclass  : ${res.planned}`)
      console.log(`  rows updated     : ${res.updated}`)
    } catch (err) {
      console.log(`\n[${tenant.name}] ERROR: ${err.message}`)
    }
  }

  console.log('\nSummary:')
  console.log(`  candidates found : ${totals.candidates}`)
  console.log(`  rows to reclass  : ${totals.planned}`)
  console.log(`  rows updated     : ${totals.updated}`)

  if (!APPLY) {
    console.log('\nDry-run only. Re-run with --apply to persist changes.')
  }
})().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
require('./destructive/_destructive-guard')({ scriptName: __filename })
