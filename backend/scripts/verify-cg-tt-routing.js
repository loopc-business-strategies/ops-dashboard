require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers(['8.8.8.8', '1.1.1.1'])

async function main() {
  const uri = process.env.MONGO_URI_CG || process.env.MONGODB_URI || process.env.MONGO_URI
  if (!uri) throw new Error('Missing CG Mongo URI')

  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 15000 }).asPromise()
  try {
    const db = conn.getClient().db()
    const txs = await db.collection('transactions')
      .find({ description: { $in: ['TT-CURRENCY-ROUTE-USD', 'TT-CURRENCY-ROUTE-AED', 'TT-CURRENCY-ROUTE-SOMS'] } })
      .sort({ createdAt: -1 })
      .toArray()

    const out = []
    for (const tx of txs) {
      const debit = tx.debitAccountId
        ? await db.collection('chartofaccounts').findOne(
            { _id: tx.debitAccountId },
            { projection: { accountCode: 1, accountName: 1 } }
          )
        : null
      const credit = tx.creditAccountId
        ? await db.collection('chartofaccounts').findOne(
            { _id: tx.creditAccountId },
            { projection: { accountCode: 1, accountName: 1 } }
          )
        : null

      out.push({
        id: String(tx._id),
        description: tx.description,
        status: tx.status,
        type: tx.type,
        lineCurr: tx.voucherMeta?.lineItems?.[0]?.currCode || null,
        debit: debit ? `${debit.accountCode} ${debit.accountName}` : null,
        credit: credit ? `${credit.accountCode} ${credit.accountName}` : null,
      })
    }

    console.log(JSON.stringify(out, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
