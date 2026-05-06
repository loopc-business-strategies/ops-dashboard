require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const TARGET_PAYMENT_ID = '69fa2ccb8aca104c2c3abddc'
const TARGET_RECEIPT_ID = '69fa29678aca104c2c3abbbc'

;(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI_CG, { serverSelectionTimeoutMS: 12000 }).asPromise()
  const db = conn.getClient().db()

  try {
    const journal = await db.collection('ledgers').findOne({
      referenceType: 'journal',
      referenceId: new mongoose.Types.ObjectId(TARGET_PAYMENT_ID),
      description: /Exchange .* settlement adjustment pair/i,
      isDeleted: { $ne: true },
    })

    if (!journal) {
      console.log('No settlement FX journal found for target payment reference.')
      return
    }

    const accountIds = [journal.debitAccountId, journal.creditAccountId].filter(Boolean)
    const accounts = await db.collection('chartofaccounts').find(
      { _id: { $in: accountIds } },
      { projection: { _id: 1, accountCode: 1, accountName: 1, accountType: 1 } }
    ).toArray()

    const accountMap = Object.fromEntries(
      accounts.map((a) => [String(a._id), a])
    )

    const debit = accountMap[String(journal.debitAccountId)] || null
    const credit = accountMap[String(journal.creditAccountId)] || null

    console.log('FX Journal Audit Snapshot (CG)')
    console.log(JSON.stringify({
      journalId: String(journal._id),
      createdAt: journal.createdAt,
      referenceType: journal.referenceType,
      referenceId: String(journal.referenceId || ''),
      expectedCounterpartReceiptId: TARGET_RECEIPT_ID,
      amount: journal.amount,
      currency: journal.currency,
      exchangeRate: journal.exchangeRate,
      description: journal.description,
      debit: debit
        ? {
            accountId: String(journal.debitAccountId),
            accountCode: debit.accountCode,
            accountName: debit.accountName,
            accountType: debit.accountType,
          }
        : {
            accountId: String(journal.debitAccountId || ''),
            accountCode: null,
            accountName: null,
            accountType: null,
          },
      credit: credit
        ? {
            accountId: String(journal.creditAccountId),
            accountCode: credit.accountCode,
            accountName: credit.accountName,
            accountType: credit.accountType,
          }
        : {
            accountId: String(journal.creditAccountId || ''),
            accountCode: null,
            accountName: null,
            accountType: null,
          },
      notes: journal.notes || '',
    }, null, 2))
  } finally {
    await conn.close()
  }
})().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
