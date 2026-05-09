require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

const asObjectId = (value) => {
  const raw = String(value || '').trim()
  if (!/^[a-f\d]{24}$/i.test(raw)) return null
  return new mongoose.Types.ObjectId(raw)
}

async function main() {
  const uri = process.env.MONGO_URI_CG
  if (!uri) throw new Error('Missing MONGO_URI_CG (or fallback URI)')

  const conn = await mongoose.createConnection(uri, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000,
    socketTimeoutMS: 45000,
  }).asPromise()

  try {
    const db = conn.getClient().db()
    const chart = db.collection('chartofaccounts')
    const ledgers = db.collection('ledgers')
    const customers = db.collection('customers')
    const transactions = db.collection('transactions')

    const candidates = await chart.find({
      isActive: true,
      accountType: 'Asset',
      $or: [
        { accountCode: { $in: ['1300', '1302'] } },
        { accountName: /hepi\s*\(debtor\)|hepi/i },
      ],
    }).toArray()

    if (candidates.length < 2) {
      console.log(JSON.stringify({
        generatedAt: new Date().toISOString(),
        tenant: 'CG',
        message: 'No duplicate hepi debtor accounts found. Nothing to merge.',
        candidates: candidates.map((x) => ({ _id: String(x._id), accountCode: x.accountCode, accountName: x.accountName })),
      }, null, 2))
      return
    }

    const usage = []
    for (const acc of candidates) {
      const [drCount, crCount, customerCount] = await Promise.all([
        ledgers.countDocuments({ isDeleted: { $ne: true }, debitAccountId: acc._id }),
        ledgers.countDocuments({ isDeleted: { $ne: true }, creditAccountId: acc._id }),
        customers.countDocuments({ isActive: true, ledgerAccountId: acc._id }),
      ])
      usage.push({
        accountId: acc._id,
        accountCode: String(acc.accountCode || ''),
        accountName: String(acc.accountName || ''),
        score: drCount + crCount + customerCount,
        drCount,
        crCount,
        customerCount,
      })
    }

    usage.sort((a, b) => b.score - a.score)
    const keep = usage[0]
    const mergeList = usage.slice(1)

    const report = {
      generatedAt: new Date().toISOString(),
      tenant: 'CG',
      keep: {
        accountId: String(keep.accountId),
        accountCode: keep.accountCode,
        accountName: keep.accountName,
      },
      merged: [],
    }

    for (const item of mergeList) {
      const sourceId = asObjectId(item.accountId)
      const keepId = asObjectId(keep.accountId)
      if (!sourceId || !keepId) continue

      const [drMove, crMove, customerMove, txPartyIdMove, txPartyCodeMove] = await Promise.all([
        ledgers.updateMany(
          { isDeleted: { $ne: true }, debitAccountId: sourceId },
          { $set: { debitAccountId: keepId, updatedAt: new Date() } }
        ),
        ledgers.updateMany(
          { isDeleted: { $ne: true }, creditAccountId: sourceId },
          { $set: { creditAccountId: keepId, updatedAt: new Date() } }
        ),
        customers.updateMany(
          { ledgerAccountId: sourceId },
          { $set: { ledgerAccountId: keepId, updatedAt: new Date() } }
        ),
        transactions.updateMany(
          {
            isDeleted: { $ne: true },
            'voucherMeta.partyAccountId': { $in: [String(sourceId), item.accountCode] },
          },
          {
            $set: {
              'voucherMeta.partyAccountId': String(keepId),
              'voucherMeta.partyCode': keep.accountCode,
              updatedAt: new Date(),
            },
          }
        ),
        transactions.updateMany(
          {
            isDeleted: { $ne: true },
            'voucherMeta.partyCode': item.accountCode,
          },
          {
            $set: {
              'voucherMeta.partyCode': keep.accountCode,
              updatedAt: new Date(),
            },
          }
        ),
      ])

      const source = await chart.findOne({ _id: sourceId }, { projection: { accountName: 1, description: 1 } })
      const mergedName = `${String(source?.accountName || item.accountName)} [MERGED -> ${keep.accountCode}]`
      const mergedDescription = `${String(source?.description || '').trim()} | merged to ${keep.accountCode} on ${new Date().toISOString()}`.trim()

      await chart.updateOne(
        { _id: sourceId },
        {
          $set: {
            isActive: false,
            accountName: mergedName,
            description: mergedDescription,
            updatedAt: new Date(),
          },
        }
      )

      report.merged.push({
        sourceAccountId: String(sourceId),
        sourceAccountCode: item.accountCode,
        sourceAccountName: item.accountName,
        moved: {
          debitLedgers: drMove.modifiedCount || 0,
          creditLedgers: crMove.modifiedCount || 0,
          customers: customerMove.modifiedCount || 0,
          txPartyAccountId: txPartyIdMove.modifiedCount || 0,
          txPartyCode: txPartyCodeMove.modifiedCount || 0,
        },
      })
    }

    console.log(JSON.stringify(report, null, 2))
  } finally {
    await conn.close()
  }
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
